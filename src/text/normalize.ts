// 照合の前の、文字の正規化。空白を除き、全角の英数字を半角にする。
// 元の文字列での位置に戻せるよう、位置の対応表も返す（警告の箇所を色で示すため）。

export type Normalized = {
  text: string;
  /** text の i 文字目が、元の文字列の何文字目か */
  map: number[];
};

export function normalize(raw: string): Normalized {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    let ch = raw[i];
    if (/\s/.test(ch)) continue;
    const code = ch.charCodeAt(0);
    // 全角の英数字と記号（！〜～）を半角に
    if (code >= 0xff01 && code <= 0xff5e) ch = String.fromCharCode(code - 0xfee0);
    text += ch;
    map.push(i);
  }
  return { text, map };
}

/** 正規化後の位置の範囲を、元の文字列の位置の範囲に戻す */
export function toRawSpan(n: Normalized, start: number, end: number): { start: number; end: number } {
  const s = n.map[start] ?? n.map[n.map.length - 1] ?? 0;
  const e = (n.map[end - 1] ?? s) + 1;
  return { start: s, end: e };
}

const KANJI_DIGIT: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 漢数字（九十九まで、百、千）を数にする。読めなければ null */
export function kanjiToNumber(s: string): number | null {
  if (!/^[〇一二三四五六七八九十百千]+$/.test(s)) return null;
  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (ch in KANJI_DIGIT) current = current * 10 + KANJI_DIGIT[ch];
    else {
      const unit = ch === "十" ? 10 : ch === "百" ? 100 : 1000;
      total += (current || 1) * unit;
      current = 0;
    }
  }
  return total + current;
}
