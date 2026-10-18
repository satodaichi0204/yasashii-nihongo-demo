// ふりがな（ルビ）。見本のやさしい日本語は [漢字|よみ] の形で読みを持つ。

const MARK = /\[([^|\]]+)\|([^\]]+)\]/g;

/** [漢字|よみ] を取り除いた、ふつうの文 */
export function stripRuby(marked: string): string {
  return marked.replace(MARK, "$1");
}

/** 見本と用語集から集めた「漢字 → 読み」の辞書 */
export function collectReadings(markedTexts: string[], extra: [string, string][] = []): Map<string, string> {
  const dict = new Map<string, string>();
  for (const t of markedTexts) for (const m of t.matchAll(MARK)) dict.set(m[1], m[2]);
  for (const [k, v] of extra) dict.set(k, v);
  return dict;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** [漢字|よみ] の文を、HTML の <ruby> にする */
export function markedToHtml(marked: string): string {
  let out = "";
  let last = 0;
  for (const m of marked.matchAll(MARK)) {
    out += escapeHtml(marked.slice(last, m.index));
    out += `<ruby>${escapeHtml(m[1])}<rt>${escapeHtml(m[2])}</rt></ruby>`;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(marked.slice(last));
}

/**
 * ふつうの文に、辞書にある漢字の読みを付ける（長い語から先に）。
 * 先生が文を直した場合や、マイクで話した文に使う。辞書にない漢字には読みが付かない。
 */
export function autoRuby(plain: string, dict: Map<string, string>): string {
  const words = [...dict.keys()].filter((w) => /[一-鿿]/.test(w)).sort((a, b) => b.length - a.length);
  let out = "";
  let i = 0;
  outer: while (i < plain.length) {
    for (const w of words) {
      if (plain.startsWith(w, i)) {
        out += `[${w}|${dict.get(w)}]`;
        i += w.length;
        continue outer;
      }
    }
    out += plain[i];
    i++;
  }
  return out;
}
