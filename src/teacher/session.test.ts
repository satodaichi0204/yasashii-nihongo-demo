import { describe, expect, it } from "vitest";
import glossaryData from "../data/glossary.json";
import samples from "../data/samples.json";
import { stripRuby } from "../text/ruby";
import type { GlossaryTerm, Sample } from "../types";
import {
  acknowledge,
  canDisplay,
  confirm,
  confirmBlockers,
  editTranslation,
  isStale,
  newSession,
  setSource,
  setTexts,
  setTranslation,
  type Session,
} from "./session";

const glossary = glossaryData as GlossaryTerm[];
const s01 = (samples as Sample[])[0];
const correct = stripRuby(s01.easyRuby);
const mistake = s01.mistakes[0].text;

const translateAll = (s: Session) =>
  s.langs.reduce((acc, l) => setTranslation(acc, l, { text: s01.translations[l], adapter: "参考訳" }, glossary), s);

describe("画面の流れの規則", () => {
  it("警告がある間は、確認済みにできない", () => {
    let s = setTexts(newSession(["pt", "zh"]), s01.original, mistake, glossary);
    s = translateAll(s);
    expect(s.warnings.length).toBeGreaterThan(0);
    expect(confirmBlockers(s).join()).toContain("照合の警告");
    s = confirm(s);
    expect(s.confirmed).toBeNull();
    expect(canDisplay(s)).toBe(false);
  });

  it("「内容を確認して進む」を押せば、警告があっても確認済みにできる", () => {
    let s = translateAll(setTexts(newSession(["pt", "zh"]), s01.original, mistake, glossary));
    s = acknowledge(s, s.warnings.map((w) => w.id), "2026-10-19T10:00:00Z");
    s = confirm(s);
    expect(canDisplay(s)).toBe(true);
  });

  it("正しい変換に直せば、警告が消えて確認済みにできる", () => {
    let s = setTexts(newSession(["pt", "zh"]), s01.original, mistake, glossary);
    s = translateAll(setTexts(s, s01.original, correct, glossary));
    expect(s.warnings).toEqual([]);
    expect(canDisplay(confirm(s))).toBe(true);
  });

  it("やさしい日本語を直したら、翻訳を作り直すまで表示できない", () => {
    let s = confirm(translateAll(setTexts(newSession(["pt", "zh"]), s01.original, correct, glossary)));
    expect(canDisplay(s)).toBe(true);
    s = setTexts(s, s01.original, correct + "ノートに書きましょう。", glossary);
    expect(canDisplay(s)).toBe(false);
    expect(isStale(s, "pt")).toBe(true);
    expect(confirm(s).confirmed).toBeNull();
    s = confirm(translateAll(s));
    expect(canDisplay(s)).toBe(true);
  });

  it("確認する前の内容は表示できない", () => {
    const s = translateAll(setTexts(newSession(["pt", "zh"]), s01.original, correct, glossary));
    expect(canDisplay(s)).toBe(false);
  });

  it("確認済みのあとに訳を手で直したら、もう一度確認が必要", () => {
    let s = confirm(translateAll(setTexts(newSession(["pt", "zh"]), s01.original, correct, glossary)));
    s = editTranslation(s, "pt", s.translations.pt!.text + " Obrigado.", glossary);
    expect(canDisplay(s)).toBe(false);
    expect(canDisplay(confirm(s))).toBe(true);
  });

  it("翻訳元を原文に切り替えたら、翻訳の作り直しが必要", () => {
    let s = confirm(translateAll(setTexts(newSession(["pt", "zh"]), s01.original, correct, glossary)));
    s = setSource(s, "original");
    expect(isStale(s, "pt")).toBe(true);
    expect(canDisplay(s)).toBe(false);
  });

  it("翻訳できなかった言語があると、確認済みにできない", () => {
    let s = setTexts(newSession(["pt", "zh"]), s01.original, correct, glossary);
    s = setTranslation(s, "pt", { text: s01.translations.pt, adapter: "参考訳" }, glossary);
    s = setTranslation(s, "zh", { error: "この環境では使えません", adapter: "ブラウザ内の翻訳" }, glossary);
    expect(confirm(s).confirmed).toBeNull();
  });
});
