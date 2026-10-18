// 教師用の画面と児童向けの画面の連動。BroadcastChannel を使い、
// ファイルを直接開いた場合など BroadcastChannel が届かない環境では、開いたウィンドウへの postMessage でも送る。
import type { TermCard } from "../glossary/cards";

/** 児童向けの画面に出す内容（先生が確認したものだけ） */
export type DisplayPayload = {
  original: string;
  /** [漢字|よみ] の形のやさしい日本語 */
  easyRuby: string;
  translations: { lang: string; label: string; native: string; text: string }[];
  cards: TermCard[];
  shownAt: string;
};

export type DisplayOptions = {
  original: boolean;
  easy: boolean;
  ruby: boolean;
  langs: string[];
  cards: boolean;
  /** 文字の大きさ（1 が、32インチの画面を教室の後ろから読める大きさ） */
  scale: number;
};

export type Message =
  | { type: "show"; payload: DisplayPayload; options: DisplayOptions }
  | { type: "options"; options: DisplayOptions }
  | { type: "clear" }
  | { type: "hello" }
  | { type: "bye" };

const NAME = "yasashii-nihongo-demo";
const TAG = "__yasashii_demo__";

export class Channel {
  private bc: BroadcastChannel | null = null;
  private peers = new Set<Window>();
  private seen = new Set<string>();

  constructor(private onMessage: (m: Message) => void) {
    try {
      this.bc = new BroadcastChannel(NAME);
      this.bc.onmessage = (e) => this.receive(e.data);
    } catch {
      this.bc = null;
    }
    window.addEventListener("message", (e) => {
      if (e.data && e.data[TAG]) this.receive(e.data);
    });
  }

  /** postMessage でも届くよう、相手のウィンドウを覚える */
  addPeer(w: Window | null) {
    if (w) this.peers.add(w);
  }

  send(m: Message) {
    const envelope = { [TAG]: true, id: `${Date.now()}-${Math.random()}`, m };
    this.bc?.postMessage(envelope);
    for (const p of this.peers) {
      if (p.closed) this.peers.delete(p);
      else p.postMessage(envelope, "*");
    }
  }

  // 両方の経路で届いた同じ知らせは、1回だけ処理する
  private receive(data: { id: string; m: Message }) {
    if (!data?.id || this.seen.has(data.id)) return;
    this.seen.add(data.id);
    if (this.seen.size > 200) this.seen = new Set([...this.seen].slice(-100));
    this.onMessage(data.m);
  }
}
