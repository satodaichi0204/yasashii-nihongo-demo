// 用語カード：今の指示に出てきた教科の用語を、ふりがな、やさしい説明、母語の訳と一緒に並べる。
// 母語を足場にしながら、教科の用語を日本語で覚えていく、教科学習支援の第一歩。
import type { GlossaryTerm } from "../types";

export type TermCard = {
  term: string;
  reading: string;
  easy: string;
  translations: { lang: string; text: string }[];
};

/** 原文かやさしい日本語に出てくる用語を、出てきた順に */
export function cardsFor(texts: string[], glossary: GlossaryTerm[], langs: string[]): TermCard[] {
  const joined = texts.join("\n").replace(/\s/g, "");
  return glossary
    .map((g) => ({ g, at: Math.min(...[g.term, g.reading].map((w) => (w && joined.includes(w) ? joined.indexOf(w) : Infinity))) }))
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at)
    .map(({ g }) => ({
      term: g.term,
      reading: g.reading,
      easy: g.easy,
      translations: langs.filter((l) => g.translations[l]).map((l) => ({ lang: l, text: g.translations[l] })),
    }));
}
