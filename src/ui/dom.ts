// 画面づくりの小さな道具（フレームワークは使わない）
import type { Span } from "../types";

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as T[];

/** 文の中の範囲を <mark> で強調した HTML */
export function highlight(text: string, spans: Span[], cls = ""): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  for (const s of sorted) {
    if (s.start < pos) continue;
    out += esc(text.slice(pos, s.start));
    out += `<mark${cls ? ` class="${cls}"` : ""}>${esc(text.slice(s.start, s.end))}</mark>`;
    pos = s.end;
  }
  return out + esc(text.slice(pos));
}

export const ms = (n: number | undefined) => (n === undefined ? "—" : n < 1000 ? `${Math.round(n)}ミリ秒` : `${(n / 1000).toFixed(1)}秒`);

export const nowLabel = (d = new Date()) => d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
