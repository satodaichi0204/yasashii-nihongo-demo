// 翻訳の照合：用語を学校で決めた訳にそろえ、数字が訳から消えていないかを確かめる。
import { normalize } from "../text/normalize";
import type { GlossaryTerm, Warning } from "../types";
import { findQuantities, findRestatements } from "./rules";

export type TermReplacement = { term: string; from: string; to: string };

export type TranslationCheck = {
  text: string;
  replacements: TermReplacement[];
  warnings: Warning[];
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 翻訳の中の数字（「1,2」のような小数点のコンマも数字として読む） */
function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
}

export function checkTranslation(source: string, translation: string, lang: string, glossary: GlossaryTerm[]): TranslationCheck {
  const src = normalize(source).text;
  let text = translation;
  const replacements: TermReplacement[] = [];
  const warnings: Warning[] = [];

  for (const g of glossary) {
    if (!src.includes(g.term) && !(g.reading && src.includes(g.reading))) continue;
    const fixed = g.translations[lang];
    if (!fixed) continue;
    if (text.toLowerCase().includes(fixed.toLowerCase())) continue;
    // よくある別の訳を見つけたら、学校で決めた訳に置き換える
    const alias = (g.aliases[lang] ?? []).find((a) => new RegExp(escapeRe(a), "i").test(text));
    if (alias) {
      text = text.replace(new RegExp(escapeRe(alias), "i"), fixed);
      replacements.push({ term: g.term, from: alias, to: fixed });
    } else {
      warnings.push({
        id: `term:${lang}:${g.term}`,
        kind: "term",
        message: `用語「${g.term}」の訳として、学校で決めた「${fixed}」が見つかりません。訳を確かめてください。`,
        sourceSpans: [],
        targetSpans: [],
      });
    }
  }

  const have = numbersIn(text);
  // 言い直す前の数（「3ページ、いや4ページ」の3）は、訳になくてよい
  const restated = new Set(findRestatements(src).flatMap((r) => findQuantities(r.before.text).map((q) => q.value)));
  const missing = findQuantities(src).filter((q) => !restated.has(q.value) && !have.includes(q.value));
  if (missing.length > 0) {
    warnings.push({
      id: `quantity:${lang}:${missing.map((q) => q.value).join(",")}`,
      kind: "quantity",
      message: `数字 ${missing.map((q) => q.value).join("、")} が訳の中に見つかりません。数量が変わっていないか確かめてください。`,
      sourceSpans: [],
      targetSpans: [],
    });
  }
  return { text, replacements, warnings };
}
