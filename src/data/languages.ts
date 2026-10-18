// 翻訳の言語の一覧。ここに1行足すと、設定で選べるようになる（用語集の訳は用語集の画面で足す）。
export type Language = {
  code: string;
  label: string;
  /** その言語での言語名（児童向けの画面の見出し） */
  native: string;
  /** ブラウザ内の翻訳（Translator API）に渡す言語コード */
  translatorCode: string;
};

export const LANGUAGES: Language[] = [
  { code: "pt", label: "ポルトガル語", native: "Português", translatorCode: "pt" },
  { code: "zh", label: "中国語（簡体字）", native: "中文", translatorCode: "zh" },
  { code: "en", label: "英語", native: "English", translatorCode: "en" },
  { code: "vi", label: "ベトナム語", native: "Tiếng Việt", translatorCode: "vi" },
  { code: "es", label: "スペイン語", native: "Español", translatorCode: "es" },
  { code: "tl", label: "フィリピノ語", native: "Filipino", translatorCode: "fil" },
];

export const DEFAULT_LANGS = ["pt", "zh"];

export const langOf = (code: string) => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
