// 1つの指示の、確認から表示までの状態。画面から切り離した純粋な関数で、規則をテストできるようにしている。
//   - 照合の警告がある間は「確認済み」にできない（先生が直すか、「内容を確認して進む」を押したときだけ）
//   - やさしい日本語を直したら、翻訳を作り直すまで表示できない
//   - 先生が確認する前の内容は、児童向けの画面に出さない
import { check } from "../checker/checker";
import { checkTranslation, type TermReplacement } from "../checker/translation";
import type { GlossaryTerm, Warning } from "../types";

export type TranslationSource = "original" | "easy";

export type TranslationState = {
  lang: string;
  text: string;
  /** どの文から訳したか（この文が今の文と違えば、作り直しが必要） */
  basis: string;
  adapter: string;
  replacements: TermReplacement[];
  warnings: Warning[];
  /** 訳が作れなかったときの説明 */
  error?: string;
};

export type Session = {
  original: string;
  easy: string;
  source: TranslationSource;
  langs: string[];
  warnings: Warning[];
  /** 先生が内容を見たうえで進めた警告（id → 押した時刻）。記録はブラウザの中だけ */
  acknowledged: Record<string, string>;
  translations: Record<string, TranslationState | undefined>;
  /** 確認済みにしたときの内容。今の内容と同じときだけ表示できる */
  confirmed: string | null;
};

export function newSession(langs: string[], source: TranslationSource = "easy"): Session {
  return { original: "", easy: "", source, langs, warnings: [], acknowledged: {}, translations: {}, confirmed: null };
}

const basisOf = (s: Session) => (s.source === "easy" ? s.easy : s.original);

/** 今の内容の指紋（確認済みのあとに何か変わったかを見分ける） */
export function fingerprint(s: Session): string {
  return JSON.stringify([s.original, s.easy, s.langs.map((l) => s.translations[l]?.text ?? "")]);
}

/** 原文かやさしい日本語が変わったら、照合をやり直し、確認済みを取り消す */
export function setTexts(s: Session, original: string, easy: string, glossary: GlossaryTerm[]): Session {
  const warnings = original.trim() && easy.trim() ? check(original, easy, glossary) : [];
  // 同じ警告がまだ残っていれば、確認した記録は残す
  const acknowledged = Object.fromEntries(Object.entries(s.acknowledged).filter(([id]) => warnings.some((w) => w.id === id)));
  return { ...s, original, easy, warnings, acknowledged, confirmed: null };
}

export function setSource(s: Session, source: TranslationSource): Session {
  return { ...s, source, confirmed: null };
}

export function setLangs(s: Session, langs: string[]): Session {
  return { ...s, langs, confirmed: null };
}

/** 翻訳の結果を入れる（用語の統一と数字の照合も行う） */
export function setTranslation(
  s: Session,
  lang: string,
  result: { text: string; adapter: string } | { error: string; adapter: string },
  glossary: GlossaryTerm[],
): Session {
  const basis = basisOf(s);
  const t: TranslationState =
    "error" in result
      ? { lang, text: "", basis, adapter: result.adapter, replacements: [], warnings: [], error: result.error }
      : (() => {
          const c = checkTranslation(basis, result.text, lang, glossary);
          return { lang, text: c.text, basis, adapter: result.adapter, replacements: c.replacements, warnings: c.warnings };
        })();
  return { ...s, translations: { ...s.translations, [lang]: t }, confirmed: null };
}

/** 先生が訳を手で直したとき（直した訳は、そのまま使う。数字の照合だけやり直す） */
export function editTranslation(s: Session, lang: string, text: string, glossary: GlossaryTerm[]): Session {
  const prev = s.translations[lang];
  if (!prev) return s;
  const c = checkTranslation(prev.basis, text, lang, glossary);
  return {
    ...s,
    translations: { ...s.translations, [lang]: { ...prev, text, warnings: c.warnings, adapter: "先生が修正", error: undefined } },
    confirmed: null,
  };
}

export function isStale(s: Session, lang: string): boolean {
  const t = s.translations[lang];
  return !t || t.basis !== basisOf(s) || !!t.error;
}

export function acknowledge(s: Session, ids: string[], at: string): Session {
  const acknowledged = { ...s.acknowledged };
  for (const id of ids) acknowledged[id] = at;
  return { ...s, acknowledged };
}

export function unacknowledged(s: Session): Warning[] {
  return s.warnings.filter((w) => !s.acknowledged[w.id]);
}

/** 確認済みにできるか。できない理由を、先生に見せる文で返す */
export function confirmBlockers(s: Session): string[] {
  const reasons: string[] = [];
  if (!s.original.trim()) reasons.push("原文がありません");
  if (!s.easy.trim()) reasons.push("やさしい日本語がありません");
  const open = unacknowledged(s);
  if (open.length > 0) reasons.push(`照合の警告が${open.length}件あります。文を直すか、内容を見て「内容を確認して進む」を押してください`);
  const stale = s.langs.filter((l) => isStale(s, l));
  if (stale.length > 0) reasons.push("翻訳を作り直してください（やさしい日本語か原文が変わったか、まだ翻訳していません）");
  return reasons;
}

export function confirm(s: Session): Session {
  if (confirmBlockers(s).length > 0) return s;
  return { ...s, confirmed: fingerprint(s) };
}

/** 児童向けの画面に表示してよいか（確認済みで、そのあと何も変わっていない） */
export function canDisplay(s: Session): boolean {
  return s.confirmed !== null && s.confirmed === fingerprint(s);
}
