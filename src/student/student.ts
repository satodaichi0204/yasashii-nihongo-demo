// 児童向けの画面（拡張ディスプレイに出す別のウィンドウ）。先生が確認した内容だけを表示する。
import { Channel, type DisplayOptions, type DisplayPayload, type Message } from "../channel/channel";
import { markedToHtml, stripRuby } from "../text/ruby";
import { logoSvg, waitingSvg } from "../ui/art";
import { esc } from "../ui/dom";

export function mountStudent(root: HTMLElement) {
  document.body.classList.add("student");
  document.title = "児童向けの画面｜やさしい日本語（デモ版）";
  let payload: DisplayPayload | null = null;
  let options: DisplayOptions | null = null;

  root.innerHTML = `
    <div class="st-wrap">
      <div class="st-top">
        <span class="st-brand">${logoSvg} きょうしつの がめん（デモ）</span>
        <span>
          <button type="button" id="fs">全画面にする</button>
        </span>
      </div>
      <div id="content"></div>
    </div>`;
  const content = root.querySelector<HTMLElement>("#content")!;
  root.querySelector<HTMLButtonElement>("#fs")!.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const render = () => {
    document.body.style.setProperty("--s", String(options?.scale ?? 1));
    if (!payload || !options) {
      content.innerHTML = `<div class="st-idle"><div>${waitingSvg}<div>せんせいの かくにんを まっています</div><small>先生が確認した指示だけが、ここに表示されます</small></div></div>`;
      return;
    }
    const o = options;
    const parts: string[] = [];
    if (o.easy) {
      parts.push(`<section class="st-block st-easy">
        <div class="st-label"><span class="tag">やさしい にほんご</span></div>
        <div class="st-text">${o.ruby ? markedToHtml(payload.easyRuby) : esc(stripRuby(payload.easyRuby))}</div>
      </section>`);
    }
    const trs = payload.translations.filter((t) => o.langs.includes(t.lang) && t.text);
    if (trs.length > 0) {
      parts.push(`<div class="st-trs">${trs
        .map(
          (t) => `<section class="st-block st-tr" lang="${esc(t.lang)}">
            <div class="st-label"><span class="tag">${esc(t.native)}</span></div>
            <div class="st-text">${esc(t.text)}</div>
          </section>`,
        )
        .join("")}</div>`);
    }
    if (o.cards && payload.cards.length > 0) {
      parts.push(`<section>
        <p class="st-cards-title">📘 きょうの ことば（ようご カード）</p>
        <div class="st-cards">${payload.cards
          .map(
            (c) => `<div class="st-card">
              <div class="term"><ruby>${esc(c.term)}<rt>${esc(c.reading)}</rt></ruby></div>
              ${c.easy ? `<div class="exp">${esc(c.easy)}</div>` : ""}
              <div class="trs">${c.translations
                .filter((t) => o.langs.includes(t.lang))
                .map((t) => `<span lang="${esc(t.lang)}"><b>${esc(t.lang)}</b>${esc(t.text)}</span>`)
                .join("")}</div>
            </div>`,
          )
          .join("")}</div>
      </section>`);
    }
    if (o.original) {
      parts.push(`<section class="st-block st-orig">
        <div class="st-label"><span class="tag">せんせいの ことば</span></div>
        <div class="st-text">${esc(payload.original)}</div>
      </section>`);
    }
    content.innerHTML = parts.join("") || `<div class="st-idle">表示する段が選ばれていません</div>`;
  };

  const channel = new Channel((m: Message) => {
    if (m.type === "show") {
      payload = m.payload;
      options = m.options;
    } else if (m.type === "options") {
      options = payload ? m.options : null;
    } else if (m.type === "clear") {
      payload = null;
      options = null;
    } else return;
    render();
  });
  channel.addPeer(window.opener as Window | null);
  render();
  // 開いたこと（つながったこと）を先生の画面に知らせ、表示中の内容があれば送ってもらう
  channel.send({ type: "hello" });
  window.addEventListener("pagehide", () => channel.send({ type: "bye" }));
}
