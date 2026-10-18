import { describe, expect, it } from "vitest";
import glossaryData from "../data/glossary.json";
import samples from "../data/samples.json";
import { stripRuby } from "../text/ruby";
import { ELEMENT_LABEL, type GlossaryTerm, type Sample } from "../types";
import { check } from "./checker";
import { computeMetrics, pct } from "./metrics";

const glossary = glossaryData as GlossaryTerm[];
const kinds = (o: string, c: string) => [...new Set(check(o, c, glossary).map((w) => w.kind))].sort();

describe("見本20件", () => {
  for (const s of samples as Sample[]) {
    it(`${s.id}：正しい変換では警告が出ない`, () => {
      expect(kinds(s.original, stripRuby(s.easyRuby))).toEqual([]);
    });
    s.mistakes.forEach((m, i) => {
      it(`${s.id}：間違いの例${i + 1}で、落とした要素（${m.drops.join("、")}）を警告する`, () => {
        const found = kinds(s.original, m.text);
        for (const d of m.drops) expect(found).toContain(d);
      });
    });
  }
});

describe("規則の細かい動き", () => {
  it("「〜なければなりません」は否定に数えない", () => {
    expect(kinds("名前を書かなければなりません。", "名前を 書いて ください。")).toEqual([]);
  });
  it("「並んで」の「なら」は条件に数えない", () => {
    expect(kinds("一列に並んでください。", "1列に ならんで ください。")).toEqual([]);
  });
  it("漢数字と算用数字を同じ数として扱う", () => {
    expect(kinds("三人で一つの班を作ります。", "3人で 1つの 班を 作ります。")).toEqual([]);
  });
  it("全角の数字も同じ数として扱う", () => {
    expect(kinds("４８ページを開いてください。", "48ページを 開いて ください。")).toEqual([]);
  });
  it("警告は原文の中の位置を示す", () => {
    const o = "廊下は走らないでください。";
    const w = check(o, "ろうかは 走って ください。", glossary)[0];
    expect(o.slice(w.sourceSpans[0].start, w.sourceSpans[0].end)).toBe("ないでください");
  });
  it("指示語の警告は、やさしい日本語の中の位置を示す", () => {
    const c = "ここに 名前を 書いて ください。";
    const w = check("ここに名前を書いてください。", c, glossary).find((x) => x.kind === "demonstrative")!;
    expect(c.slice(w.targetSpans[0].start, w.targetSpans[0].end)).toBe("ここ");
  });
});

describe("精度（検証結果のページと同じ計算）", () => {
  const m = computeMetrics(glossary);
  it("結果を表示する", () => {
    console.log(`間違いの例の検出：${m.mistakes.detected}/${m.mistakes.total}（${pct(m.mistakes.detected, m.mistakes.total)}）`);
    console.log(`正しい変換で警告なし：${m.correct.clean}/${m.correct.total}（${pct(m.correct.clean, m.correct.total)}）`);
    console.log(`大きな言い換えで警告なし：${m.paraphrase.clean}/${m.paraphrase.total}（${pct(m.paraphrase.clean, m.paraphrase.total)}）`);
    for (const e of m.elements) {
      console.log(`${ELEMENT_LABEL[e.kind]}：検出 ${e.detected}/${e.dropped}、誤警告 ${e.falseAlarms}/${e.clean}`);
    }
    for (const r of m.results.filter((x) => !x.ok)) console.log(`  不一致 ${r.id}（${r.type}）期待=${r.expect} 検出=${r.found}`);
  });
  it("テスト用の追加データは30件以上", () => {
    expect(m.results.filter((r) => r.source === "追加データ").length).toBeGreaterThanOrEqual(30);
  });
  it("間違いの例は、すべて検出する", () => {
    expect(m.mistakes.detected).toBe(m.mistakes.total);
  });
  it("正しい変換では、警告を出さない", () => {
    expect(m.correct.clean).toBe(m.correct.total);
  });
});
