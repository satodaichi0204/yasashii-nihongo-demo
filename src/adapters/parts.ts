// 部品の組み立て。見本の指示を選んだときと、マイクで話したときで、使う部品が変わる。
import { langOf } from "../data/languages";
import { stripRuby } from "../text/ruby";
import type { GlossaryTerm } from "../types";
import { simpleEasy } from "./simpleEasy";
import type { EasyPart, TranslatePart } from "./types";

/** やさしい日本語化：見本の変換（正しい変換と、AIがよく起こす間違いの例） */
export const sampleEasy: EasyPart = {
  id: "sample-easy",
  label: "見本の変換",
  note: "見本として用意した変換です（正しい変換と、AIがよく起こす間違いの例）。",
  async convert({ sample, variant = 0 }) {
    if (!sample) return "";
    return variant === 0 ? stripRuby(sample.easyRuby) : sample.mistakes[variant - 1].text;
  },
};

/** やさしい日本語化：簡易変換（規則） */
export function createSimpleEasy(getGlossary: () => GlossaryTerm[]): EasyPart {
  return {
    id: "simple-easy",
    label: "簡易変換",
    note: "簡易変換（デモ用の規則）。本番では生成AIで変換します。",
    async convert({ original }) {
      return simpleEasy(original, getGlossary());
    },
  };
}

/** 翻訳：見本の参考訳（正しいやさしい日本語から訳したもの） */
export const referenceTranslate: TranslatePart = {
  id: "reference",
  label: "参考訳",
  note: "参考訳（デモ用）。見本の正しいやさしい日本語から、あらかじめ訳したものです。",
  async translate({ sample, lang, fromEasy, easyIsSample }) {
    if (!sample || !fromEasy || !easyIsSample) return { error: "参考訳は、見本の正しいやさしい日本語の訳だけです。" };
    const text = sample.translations[lang];
    return text ? { text } : { error: `${langOf(lang).label}の参考訳は用意していません。` };
  },
};

type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<{ translate(text: string): Promise<string> }>;
};

const translatorApi = (): TranslatorApi | undefined => (self as unknown as { Translator?: TranslatorApi }).Translator;
const NOT_AVAILABLE = "この環境ではデモ用の翻訳が使えません。本番では翻訳サービスで訳します。";

/** 翻訳：ブラウザの中で訳す機能（Chrome の Translator API）。使えない環境では、その旨を返す */
export function createBrowserTranslate(): TranslatePart {
  type Translator = { translate(text: string): Promise<string> };
  const cache = new Map<string, Translator>();
  // 翻訳の準備（create）を同時に2つ行うと失敗するため、1つずつ順番に行う（Chrome 152 で確認）
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };
  return {
    id: "browser-translate",
    label: "ブラウザ内の翻訳",
    note: "ブラウザの中で動く翻訳（Chrome の Translator API）。文は外部に送られません。使えない環境では、本番の翻訳サービスに差し替える前提です。",
    async translate({ text, lang }, onProgress) {
      const api = translatorApi();
      if (!api) return { error: NOT_AVAILABLE };
      const target = langOf(lang).translatorCode;
      try {
        const avail = await api.availability({ sourceLanguage: "ja", targetLanguage: target });
        if (avail === "unavailable") return { error: `${NOT_AVAILABLE}（日本語→${langOf(lang).label}は、このブラウザでは使えません）` };
        let t = cache.get(target);
        if (!t) {
          if (avail !== "available") onProgress?.(`${langOf(lang).label}の翻訳の準備（ダウンロード）を始めました…`);
          const create = () =>
            api.create({
              sourceLanguage: "ja",
              targetLanguage: target,
              monitor(m) {
                m.addEventListener("downloadprogress", (e) => {
                  const loaded = (e as Event & { loaded: number }).loaded;
                  onProgress?.(`${langOf(lang).label}の翻訳を準備中… ${Math.round(loaded * 100)}%`);
                });
              },
            });
          // まれに準備に失敗することがあるため、少し待って1回だけやり直す
          const created: Translator = await serial(() => create().catch(() => new Promise<void>((r) => setTimeout(r, 600)).then(create)));
          cache.set(target, created);
          t = created;
        }
        return { text: await t.translate(text) };
      } catch (e) {
        const message = (e as Error).message;
        // 初めて使う言語は、ボタンを押したとき（ユーザーの操作）にだけ、翻訳の準備（ダウンロード）を始められる
        if (/user gesture/i.test(message)) {
          return { error: `${langOf(lang).label}の翻訳は、初めて使うときに準備（ダウンロード）が必要です。「翻訳を作り直す」を押してください。` };
        }
        return { error: `${NOT_AVAILABLE}（${message}）` };
      }
    },
  };
}

/** ブラウザ内の翻訳が使えるか（画面の表示用。言語の組み合わせは訳すときに確かめる） */
export const browserTranslateExists = () => !!translatorApi();
