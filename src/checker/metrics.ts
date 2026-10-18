// 照合の精度を、見本とテスト用の追加データから計算する（検証結果のページとテストで同じ計算を使う）。
import cases from "../data/checker-cases.json";
import samples from "../data/samples.json";
import { stripRuby } from "../text/ruby";
import { ELEMENT_KINDS, type ElementKind, type GlossaryTerm, type Sample } from "../types";
import { check } from "./checker";

export type CaseType = "correct" | "drop" | "paraphrase";

export type EvalCase = {
  id: string;
  source: "見本" | "追加データ";
  type: CaseType;
  original: string;
  converted: string;
  expect: ElementKind[];
};

export type EvalResult = EvalCase & { found: ElementKind[]; ok: boolean };

/** 見本20件（正しい変換1つ＋間違いの例2つ）と、追加データをまとめる */
export function evalCases(): EvalCase[] {
  const out: EvalCase[] = [];
  for (const s of samples as Sample[]) {
    out.push({ id: `${s.id}-正`, source: "見本", type: "correct", original: s.original, converted: stripRuby(s.easyRuby), expect: [] });
    s.mistakes.forEach((m, i) =>
      out.push({ id: `${s.id}-誤${i + 1}`, source: "見本", type: "drop", original: s.original, converted: m.text, expect: m.drops }),
    );
  }
  for (const c of cases as EvalCase[]) out.push({ ...c, source: "追加データ" });
  return out;
}

export type ElementStat = {
  kind: ElementKind;
  /** その要素を落とした変換の数と、警告できた数 */
  dropped: number;
  detected: number;
  /** その要素を落としていない変換の数と、誤って警告した数 */
  clean: number;
  falseAlarms: number;
};

export type Metrics = {
  results: EvalResult[];
  /** 間違いの例（要素を落とした変換）のうち、落とした要素をすべて警告できた割合 */
  mistakes: { total: number; detected: number };
  /** 正しい変換（言い換えの大きいものを除く）のうち、警告が1つも出なかった割合 */
  correct: { total: number; clean: number };
  /** 大きく言い換えた正しい変換のうち、警告が出なかった割合 */
  paraphrase: { total: number; clean: number };
  elements: ElementStat[];
};

export function computeMetrics(glossary: GlossaryTerm[]): Metrics {
  const results: EvalResult[] = evalCases().map((c) => {
    const found = [...new Set(check(c.original, c.converted, glossary).map((w) => w.kind))];
    const ok = c.expect.length === 0 ? found.length === 0 : c.expect.every((k) => found.includes(k));
    return { ...c, found, ok };
  });
  const of = (t: CaseType) => results.filter((r) => r.type === t);
  return {
    results,
    mistakes: { total: of("drop").length, detected: of("drop").filter((r) => r.ok).length },
    correct: { total: of("correct").length, clean: of("correct").filter((r) => r.ok).length },
    paraphrase: { total: of("paraphrase").length, clean: of("paraphrase").filter((r) => r.ok).length },
    elements: ELEMENT_KINDS.map((kind) => {
      const withDrop = results.filter((r) => r.expect.includes(kind));
      const without = results.filter((r) => !r.expect.includes(kind));
      return {
        kind,
        dropped: withDrop.length,
        detected: withDrop.filter((r) => r.found.includes(kind)).length,
        clean: without.length,
        falseAlarms: without.filter((r) => r.found.includes(kind)).length,
      };
    }),
  };
}

export const pct = (a: number, b: number) => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`);
