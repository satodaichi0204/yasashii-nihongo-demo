// 授業（教師用）の画面：指示を入れる → やさしい日本語 → 照合 → 翻訳 → 先生の確認 → 児童向けの画面に表示
import { browserTranslateExists } from "../adapters/parts";
import { MicMonitor } from "../adapters/speech";
import type { DisplayPayload } from "../channel/channel";
import { LANGUAGES, langOf } from "../data/languages";
import samplesData from "../data/samples.json";
import { cardsFor } from "../glossary/cards";
import { loadPhrases, savePhrases, type Phrase } from "../glossary/store";
import { autoRuby, collectReadings, stripRuby } from "../text/ruby";
import { ELEMENT_LABEL, type Sample, type Warning } from "../types";
import { heroSvg } from "../ui/art";
import { $, $$, esc, highlight, ms, nowLabel } from "../ui/dom";
import {
  channel,
  easyParts,
  notify,
  onAppChange,
  openStudentWindow,
  requestScreenPermission,
  speechPart,
  state,
  translateParts,
  updateSettings,
} from "./app";
import {
  acknowledge,
  canDisplay,
  confirm,
  confirmBlockers,
  editTranslation,
  isStale,
  setLangs,
  setSource,
  setTexts,
  setTranslation,
  unacknowledged,
} from "./session";

const SAMPLES = samplesData as Sample[];
const SUBJECTS = ["すべて", ...new Set(SAMPLES.map((s) => s.subject))];
const ICON: Record<string, string> = {
  negation: "🚫",
  order: "🔢",
  quantity: "#️⃣",
  condition: "🔀",
  term: "📘",
  demonstrative: "👉",
  restatement: "↩️",
};

const readings = () =>
  collectReadings(
    SAMPLES.map((s) => s.easyRuby),
    state.glossary.map((g) => [g.term, g.reading] as [string, string]),
  );

let subjectFilter = "すべて";
let heroMin = (() => {
  try {
    return localStorage.getItem("yasashii-demo.heroMin") === "1";
  } catch {
    return false;
  }
})();
let inputTab: "sample" | "mic" | "text" | "phrase" = "sample";
const mic = new MicMonitor();
let recording = false;
let recStart = 0;
let recTimer = 0;

export function renderLesson(el: HTMLElement) {
  el.innerHTML = `
  <section class="hero ${heroMin ? "min" : ""}" id="hero">
    <div class="hero-body">
      <button class="btn small close" id="heroToggle">${heroMin ? "説明をひらく" : "説明をとじる"}</button>
      <h1>先生のことばを、<span class="hl">やさしい日本語</span>と<span class="hl">母語</span>で、<br>教室のみんなに とどけます</h1>
      <p>話した指示を、やさしい日本語と2つのことばに変えて、拡張ディスプレイに大きく表示します。<br>大事な意味（「〜しない」「3ページ」「〜したら」など）が消えていないかを自動で確かめ、<b>先生が確認したものだけ</b>を子どもたちに見せます。</p>
      <div class="pills">
        <span class="pill">🔍 意味の取りこぼしを自動でチェック</span>
        <span class="pill">📘 教科の用語カード</span>
        <span class="pill">✅ 先生の確認が必須</span>
        <span class="pill">🔑 APIキーなし・0円</span>
      </div>
      <div class="row">
        <button class="btn sun big" id="heroSample">▶ 見本で試してみる</button>
        <button class="btn big" id="heroMic">🎤 マイクで話す</button>
        <button class="btn big" id="heroStudent">📺 児童向けの画面を開く</button>
      </div>
    </div>
    <div class="hero-art-wrap">${heroSvg}</div>
  </section>

  <nav class="stepper" id="stepper" aria-label="進み具合"></nav>

  <div class="lesson">
    <section class="col-input">
      <div class="card" id="cardInput">
        <h2><span class="step">1</span>指示を入れる</h2>
        <div class="seg" role="tablist" id="inputTabs">
          <button data-tab="sample">見本から選ぶ</button>
          <button data-tab="mic">マイクで話す</button>
          <button data-tab="text">文字で入力</button>
          <button data-tab="phrase">定型文</button>
        </div>
        <div id="inputPanel"></div>
      </div>
      <div class="card">
        <h2>翻訳の設定</h2>
        <div class="row" style="align-items:flex-start">
          <label style="flex:1">言語1<select id="lang0"></select></label>
          <label style="flex:1">言語2<select id="lang1"></select></label>
        </div>
        <p class="hint" style="margin-top:8px">翻訳元</p>
        <div class="seg" id="sourceSeg">
          <button data-source="easy">やさしい日本語</button>
          <button data-source="original">原文</button>
        </div>
        <p class="note">言語の一覧はデータで持っているため、言語を足すのは1行の追加で済みます。初期値はポルトガル語と中国語です。</p>
      </div>
    </section>

    <section class="col-work">
      <div class="card box-orig" id="cardOrig">
        <header><h2><span class="step">2</span><span class="label-orig">原文</span> 先生の指示</h2><span id="origMeta" class="hint"></span></header>
        <textarea id="original" rows="2" placeholder="見本を選ぶか、マイクで話すと、ここに入ります（直接書き直すこともできます）"></textarea>
      </div>

      <div class="card box-easy" id="cardEasy">
        <header>
          <h2><span class="step">3</span><span class="label-easy">やさしい日本語</span></h2>
          <div class="seg" id="variantSeg"></div>
        </header>
        <textarea id="easy" rows="3" placeholder="やさしい日本語"></textarea>
        <div class="row" style="margin-top:6px">
          <button class="btn small" id="reconvert">原文から作り直す（簡易変換）</button>
          <span class="hint" id="easyNote"></span>
        </div>
      </div>

      <div class="card" id="checkCard">
        <header><h2><span class="step">4</span>意味の取りこぼしの照合</h2><span id="checkBadge"></span></header>
        <div id="checkBody"></div>
        <p class="note">否定、順序、数量、条件、教科の用語、指示語、言い直しを、原文と比べて確かめます。正しい言い換えでも警告が出ることがあります（例：「忘れないで」→「必ず持ってくる」）。授業では、<b>見逃すより警告を出す側</b>に倒しています。</p>
      </div>

      <div class="card" id="cardTr">
        <header>
          <h2><span class="step">5</span>翻訳</h2>
          <button class="btn primary small" id="translateBtn">翻訳を作る</button>
        </header>
        <div id="trBody" class="tr-grid"></div>
        <p class="note" id="trNote"></p>
      </div>

      <div class="card" id="cardConfirm">
        <header><h2><span class="step">6</span>先生の確認</h2><span id="confirmBadge"></span></header>
        <div id="confirmBody"></div>
      </div>
    </section>

    <section class="col-display">
      <div class="card" id="cardDisplay">
        <h2><span class="step">7</span>児童向けの画面</h2>
        <div id="conn"></div>
        <div class="row" style="margin-top:8px">
          <button class="btn primary" id="openStudent">児童向けの画面を開く</button>
          <button class="btn small" id="screenPerm">拡張ディスプレイを使う</button>
        </div>
        <p class="hint" id="openMsg"></p>
        <div class="toggles" id="toggles"></div>
        <label class="hint">文字の大きさ <b id="scaleLabel"></b>
          <input type="range" id="scale" min="0.6" max="1.6" step="0.1" style="width:100%">
        </label>
        <div class="row" style="margin:8px 0">
          <button class="btn ok big" id="showBtn" style="flex:1">児童向けの画面に表示</button>
        </div>
        <div class="row">
          <button class="btn" id="reshowBtn">表示し直す</button>
          <button class="btn danger" id="clearBtn">表示を中止</button>
          <button class="btn" id="savePhrase">定型文に保存</button>
        </div>
        <p class="hint" id="showMsg"></p>
        <p class="hint" style="margin-bottom:4px">児童向けの画面に今出ている内容</p>
        <div class="preview" id="preview"></div>
      </div>
    </section>
  </div>`;

  // ------------------------------------------------------------------ 入力
  const panel = $(el, "#inputPanel");
  const renderInput = () => {
    $$(el, "#inputTabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === inputTab)));
    if (inputTab === "sample") {
      const list = SAMPLES.filter((s) => subjectFilter === "すべて" || s.subject === subjectFilter);
      panel.innerHTML = `
        <div class="row" style="margin-top:8px">${SUBJECTS.map(
          (s) => `<button class="btn small" data-subj="${esc(s)}" aria-pressed="${s === subjectFilter}" style="${s === subjectFilter ? "background:var(--primary-soft);border-color:var(--primary)" : ""}">${esc(s)}</button>`,
        ).join("")}</div>
        <ul class="sample-list">${list
          .map(
            (s) => `<li><button data-sample="${s.id}" aria-current="${state.sample?.id === s.id && state.inputMode === "sample"}">
              <span class="meta"><span class="badge subj">${esc(s.subject)}</span><span class="badge">${esc(s.scene)}</span>${s.elements
                .map((k) => `<span class="badge">${ELEMENT_LABEL[k]}</span>`)
                .join("")}</span>${esc(s.original)}</button></li>`,
          )
          .join("")}</ul>`;
      $$(panel, "[data-subj]").forEach((b) => (b.onclick = () => ((subjectFilter = b.dataset.subj!), renderInput())));
      $$(panel, "[data-sample]").forEach((b) => (b.onclick = () => loadSample(SAMPLES.find((s) => s.id === b.dataset.sample)!)));
    } else if (inputTab === "mic") {
      panel.innerHTML = `
        <label class="hint" style="display:block;margin-top:8px">マイク<select id="micSel"><option value="">既定のマイク</option></select></label>
        <div class="status-line" id="micStatus" style="margin:6px 0">● 未確認</div>
        <div class="meter" aria-label="入力音量"><div id="meterBar"></div></div>
        <div class="row" style="margin-top:8px">
          <button class="btn" id="micCheck">マイクを確認する</button>
          <button class="btn primary big" id="recBtn" style="flex:1">● 録音を開始</button>
        </div>
        <div class="status-line" style="margin-top:6px"><span id="recTime"></span></div>
        <div id="micErr"></div>
        <div class="highlighted" id="interim" style="margin-top:6px;min-height:44px;color:var(--sub)">話した内容が、ここに出ます</div>
        <p class="note">${esc(speechPart.note)} 音声は保存しません。音声認識はブラウザの既定のマイクを使います（音量のメーターは、上で選んだマイクで確かめます）。</p>`;
      setupMic(panel);
    } else if (inputTab === "text") {
      panel.innerHTML = `
        <textarea id="typed" rows="4" style="margin-top:8px" placeholder="例：プリントを提出してから、速やかに着席してください。"></textarea>
        <button class="btn primary" id="typedGo" style="margin-top:6px">この文で試す（簡易変換）</button>
        <p class="note">マイクが使えない環境で、簡易変換と照合を試すための入力欄です。</p>`;
      $(panel, "#typedGo").onclick = () => {
        const t = $<HTMLTextAreaElement>(panel, "#typed").value.trim();
        if (t) loadOriginal(t, "text");
      };
    } else {
      const phrases = loadPhrases();
      panel.innerHTML = phrases.length
        ? `<ul class="sample-list">${phrases
            .map((p) => `<li><button data-phrase="${p.id}"><span class="meta"><span class="badge ok">確認済み</span></span>${esc(p.title)}</button></li>`)
            .join("")}</ul><p class="note">定型文は、確認済みの内容をそのまま呼び出します。<a href="#/phrases">定型文の一覧</a></p>`
        : `<p class="hint" style="margin-top:8px">まだ定型文がありません。確認済みの指示を「定型文に保存」すると、ここから呼び出せます。</p>`;
      $$(panel, "[data-phrase]").forEach((b) => (b.onclick = () => loadPhrase(phrases.find((p) => p.id === b.dataset.phrase)!)));
    }
  };
  $$(el, "#inputTabs button").forEach(
    (b) =>
      (b.onclick = () => {
        if (recording) return;
        if (inputTab === "mic" && b.dataset.tab !== "mic") mic.stop();
        inputTab = b.dataset.tab as typeof inputTab;
        renderInput();
      }),
  );

  // ------------------------------------------------------------------ 翻訳の設定
  const langSel = [$<HTMLSelectElement>(el, "#lang0"), $<HTMLSelectElement>(el, "#lang1")];
  langSel.forEach((sel, i) => {
    sel.innerHTML = LANGUAGES.map((l) => `<option value="${l.code}">${esc(l.label)}</option>`).join("");
    sel.value = state.session.langs[i];
    sel.onchange = () => {
      const langs = langSel.map((s) => s.value);
      if (langs[0] === langs[1]) {
        sel.value = state.session.langs[i];
        return;
      }
      state.session = setLangs(state.session, langs);
      state.display.langs = [...langs];
      updateSettings({ langs });
      renderTranslations();
      renderConfirm();
      renderDisplay();
    };
  });
  const renderSource = () =>
    $$(el, "#sourceSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.source === state.session.source)));
  $$(el, "#sourceSeg button").forEach(
    (b) =>
      (b.onclick = () => {
        state.session = setSource(state.session, b.dataset.source as "easy" | "original");
        updateSettings({ source: state.session.source });
        renderSource();
        renderTranslations();
        renderConfirm();
      }),
  );

  // ------------------------------------------------------------------ 原文とやさしい日本語
  const origEl = $<HTMLTextAreaElement>(el, "#original");
  const easyEl = $<HTMLTextAreaElement>(el, "#easy");
  let typingTimer = 0;
  const onType = () => {
    clearTimeout(typingTimer);
    typingTimer = window.setTimeout(() => {
      if (easyEl.value !== easyOf()) state.variant = -1;
      runCheck(origEl.value, easyEl.value);
      renderVariant();
      renderAfterTexts();
    }, 250);
  };
  origEl.oninput = onType;
  easyEl.oninput = onType;
  const easyOf = () => state.session.easy;

  const renderVariant = () => {
    const seg = $(el, "#variantSeg");
    if (state.inputMode !== "sample" || !state.sample) {
      seg.innerHTML = "";
      return;
    }
    const opts = ["正しい変換", "間違いの例1", "間違いの例2"];
    seg.innerHTML =
      opts.map((o, i) => `<button data-variant="${i}" aria-pressed="${state.variant === i}">${o}</button>`).join("") +
      (state.variant === -1 ? `<button aria-pressed="true" disabled>先生が修正</button>` : "");
    $$(seg, "[data-variant]").forEach((b) => (b.onclick = () => setVariant(Number(b.dataset.variant))));
  };

  const renderEasyNote = () => {
    const s = state.sample;
    let note: string;
    if (state.inputMode === "sample" && s && state.variant > 0) note = `間違いの例：${s.mistakes[state.variant - 1].note}`;
    else if (state.inputMode === "sample") note = easyParts.sample.note;
    else if (state.inputMode === "phrase") note = "定型文（確認済み）";
    else note = easyParts.simple.note;
    $(el, "#easyNote").textContent = note;
  };

  // ------------------------------------------------------------------ 照合
  const renderCheck = () => {
    const s = state.session;
    const open = unacknowledged(s);
    $(el, "#checkBadge").innerHTML = !s.easy
      ? ""
      : open.length
        ? `<span class="badge warn">⚠ 警告 ${open.length}件</span>`
        : s.warnings.length
          ? `<span class="badge ok">✔ 確認済みの警告 ${s.warnings.length}件</span>`
          : `<span class="badge ok">✔ 取りこぼしなし</span>`;
    const body = $(el, "#checkBody");
    if (!s.original || !s.easy) {
      body.innerHTML = `<p class="hint">原文とやさしい日本語がそろうと、ここで照合します。</p>`;
      return;
    }
    const srcSpans = s.warnings.filter((w) => !s.acknowledged[w.id]).flatMap((w) => w.sourceSpans);
    const dstSpans = s.warnings.filter((w) => !s.acknowledged[w.id]).flatMap((w) => w.targetSpans);
    body.innerHTML = `
      ${
        s.warnings.length === 0
          ? `<div class="checked-all">✔ 否定、順序、数量、条件、教科の用語、指示語、言い直しの取りこぼしは見つかりませんでした</div>`
          : `<div class="hint">原文（<mark>黄色</mark>：やさしい日本語で消えた箇所）</div>
             <div class="highlighted">${highlight(s.original, srcSpans)}</div>
             ${dstSpans.length ? `<div class="hint" style="margin-top:6px">やさしい日本語（<mark class="target">赤</mark>：残っていると困る箇所）</div><div class="highlighted">${highlight(s.easy, dstSpans, "target")}</div>` : ""}
             <ul class="warnings">${s.warnings.map((w) => warningHtml(w, s.acknowledged[w.id])).join("")}</ul>
             ${open.length > 1 ? `<div class="row" style="margin-top:8px"><button class="btn small" id="ackAll">すべての警告の内容を確認して進む</button></div>` : ""}`
      }`;
    $$(body, "[data-ack]").forEach((b) => (b.onclick = () => ack([b.dataset.ack!])));
    const all = body.querySelector<HTMLButtonElement>("#ackAll");
    if (all) all.onclick = () => ack(open.map((w) => w.id));
  };

  const warningHtml = (w: Warning, ackedAt?: string) => `
    <li class="warning ${ackedAt ? "acked" : ""}">
      <span class="icon" aria-hidden="true">${ackedAt ? "✔" : "⚠"}</span>
      <div><span class="kind">${ICON[w.kind]} ${ELEMENT_LABEL[w.kind]}</span>　${esc(w.message)}</div>
      <div class="actions">${
        ackedAt
          ? `<span class="hint">${esc(ackedAt)} に、先生が内容を確認して進めました</span>`
          : `<button class="btn small" data-ack="${esc(w.id)}">内容を確認して進む</button><span class="hint">または、やさしい日本語を直してください</span>`
      }</div>
    </li>`;

  const ack = (ids: string[]) => {
    const at = nowLabel();
    for (const id of ids) {
      const w = state.session.warnings.find((x) => x.id === id);
      if (w) state.ackLog.unshift({ at, kind: ELEMENT_LABEL[w.kind], message: w.message });
    }
    state.session = acknowledge(state.session, ids, at);
    renderCheck();
    renderConfirm();
  };

  // ------------------------------------------------------------------ 翻訳
  const renderTranslations = () => {
    const s = state.session;
    const body = $(el, "#trBody");
    body.innerHTML = s.langs
      .map((code) => {
        const t = s.translations[code];
        const stale = isStale(s, code);
        return `<div class="tr-item ${stale && s.easy ? "stale" : ""}">
          <header>
            <b>${esc(langOf(code).label)}</b>
            <span>${t && !t.error ? `<span class="badge">${esc(t.adapter)}</span>` : ""} ${
              !s.easy ? "" : stale ? `<span class="badge warn">⚠ ${t ? "作り直しが必要" : "未翻訳"}</span>` : `<span class="badge ok">✔ 最新</span>`
            }</span>
          </header>
          <textarea data-tr="${code}" rows="3" lang="${code}" ${!t || t.error ? "disabled" : ""}>${esc(t?.text ?? "")}</textarea>
          ${t?.error ? `<div class="err-note">✖ ${esc(t.error)}</div>` : ""}
          ${(t?.replacements ?? []).map((r) => `<div class="fix-note">🔁 用語「${esc(r.term)}」の訳を、学校で決めた「${esc(r.to)}」にそろえました（元の訳：${esc(r.from)}）</div>`).join("")}
          ${(t?.warnings ?? []).map((w) => `<div class="err-note">⚠ ${esc(w.message)}</div>`).join("")}
        </div>`;
      })
      .join("");
    $$<HTMLTextAreaElement>(body, "[data-tr]").forEach(
      (ta) =>
        (ta.oninput = () => {
          state.session = editTranslation(state.session, ta.dataset.tr!, ta.value, state.glossary);
          renderConfirm();
        }),
    );
    const btn = $<HTMLButtonElement>(el, "#translateBtn");
    btn.disabled = !s.easy;
    btn.textContent = s.langs.some((l) => s.translations[l]) ? "翻訳を作り直す" : "翻訳を作る";
    $(el, "#trNote").innerHTML = `翻訳元：<b>${s.source === "easy" ? "やさしい日本語" : "原文"}</b>。見本の正しいやさしい日本語には、<b>参考訳（デモ用）</b>を使います。それ以外の文は、${
      browserTranslateExists() ? "ブラウザの中で動く翻訳（Chrome の Translator API）で訳します。" : "ブラウザの中で動く翻訳を使いますが、<b>この環境では使えません</b>。本番では翻訳サービスで訳します。"
    } 用語は用語集の訳にそろえ、数字が訳から消えていないかも確かめます。`;
  };

  $(el, "#translateBtn").onclick = () => translateAll();

  // ------------------------------------------------------------------ 確認
  const renderConfirm = () => {
    const s = state.session;
    const blockers = confirmBlockers(s);
    const ok = canDisplay(s);
    $(el, "#confirmBadge").innerHTML = ok ? `<span class="badge ok">✔ 確認済み</span>` : s.easy ? `<span class="badge">未確認</span>` : "";
    const t = state.timings;
    $(el, "#confirmBody").innerHTML = `
      ${
        ok
          ? `<div class="checked-all">✔ 確認済みです。児童向けの画面に表示できます</div>`
          : blockers.length
            ? `<p class="hint">次のことが残っているため、まだ確認済みにできません。</p><ul class="blockers">${blockers.map((b) => `<li>✖ ${esc(b)}</li>`).join("")}</ul>`
            : `<p class="hint">内容を確かめて、「確認済みにする」を押してください。</p>`
      }
      <button class="btn primary big block" id="confirmBtn" ${ok || blockers.length ? "disabled" : ""}>確認済みにする</button>
      <table class="timings" aria-label="各段階にかかった時間">
        <tr><td>音声認識（録音を止めてから文字になるまで）</td><td>${ms(t.speech)}</td></tr>
        <tr><td>やさしい日本語化</td><td>${ms(t.easy)}</td></tr>
        <tr><td>照合</td><td>${ms(t.check)}</td></tr>
        <tr><td>翻訳（2言語）</td><td>${ms(t.translate)}</td></tr>
        <tr><td>先生の確認（変換ができてから、確認済みにするまで）</td><td>${ms(t.review)}</td></tr>
      </table>
      ${
        state.ackLog.length
          ? `<p class="hint" style="margin:8px 0 0">内容を確認して進めた警告（記録はこのブラウザの中だけ）</p><ul class="ack-log">${state.ackLog
              .slice(0, 8)
              .map((a) => `<li>${esc(a.at)}　${esc(a.kind)}：${esc(a.message)}</li>`)
              .join("")}</ul>`
          : ""
      }`;
    const btn = el.querySelector<HTMLButtonElement>("#confirmBtn");
    if (btn)
      btn.onclick = () => {
        state.session = confirm(state.session);
        if (state.readyAt) state.timings.review = performance.now() - state.readyAt;
        renderConfirm();
        renderDisplay();
        $(el, "#confirmBody").firstElementChild?.classList.add("confirmed-burst");
      };
    renderDisplay();
  };

  // ------------------------------------------------------------------ 児童向けの画面
  const renderDisplay = () => {
    const d = state.display;
    $(el, "#conn").innerHTML = `<div class="conn ${state.studentConnected ? "on" : ""}"><span class="dot"></span>${
      state.studentConnected ? "児童向けの画面とつながっています" : "児童向けの画面は開いていません"
    }</div>`;
    const langs = state.session.langs;
    $(el, "#toggles").innerHTML = [
      ["easy", "やさしい日本語", d.easy],
      ["ruby", "　ふりがなを付ける", d.ruby],
      ...langs.map((l) => [`lang:${l}`, langOf(l).label, d.langs.includes(l)] as [string, string, boolean]),
      ["cards", "用語カード（教科の用語を、母語の訳と一緒に）", d.cards],
      ["original", "原文（先生のことば）", d.original],
    ]
      .map(([k, label, on]) => `<label><input type="checkbox" data-opt="${k}" ${on ? "checked" : ""}> ${esc(String(label))}</label>`)
      .join("");
    $$<HTMLInputElement>(el, "[data-opt]").forEach(
      (cb) =>
        (cb.onchange = () => {
          const k = cb.dataset.opt!;
          if (k.startsWith("lang:")) {
            const l = k.slice(5);
            d.langs = cb.checked ? [...new Set([...d.langs, l])] : d.langs.filter((x) => x !== l);
          } else (d as unknown as Record<string, boolean>)[k] = cb.checked;
          pushOptions();
        }),
    );
    const scale = $<HTMLInputElement>(el, "#scale");
    scale.value = String(d.scale);
    $(el, "#scaleLabel").textContent = `${Math.round(d.scale * 100)}%`;
    const ok = canDisplay(state.session);
    $<HTMLButtonElement>(el, "#showBtn").disabled = !ok;
    $<HTMLButtonElement>(el, "#savePhrase").disabled = !ok;
    $<HTMLButtonElement>(el, "#reshowBtn").disabled = !state.shown;
    $<HTMLButtonElement>(el, "#clearBtn").disabled = !state.shown;
    $(el, "#showMsg").innerHTML = ok
      ? ""
      : `<span>🔒 先生が確認済みにするまで、児童向けの画面には表示できません。</span>`;
    renderPreviewAndSteps();
  };

  const renderPreviewAndSteps = () => {
    renderPreview();
    renderStepper();
  };
  const renderPreview = () => {
    const p = state.shown;
    const d = state.display;
    $(el, "#preview").innerHTML = !p
      ? `<span class="p-sub">（何も表示していません）</span>`
      : `<div class="showing">● 表示中（${esc(p.shownAt)}）</div>
         ${d.easy ? `<div class="p-easy">${esc(stripRuby(p.easyRuby))}</div>` : ""}
         ${p.translations.filter((t) => d.langs.includes(t.lang)).map((t) => `<div><b>${esc(t.native)}</b>　${esc(t.text)}</div>`).join("")}
         ${d.cards && p.cards.length ? `<div class="p-sub">用語カード：${p.cards.map((c) => esc(c.term)).join("、")}</div>` : ""}
         ${d.original ? `<div class="p-sub">原文：${esc(p.original)}</div>` : ""}`;
  };

  const pushOptions = () => {
    if (state.shown) channel.send({ type: "options", options: state.display });
    renderDisplay();
  };
  $<HTMLInputElement>(el, "#scale").oninput = (e) => {
    state.display.scale = Number((e.target as HTMLInputElement).value);
    pushOptions();
  };

  $(el, "#openStudent").onclick = async () => {
    $(el, "#openMsg").textContent = await openStudentWindow();
  };
  $(el, "#screenPerm").onclick = async () => {
    $(el, "#openMsg").textContent = await requestScreenPermission();
  };

  $(el, "#showBtn").onclick = () => {
    if (!canDisplay(state.session)) return;
    const s = state.session;
    const easyRuby =
      state.inputMode === "sample" && state.sample && s.easy === stripRuby(state.sample.easyRuby)
        ? state.sample.easyRuby
        : state.inputMode === "phrase" && phraseRuby && stripRuby(phraseRuby) === s.easy
          ? phraseRuby
          : autoRuby(s.easy, readings());
    const payload: DisplayPayload = {
      original: s.original,
      easyRuby,
      translations: s.langs.map((l) => ({ lang: l, label: langOf(l).label, native: langOf(l).native, text: s.translations[l]?.text ?? "" })),
      cards: cardsFor([s.original, s.easy], state.glossary, s.langs).map((c) => (state.settings.showGlossaryEasy ? c : { ...c, easy: "" })),
      shownAt: nowLabel(),
    };
    state.shown = payload;
    channel.send({ type: "show", payload, options: state.display });
    $(el, "#showMsg").textContent = state.studentConnected ? "表示しました。" : "表示しました（児童向けの画面を開くと、この内容が出ます）。";
    renderDisplay();
    const pv = $(el, "#preview");
    pv.classList.remove("flash");
    void pv.offsetWidth;
    pv.classList.add("flash");
  };
  $(el, "#reshowBtn").onclick = () => {
    if (state.shown) channel.send({ type: "show", payload: state.shown, options: state.display });
    $(el, "#showMsg").textContent = "表示し直しました。";
  };
  $(el, "#clearBtn").onclick = () => {
    state.shown = null;
    channel.send({ type: "clear" });
    $(el, "#showMsg").textContent = "表示を中止しました。";
    renderDisplay();
  };
  $(el, "#savePhrase").onclick = () => {
    const s = state.session;
    if (!canDisplay(s)) return;
    const title = prompt("定型文の名前", s.original.slice(0, 30));
    if (title === null) return;
    const phrases = loadPhrases();
    phrases.unshift({
      id: `p${Date.now()}`,
      title: title || s.original.slice(0, 30),
      original: s.original,
      easyRuby: state.inputMode === "sample" && state.sample && state.variant === 0 ? state.sample.easyRuby : autoRuby(s.easy, readings()),
      translations: Object.fromEntries(s.langs.map((l) => [l, s.translations[l]?.text ?? ""])),
      savedAt: new Date().toLocaleString("ja-JP"),
    });
    savePhrases(phrases);
    $(el, "#showMsg").textContent = "定型文に保存しました（このブラウザの中だけに保存）。";
    if (inputTab === "phrase") renderInput();
  };

  // ------------------------------------------------------------------ 流れ
  let phraseRuby: string | null = null;

  const runCheck = (original: string, easy: string) => {
    const t0 = performance.now();
    state.session = setTexts(state.session, original, easy, state.glossary);
    state.timings.check = performance.now() - t0;
  };

  const renderAfterTexts = () => {
    renderEasyNote();
    renderCheck();
    renderTranslations();
    renderConfirm();
  };

  const syncTextareas = () => {
    origEl.value = state.session.original;
    easyEl.value = state.session.easy;
    $(el, "#origMeta").textContent =
      state.inputMode === "sample" && state.sample
        ? `見本：${state.sample.subject}・${state.sample.scene}`
        : state.inputMode === "mic"
          ? "マイクで話した文"
          : state.inputMode === "phrase"
            ? "定型文"
            : state.inputMode === "text"
              ? "文字で入力した文"
              : "";
  };

  const convertEasy = async (original: string) => {
    const part = state.inputMode === "sample" && state.sample ? easyParts.sample : easyParts.simple;
    const t0 = performance.now();
    const easy = await part.convert({ original, sample: state.sample ?? undefined, variant: state.variant });
    state.timings.easy = performance.now() - t0;
    state.parts.easy = part.label;
    return easy;
  };

  const loadSample = async (s: Sample) => {
    state.sample = s;
    state.inputMode = "sample";
    state.variant = 0;
    state.timings = {};
    state.parts.speech = "見本（音声認識なし）";
    phraseRuby = null;
    const easy = await convertEasy(s.original);
    runCheck(s.original, easy);
    state.readyAt = performance.now();
    syncTextareas();
    renderVariant();
    renderAfterTexts();
    renderInput();
    notify();
    await translateAll();
  };

  const setVariant = async (v: number) => {
    if (!state.sample) return;
    state.variant = v;
    const easy = await convertEasy(state.session.original);
    runCheck(state.session.original, easy);
    state.readyAt = performance.now();
    syncTextareas();
    renderVariant();
    renderAfterTexts();
  };

  const loadOriginal = async (text: string, mode: "mic" | "text") => {
    state.sample = null;
    state.inputMode = mode;
    state.variant = 0;
    phraseRuby = null;
    if (mode === "text") {
      state.timings = {};
      state.parts.speech = "なし（文字で入力）";
    }
    const easy = await convertEasy(text);
    runCheck(text, easy);
    state.readyAt = performance.now();
    syncTextareas();
    renderVariant();
    renderAfterTexts();
    notify();
    await translateAll();
  };

  const loadPhrase = (p: Phrase) => {
    state.sample = null;
    state.inputMode = "phrase";
    state.timings = {};
    state.parts = { speech: "なし（定型文）", easy: "定型文", translate: "定型文" };
    phraseRuby = p.easyRuby;
    runCheck(p.original, stripRuby(p.easyRuby));
    // 保存したときに先生が確認済みにした内容なので、そのときの警告は確認済みとして扱う
    state.session = acknowledge(state.session, state.session.warnings.map((w) => w.id), `定型文（${p.savedAt}）`);
    for (const l of state.session.langs) {
      state.session = p.translations[l]
        ? setTranslation(state.session, l, { text: p.translations[l], adapter: "定型文" }, state.glossary)
        : setTranslation(state.session, l, { error: `この定型文には${langOf(l).label}の訳がありません。「翻訳を作り直す」を押してください。`, adapter: "定型文" }, state.glossary);
    }
    state.session = confirm(state.session);
    state.readyAt = null;
    syncTextareas();
    renderVariant();
    renderAfterTexts();
    notify();
  };

  let translating = false;
  const translateAll = async () => {
    const s0 = state.session;
    if (!s0.easy || translating) return;
    translating = true;
    try {
      await translateNow(s0);
    } finally {
      translating = false;
    }
  };
  const translateNow = async (s0: typeof state.session) => {
    const fromEasy = s0.source === "easy";
    const text = fromEasy ? s0.easy : s0.original;
    const easyIsSample = !!state.sample && s0.easy === stripRuby(state.sample.easyRuby);
    const useReference = state.inputMode === "sample" && !!state.sample && fromEasy && easyIsSample;
    const part = useReference ? translateParts.reference : translateParts.browser;
    const btn = $<HTMLButtonElement>(el, "#translateBtn");
    btn.disabled = true;
    btn.textContent = "翻訳しています…";
    const t0 = performance.now();
    for (const lang of s0.langs) {
      const r = await part.translate({ text, lang, sample: state.sample ?? undefined, fromEasy, easyIsSample }, (msg) => {
        $(el, "#trNote").textContent = msg;
      });
      state.session = setTranslation(state.session, lang, { ...r, adapter: part.label }, state.glossary);
    }
    state.timings.translate = performance.now() - t0;
    state.parts.translate = part.label + (state.session.langs.some((l) => state.session.translations[l]?.error) ? "（使えません）" : "");
    renderTranslations();
    renderConfirm();
    notify();
  };

  $(el, "#reconvert").onclick = async () => {
    if (!state.session.original.trim()) return;
    const wasSample = state.inputMode === "sample";
    if (wasSample) state.inputMode = "text";
    state.sample = wasSample ? state.sample : null;
    const t0 = performance.now();
    const easy = await easyParts.simple.convert({ original: state.session.original });
    state.timings.easy = performance.now() - t0;
    state.parts.easy = easyParts.simple.label;
    state.variant = -1;
    if (wasSample) state.inputMode = "sample";
    runCheck(state.session.original, easy);
    state.readyAt = performance.now();
    syncTextareas();
    renderVariant();
    renderAfterTexts();
    notify();
  };

  // ------------------------------------------------------------------ マイク
  function setupMic(p: HTMLElement) {
    const sel = $<HTMLSelectElement>(p, "#micSel");
    const status = $(p, "#micStatus");
    const bar = $(p, "#meterBar");
    const err = $(p, "#micErr");
    const showErr = (m: string) => (err.innerHTML = m ? `<div class="err-note" role="alert">✖ ${esc(m)}</div>` : "");

    const refreshDevices = async () => {
      const devs = await MicMonitor.devices();
      const cur = sel.value;
      sel.innerHTML =
        `<option value="">既定のマイク</option>` +
        devs.filter((d) => d.deviceId && d.deviceId !== "default").map((d) => `<option value="${esc(d.deviceId)}">${esc(d.label || "マイク")}</option>`).join("");
      if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
      if (devs.length === 0) {
        status.innerHTML = `<span style="color:var(--danger)">✖ マイクが接続されていません</span>`;
      }
    };
    const startMonitor = async () => {
      showErr("");
      try {
        const label = await mic.start(sel.value || undefined, (lv) => (bar.style.width = `${Math.round(lv * 100)}%`));
        status.innerHTML = `<span style="color:var(--ok)">● 接続中：${esc(label)}</span>`;
        await refreshDevices();
        return true;
      } catch (e) {
        status.innerHTML = `<span style="color:var(--danger)">✖ 使えません</span>`;
        showErr((e as Error).message);
        return false;
      }
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", async () => {
      await refreshDevices();
      if (!recording) status.innerHTML = `<span>● マイクの接続が変わりました。「マイクを確認する」を押してください</span>`;
    });
    refreshDevices();
    sel.onchange = () => startMonitor();
    $(p, "#micCheck").onclick = () => startMonitor();

    const recBtn = $<HTMLButtonElement>(p, "#recBtn");
    const recTime = $(p, "#recTime");
    const interim = $(p, "#interim");
    recBtn.onclick = async () => {
      if (!recording) {
        showErr("");
        if (!speechPart.supported()) {
          showErr("このブラウザでは音声認識が使えません。Windows の Chrome か Edge でお試しください。");
          return;
        }
        if (!(await startMonitor())) return;
        recording = true;
        recStart = performance.now();
        interim.textContent = "（聞き取っています…）";
        speechPart.start({ onInterim: (t) => (interim.textContent = t), onError: (m) => showErr(m) });
        recBtn.textContent = "■ 録音を止める";
        recBtn.classList.add("danger");
        recTimer = window.setInterval(() => {
          const sec = Math.floor((performance.now() - recStart) / 1000);
          recTime.innerHTML = `<span class="rec-dot"></span> 録音中 ${sec}秒${
            sec >= 20 ? `　<span class="badge warn">⚠ 20秒を超えました。短く区切ると、確認しやすくなります</span>` : ""
          }`;
        }, 250);
      } else {
        recording = false;
        clearInterval(recTimer);
        recBtn.textContent = "● 録音を開始";
        recBtn.classList.remove("danger");
        recTime.textContent = "文字にしています…";
        const t0 = performance.now();
        const text = await speechPart.stop();
        const took = performance.now() - t0;
        mic.stop();
        bar.style.width = "0";
        status.innerHTML = `● 待機中`;
        recTime.textContent = "";
        if (!text) {
          if (!err.textContent) showErr("声が聞き取れませんでした（無音でした）。マイクに近づいて、もう一度話してください。");
          interim.textContent = "話した内容が、ここに出ます";
          return;
        }
        interim.textContent = text;
        state.timings = { speech: took };
        state.parts.speech = speechPart.label;
        await loadOriginal(text, "mic");
      }
    };
  }

  // ------------------------------------------------------------------ ようこその帯
  const hero = $(el, "#hero");
  $(el, "#heroToggle").onclick = () => {
    heroMin = !heroMin;
    hero.classList.toggle("min", heroMin);
    $(el, "#heroToggle").textContent = heroMin ? "説明をひらく" : "説明をとじる";
    try {
      localStorage.setItem("yasashii-demo.heroMin", heroMin ? "1" : "0");
    } catch {
      // 保存できない環境では、この画面の間だけ
    }
  };
  const goTo = (id: string) => $(el, `#${id}`).scrollIntoView({ behavior: "smooth", block: "start" });
  $(el, "#heroSample").onclick = () => {
    inputTab = "sample";
    renderInput();
    loadSample(SAMPLES[0]);
    goTo("cardEasy");
  };
  $(el, "#heroMic").onclick = () => {
    inputTab = "mic";
    renderInput();
    goTo("cardInput");
  };
  $(el, "#heroStudent").onclick = async () => {
    $(el, "#openMsg").textContent = await openStudentWindow();
  };

  // ------------------------------------------------------------------ 進み具合（6つの段階）
  const renderStepper = () => {
    const s = state.session;
    const open = unacknowledged(s).length;
    const stale = s.langs.some((l) => isStale(s, l));
    const ok = canDisplay(s);
    const steps = [
      { icon: "🎤", label: "指示を入れる", sub: "見本・マイク・文字", done: !!s.original, blocked: false, target: "cardInput" },
      { icon: "✏️", label: "やさしくする", sub: "やさしい日本語", done: !!s.easy, blocked: false, target: "cardEasy" },
      { icon: "🔍", label: "チェック", sub: open ? `警告 ${open}件` : "意味の取りこぼし", done: !!s.easy && open === 0, blocked: open > 0, target: "checkCard" },
      { icon: "🌏", label: "ほんやく", sub: s.easy && stale ? "作り直しが必要" : "2つのことば", done: !!s.easy && !stale, blocked: !!s.easy && stale, target: "cardTr" },
      { icon: "✅", label: "先生のかくにん", sub: ok ? "確認済み" : "まだ", done: ok, blocked: false, target: "cardConfirm" },
      { icon: "📺", label: "子どもの画面へ", sub: state.shown ? "表示中" : "まだ", done: !!state.shown && ok, blocked: false, target: "cardDisplay" },
    ];
    const current = steps.findIndex((x) => !x.done);
    $(el, "#stepper").innerHTML = steps
      .map(
        (x, i) => `<button type="button" data-goto="${x.target}" class="${x.done ? "done" : ""} ${i === current ? "current" : ""} ${x.blocked ? "blocked" : ""}" aria-current="${i === current ? "step" : "false"}">
          <span class="dot" aria-hidden="true">${x.done ? "✔" : x.blocked ? "⚠" : x.icon}</span>
          <span>${i + 1}. ${esc(x.label)}</span>
          <small>${esc(x.sub)}</small>
        </button>`,
      )
      .join("");
    $$(el, "[data-goto]").forEach((b) => (b.onclick = () => goTo(b.dataset.goto!)));
  };

  // ------------------------------------------------------------------ はじめの表示
  renderInput();
  renderSource();
  syncTextareas();
  renderVariant();
  renderAfterTexts();
  const off = onAppChange(renderDisplay);
  return () => {
    off();
    if (!recording) mic.stop();
  };
}
