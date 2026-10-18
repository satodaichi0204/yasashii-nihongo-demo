// 用語集と定型文。ブラウザの中（localStorage）だけに保存する。外部には送らない。
import initialGlossary from "../data/glossary.json";
import type { GlossaryTerm } from "../types";

const GLOSSARY_KEY = "yasashii-demo.glossary.v1";
const PHRASES_KEY = "yasashii-demo.phrases.v1";
const SETTINGS_KEY = "yasashii-demo.settings.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境（プライベートウィンドウなど）では、画面を閉じるまでだけ覚えておく
  }
}

export const defaultGlossary = () => structuredClone(initialGlossary) as GlossaryTerm[];
export const loadGlossary = (): GlossaryTerm[] => read(GLOSSARY_KEY, defaultGlossary());
export const saveGlossary = (g: GlossaryTerm[]) => write(GLOSSARY_KEY, g);

/** 定型文：確認済みの文をまるごと保存する */
export type Phrase = {
  id: string;
  title: string;
  original: string;
  easyRuby: string;
  translations: Record<string, string>;
  savedAt: string;
};
export const loadPhrases = (): Phrase[] => read(PHRASES_KEY, []);
export const savePhrases = (p: Phrase[]) => write(PHRASES_KEY, p);

export type Settings = { langs: string[]; source: "original" | "easy"; showGlossaryEasy: boolean };
export const loadSettings = (fallback: Settings): Settings => ({ ...fallback, ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);
