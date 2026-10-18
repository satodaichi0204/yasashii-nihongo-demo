// 簡易変換（デモ用の規則）。マイクで話した文を、規則でやさしい日本語に近づける。
// 本番では、この部分を生成AIに差し替える。数字、単位、否定、条件、順序の言葉、用語集の言葉は変えない。
import { findRestatements } from "../checker/rules";
import { paraphrasePairs } from "../data/paraphrase";
import type { GlossaryTerm } from "../types";

const PAIRS = paraphrasePairs();

/** 丁寧すぎる依頼の形を「〜てください」にそろえる */
const POLITE: [RegExp, string][] = [
  [/ないようにしてください/g, "ないでください"],
  [/([てで])いただけますでしょうか/g, "$1ください"],
  [/([てで])いただけますか/g, "$1ください"],
  [/([てで])もらえますか/g, "$1ください"],
  [/([てで])くれますか/g, "$1ください"],
  [/([てで])いただきたいと思います/g, "$1ください"],
  [/([てで])ほしいです/g, "$1ください"],
  [/くださいね/g, "ください"],
  [/ましょうね/g, "ましょう"],
  [/ですね。/g, "です。"],
];

/** 長い文を、接続の言葉で短い文に区切る */
function splitSentences(text: string): string {
  return text
    .split(/(?<=。)/)
    .map((s) => {
      if (s.length <= 25) return s;
      return s
        .replace(/ので、/g, "。だから、")
        .replace(/(?<=[るたい])から、/g, "。だから、")
        .replace(/(?:けれども|けれど|けど)、/g, "。でも、")
        .replace(/(?<!な)([てで])、(?!(?:まず|次に|それから|その後|最後に))(?=.*[てで]ください)/g, "$1ください。それから、");
    })
    .join("");
}

export function simpleEasy(original: string, glossary: GlossaryTerm[]): string {
  let text = original.trim().replace(/\s+/g, "");
  if (text && !/[。！？!?]$/.test(text)) text += "。";

  // 言い直す前の部分を消す（「3ページ、いや4ページ」→「4ページ」）
  for (const r of findRestatements(text).reverse()) {
    let end = r.marker.end;
    while (/[、,]/.test(text[end] ?? "")) end++;
    text = text.slice(0, r.before.start) + text.slice(end);
  }

  for (const [re, rep] of POLITE) text = text.replace(re, rep);

  // 用語集の言葉は言い換えないよう、いったん目印に置き換えて守る
  const kept: string[] = [];
  for (const g of [...glossary].sort((a, b) => b.term.length - a.term.length)) {
    text = text.split(g.term).join(`${kept.push(g.term) - 1}`);
  }
  for (const [from, to] of PAIRS) text = text.split(from).join(to);
  text = text.replace(/(\d+)/g, (_, i) => kept[Number(i)]);

  return splitSentences(text);
}
