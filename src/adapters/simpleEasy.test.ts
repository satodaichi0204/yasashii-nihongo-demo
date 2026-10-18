import { describe, expect, it } from "vitest";
import { check } from "../checker/checker";
import { checkTranslation } from "../checker/translation";
import cases from "../data/checker-cases.json";
import glossaryData from "../data/glossary.json";
import samples from "../data/samples.json";
import { stripRuby } from "../text/ruby";
import type { GlossaryTerm, Sample } from "../types";
import { simpleEasy } from "./simpleEasy";

const glossary = glossaryData as GlossaryTerm[];
const KEEP = ["negation", "quantity", "condition", "order", "term"];

describe("簡易変換は、数字、単位、否定、条件、順序の言葉、用語集の言葉を変えない", () => {
  const originals = [...new Set([...(samples as Sample[]).map((s) => s.original), ...cases.map((c) => c.original)])];
  for (const o of originals) {
    it(o, () => {
      const out = simpleEasy(o, glossary);
      const lost = check(o, out, glossary).filter((w) => KEEP.includes(w.kind));
      expect(lost.map((w) => w.message), `変換後：${out}`).toEqual([]);
    });
  }
});

describe("簡易変換の働き", () => {
  it("丁寧すぎる依頼を「〜てください」にそろえる", () => {
    expect(simpleEasy("教科書を開いていただけますか", glossary)).toBe("教科書を開いてください。");
  });
  it("難しい言葉を言い換える", () => {
    expect(simpleEasy("プリントを提出してください。", glossary)).toBe("プリントを先生に出してください。");
    expect(simpleEasy("速やかに着席しましょう。", glossary)).toBe("すぐにすわりましょう。");
  });
  it("用語集の言葉は言い換えない", () => {
    expect(simpleEasy("実験で使用した温度計を返却してください。", glossary)).toBe("実験で使った温度計を返してください。");
  });
  it("言い直す前の部分を消す", () => {
    expect(simpleEasy("3ページ、いや4ページを開いてください。", glossary)).toBe("4ページを開いてください。");
  });
  it("長い文を短い文に区切る", () => {
    expect(simpleEasy("明日は図工でのりとはさみを使うので、忘れずに持ってきてください。", glossary)).toBe(
      "明日は図工でのりとはさみを使う。だから、忘れずに持ってきてください。",
    );
  });
});

describe("翻訳の照合", () => {
  const byId = Object.fromEntries((samples as Sample[]).map((s) => [s.id, s]));
  it("参考訳の用語を、学校で決めた訳に置き換える", () => {
    const s = byId.s01;
    const r = checkTranslation(stripRuby(s.easyRuby), s.translations.pt, "pt", glossary);
    expect(r.replacements).toEqual([{ term: "底辺", from: "lado de baixo", to: "base" }]);
    expect(r.text).toContain("base × altura ÷ 2");
    expect(r.warnings).toEqual([]);
  });
  for (const s of samples as Sample[]) {
    for (const lang of ["pt", "zh"]) {
      it(`${s.id}（${lang}）：参考訳に、用語の訳と数字がそろっている`, () => {
        const r = checkTranslation(stripRuby(s.easyRuby), s.translations[lang], lang, glossary);
        expect(r.warnings.map((w) => w.message)).toEqual([]);
      });
    }
  }
  it("数字が変わった訳には警告を出す", () => {
    const r = checkTranslation("48ページを開いてください。", "Abram na página 58.", "pt", glossary);
    expect(r.warnings.map((w) => w.kind)).toEqual(["quantity"]);
  });
});
