// 用語集、定型文、検証結果、本番での差し替えの考え方、データの扱い のページ
import { computeMetrics, pct } from "../checker/metrics";
import { PARAPHRASE_COUNT } from "../data/paraphrase";
import { LANGUAGES } from "../data/languages";
import { defaultGlossary, loadPhrases, saveGlossary, savePhrases } from "../glossary/store";
import { ELEMENT_LABEL, type GlossaryTerm } from "../types";
import { $, $$, esc } from "../ui/dom";
import { state, updateSettings } from "./app";

// ------------------------------------------------------------------ 用語集
export function renderGlossaryPage(el: HTMLElement) {
  const langs = state.session.langs;
  const draw = () => {
    el.innerHTML = `<div class="page">
      <h1>教科の用語集</h1>
      <p class="lead">母語を足場にしながら、教科の用語を日本語で覚えていく、教科学習支援の第一歩です。
      ここに登録した用語は、①やさしい日本語で消えたら警告し、②翻訳では学校で決めた訳にそろえ、③児童向けの画面の「用語カード」に、ふりがな、やさしい説明、母語の訳と一緒に表示します。</p>
      <div class="row" style="margin:12px 0">
        <label class="row" style="gap:6px"><input type="checkbox" id="showEasy" ${state.settings.showGlossaryEasy ? "checked" : ""}> 用語カードに「やさしい説明」を表示する</label>
        <span class="spacer" style="flex:1"></span>
        <button class="btn" id="add">用語を追加</button>
        <button class="btn danger" id="reset">初期の用語に戻す</button>
      </div>
      <table class="data gl-table">
        <thead><tr><th style="width:9%">教科</th><th style="width:13%">用語</th><th style="width:13%">読み</th><th>やさしい説明</th>
        ${langs.map((l) => `<th style="width:14%">${esc(LANGUAGES.find((x) => x.code === l)?.label ?? l)}の訳<br><small>（学校で決めた訳）</small></th>`).join("")}
        <th style="width:6%"></th></tr></thead>
        <tbody>${state.glossary
          .map(
            (g, i) => `<tr>
              <td><input type="text" data-i="${i}" data-f="subject" value="${esc(g.subject)}"></td>
              <td><input type="text" data-i="${i}" data-f="term" value="${esc(g.term)}"></td>
              <td><input type="text" data-i="${i}" data-f="reading" value="${esc(g.reading)}"></td>
              <td><textarea data-i="${i}" data-f="easy">${esc(g.easy)}</textarea></td>
              ${langs.map((l) => `<td><input type="text" data-i="${i}" data-f="tr:${l}" value="${esc(g.translations[l] ?? "")}"></td>`).join("")}
              <td><button class="btn small danger" data-del="${i}" aria-label="${esc(g.term)}を削除">削除</button></td>
            </tr>`,
          )
          .join("")}</tbody>
      </table>
      <p class="note">用語集は、このブラウザの中（localStorage）だけに保存します。訳の列は、授業の画面で選んだ2言語です。言語を変えると、その言語の訳の列になります。</p>
    </div>`;
    $<HTMLInputElement>(el, "#showEasy").onchange = (e) => updateSettings({ showGlossaryEasy: (e.target as HTMLInputElement).checked });
    $$<HTMLInputElement>(el, "[data-f]").forEach(
      (inp) =>
        (inp.oninput = () => {
          const g = state.glossary[Number(inp.dataset.i)];
          const f = inp.dataset.f!;
          if (f.startsWith("tr:")) g.translations[f.slice(3)] = inp.value.trim();
          else (g as unknown as Record<string, string>)[f] = inp.value.trim();
          saveGlossary(state.glossary.filter((x) => x.term));
        }),
    );
    $$(el, "[data-del]").forEach(
      (b) =>
        (b.onclick = () => {
          state.glossary.splice(Number(b.dataset.del), 1);
          saveGlossary(state.glossary);
          draw();
        }),
    );
    $(el, "#add").onclick = () => {
      const g: GlossaryTerm = { term: "", reading: "", easy: "", translations: {}, aliases: {}, subject: "" };
      state.glossary.push(g);
      draw();
      $$<HTMLInputElement>(el, '[data-f="term"]').at(-1)?.focus();
    };
    $(el, "#reset").onclick = () => {
      if (!confirm("用語集を初期の15語に戻します。追加や修正は消えます。よろしいですか？")) return;
      state.glossary = defaultGlossary();
      saveGlossary(state.glossary);
      draw();
    };
  };
  draw();
}

// ------------------------------------------------------------------ 定型文
export function renderPhrasesPage(el: HTMLElement) {
  const draw = () => {
    const phrases = loadPhrases();
    el.innerHTML = `<div class="page">
      <h1>定型文</h1>
      <p class="lead">よく使う指示を、確認済みの内容（原文、やさしい日本語、2言語、用語カード）のまま保存し、授業の画面の「定型文」から呼び出して、すぐに表示できます。保存はこのブラウザの中だけです。</p>
      ${
        phrases.length === 0
          ? `<p class="hint">まだありません。授業の画面で確認済みにした指示を「定型文に保存」すると、ここに並びます。</p>`
          : `<table class="data"><thead><tr><th>名前</th><th>やさしい日本語</th><th>保存した日時</th><th></th></tr></thead><tbody>${phrases
              .map(
                (p) => `<tr><td>${esc(p.title)}</td><td>${esc(p.easyRuby.replace(/\[([^|\]]+)\|[^\]]+\]/g, "$1"))}</td><td class="num">${esc(p.savedAt)}</td>
                <td><button class="btn small danger" data-del="${p.id}">削除</button></td></tr>`,
              )
              .join("")}</tbody></table>`
      }
    </div>`;
    $$(el, "[data-del]").forEach(
      (b) =>
        (b.onclick = () => {
          savePhrases(loadPhrases().filter((p) => p.id !== b.dataset.del));
          draw();
        }),
    );
  };
  draw();
}

// ------------------------------------------------------------------ 検証結果
export function renderResultsPage(el: HTMLElement) {
  // 結果がいつも同じになるよう、初期の用語集で計算する（テストと同じ条件）
  const m = computeMetrics(defaultGlossary());
  const typeLabel = { correct: "正しい変換", drop: "要素を落とした変換", paraphrase: "大きく言い換えた正しい変換" };
  const stat = (title: string, a: number, b: number, sub: string, red = false) => `
    <div class="stat"><div class="sub">${title}</div><div class="big">${pct(a, b)}</div><div class="sub">${a} / ${b}件　${sub}</div>
    <div class="bar ${red ? "red" : ""}"><div style="width:${b ? (a / b) * 100 : 0}%"></div></div></div>`;
  el.innerHTML = `<div class="page">
    <h1>検証結果</h1>
    <p class="lead">意味の取りこぼしの照合を、見本20件（正しい変換1つと、AIがよく起こす間違いの例2つ）と、テスト用の追加データ${m.results.filter((r) => r.source === "追加データ").length}件で確かめた結果です。
    この数字は、自動テストと同じデータから、このページを開いたときに計算しています。</p>
    <div class="stats">
      ${stat("間違いの例を検出できた割合", m.mistakes.detected, m.mistakes.total, "落とした要素をすべて警告")}
      ${stat("正しい変換で警告が出なかった割合", m.correct.clean, m.correct.total, "誤って警告しなかった")}
      ${stat("大きく言い換えた正しい変換で、警告が出なかった割合", m.paraphrase.clean, m.paraphrase.total, "残りは「見逃すより警告」の方針で出る警告", true)}
    </div>
    <h2>要素ごとの結果</h2>
    <table class="data"><thead><tr><th>要素</th><th>落とした変換の数</th><th>検出できた割合</th><th>落としていない変換の数</th><th>誤って警告した割合</th></tr></thead>
    <tbody>${m.elements
      .map(
        (e) => `<tr><td>${ELEMENT_LABEL[e.kind]}</td><td class="num">${e.dropped}</td><td class="num"><b>${pct(e.detected, e.dropped)}</b>（${e.detected}/${e.dropped}）</td>
        <td class="num">${e.clean}</td><td class="num"><b>${pct(e.falseAlarms, e.clean)}</b>（${e.falseAlarms}/${e.clean}）</td></tr>`,
      )
      .join("")}</tbody></table>
    <p class="note">「誤って警告した割合」には、間違いの例の中で、落とした要素とは別の要素に出た警告も含みます（例：数字を変えた間違いの例で、同じ文の別の要素にも警告が出た場合）。</p>
    <h2>正しく言い換えても警告が出る例</h2>
    <ul>${m.results
      .filter((r) => r.type === "paraphrase" && !r.ok)
      .map((r) => `<li>「${esc(r.original)}」→「${esc(r.converted)}」：${r.found.map((k) => ELEMENT_LABEL[k]).join("、")}の警告</li>`)
      .join("")}</ul>
    <p class="hint">否定の言葉を、肯定の言い方（「外さないで」→「ずっとつけていて」）に変えると、意味は同じでも警告が出ます。先生が内容を見て「内容を確認して進む」を押せば進めます。本番では、生成AIの変換の傾向に合わせて、規則と見本を増やして精度を上げます。</p>
    <h2>すべての結果（${m.results.length}件）</h2>
    ${m.results
      .map(
        (r) => `<details class="case"><summary>${r.ok ? `<span class="badge ok">✔ 一致</span>` : `<span class="badge warn">△ 不一致</span>`}
          <b>${esc(r.id)}</b><span class="badge">${r.source}</span><span class="badge">${typeLabel[r.type]}</span>${esc(r.converted.slice(0, 40))}${r.converted.length > 40 ? "…" : ""}</summary>
          <div><p>原文：${esc(r.original)}<br>変換：${esc(r.converted)}</p>
          <p>落とした要素（正解）：${r.expect.length ? r.expect.map((k) => ELEMENT_LABEL[k]).join("、") : "なし"}　／　警告した要素：${r.found.length ? r.found.map((k) => ELEMENT_LABEL[k]).join("、") : "なし"}</p></div></details>`,
      )
      .join("")}
  </div>`;
}

// ------------------------------------------------------------------ 本番での差し替えの考え方
export function renderPartsPage(el: HTMLElement) {
  el.innerHTML = `<div class="page">
    <h1>本番での差し替えの考え方</h1>
    <p class="lead">音声認識、やさしい日本語化、翻訳の3つは、コードの中で<b>同じ形の差し込み口</b>として分けています（src/adapters）。本番では、画面と照合の仕組みは変えずに、差し込み口の中身だけを外部のサービスにつなぎ替えます。</p>
    <table class="data">
      <thead><tr><th style="width:14%">部品</th><th style="width:28%">このデモでの中身</th><th>本番での候補の種類</th></tr></thead>
      <tbody>
        <tr><td>音声認識</td><td>ブラウザ標準の音声認識（Web Speech API）。または見本（音声認識なし）</td><td>クラウドの音声認識サービス（日本語、短い発話向け）／教室の雑音に強いモデル／端末の中で動く音声認識</td></tr>
        <tr><td>やさしい日本語化</td><td>見本の変換（正しい変換と間違いの例）／簡易変換（規則と言い換えの辞書${PARAPHRASE_COUNT}語）</td><td>生成AI（指示文で、否定、順序、数量、条件、用語を守るよう指定し、出力をこのデモの照合で必ず確かめる）</td></tr>
        <tr><td>翻訳</td><td>参考訳（見本）／ブラウザの中で動く翻訳（Chrome の Translator API。使える環境だけ）</td><td>機械翻訳サービス／生成AIによる翻訳（用語集の訳を指定）</td></tr>
      </tbody>
    </table>
    <h2>選ぶときの観点</h2>
    <table class="data"><thead><tr><th style="width:24%">観点</th><th>確かめること</th></tr></thead><tbody>
      <tr><td>教室の雑音での精度</td><td>子どもの声や物音がある中で、先生の指示を正しく文字にできるか</td></tr>
      <tr><td>速さ</td><td>話し終わってから表示まで、授業の流れを止めない時間に収まるか（このデモの画面に、段階ごとの時間を表示しています）</td></tr>
      <tr><td>学習に利用されない設定</td><td>入力したデータを、サービス側のAIの学習に使わない設定・契約にできるか</td></tr>
      <tr><td>保存期間</td><td>音声や文が、サービス側にどれだけの期間残るか。残さない設定ができるか</td></tr>
      <tr><td>費用</td><td>1校・1日あたりの利用量での費用。無料の範囲と、超えたときの料金</td></tr>
      <tr><td>国内での処理</td><td>データを国内のデータセンターで処理できるか（自治体や学校の方針に合わせる）</td></tr>
    </tbody></table>
    <h2>第1段階での選び方</h2>
    <p>特定の会社を前提にせず、第1段階（要件の整理と技術の検証）で、<b>同じ先生の指示の例（このデモの見本20件と、録音した教室の音声）</b>を複数の候補にかけ、上の観点と、このデモの照合の警告の数で比べて選びます。結果は表にまとめてご報告し、合意のうえで決めます。</p>
  </div>`;
}

// ------------------------------------------------------------------ データの扱い
export function renderDataPage(el: HTMLElement) {
  el.innerHTML = `<div class="page">
    <h1>データの扱い</h1>
    <p class="lead">このデモは、サーバーを持たず、すべてブラウザの中で動きます。APIキーは使っていません。</p>
    <table class="data"><thead><tr><th style="width:26%">項目</th><th>このデモでの扱い</th></tr></thead><tbody>
      <tr><td>外部に送られるもの</td><td><b>マイクを使ったときの、ブラウザ標準の音声認識だけ</b>です。Chrome では、音声認識のために音声がブラウザの提供元のサーバーに送られます（ブラウザの仕組みによるもので、このデモが送り先を選んでいるわけではありません）。見本と文字の入力では、外部には何も送りません。</td></tr>
      <tr><td>翻訳</td><td>見本は、あらかじめ用意した参考訳を表示します。それ以外の文は、ブラウザの中で動く翻訳（Translator API）が使える環境でだけ訳します。この翻訳は端末の中で動き、文は外部に送られません（初めて使うときに、翻訳のモデルがダウンロードされます）。</td></tr>
      <tr><td>音声</td><td>保存しません。録音のファイルも作りません。入力音量のメーターは、音の大きさの数字だけを使います。</td></tr>
      <tr><td>発話の内容</td><td>発話の全文をログに残しません。画面を閉じると消えます。</td></tr>
      <tr><td>用語集と定型文</td><td>このブラウザの中（localStorage）だけに保存します。ほかの端末や外部には送りません。</td></tr>
      <tr><td>警告を確認して進めた記録</td><td>画面の上に表示するだけで、ブラウザの外には残しません。</td></tr>
      <tr><td>児童の情報</td><td>児童の氏名などは登録しません。</td></tr>
    </tbody></table>
    <h2>本番での扱い</h2>
    <ul>
      <li>音声認識、生成AI、翻訳のサービスは、<b>入力データが学習に利用されない設定</b>で、依頼者の名義のアカウントで使います。</li>
      <li>各サービスの<b>保存期間と学習利用の条件を一覧</b>にして、学校にご説明できる形でお渡しします。</li>
      <li>APIキーは、ブラウザに置かず、サーバー側だけで安全に管理します。</li>
      <li>音声は処理のあと保存しません。発話の全文を、不用意にログに残しません。</li>
    </ul>
    ${
      __SINGLE_FILE__
        ? ""
        : `<h2>1ファイル版</h2>
    <p>このデモを、HTMLの1ファイルにまとめたものです。メールに添付して送れます。<a href="yasashii-nihongo-demo-1file.html" download>1ファイル版をダウンロード</a></p>
    <p class="hint">ファイルを直接開くと、マイク、音声認識、ブラウザ内の翻訳、別ウィンドウとの連動が動かない場合があります（ブラウザの安全のための制限）。すべての機能は、公開URLでお試しください。</p>`
    }
  </div>`;
}
