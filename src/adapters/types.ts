// 差し替えられる部品の「差し込み口」。音声認識、やさしい日本語化、翻訳を、同じ形で作る。
// 本番では、この形のまま中身だけを外部のサービスにつなぎ替える（画面と照合は変えない）。
import type { Sample } from "../types";

export type PartInfo = {
  id: string;
  /** 画面の隅の「今使っている部品」に出す名前 */
  label: string;
  /** 正直な説明（デモ用であること、本番での差し替え先） */
  note: string;
};

/** 音声認識：録音を始めて、止めたら文字にする */
export interface SpeechPart extends PartInfo {
  supported(): boolean;
  start(handlers: { onInterim: (text: string) => void; onError: (message: string) => void }): void;
  /** 止めて、確定した文を返す（無音なら空文字） */
  stop(): Promise<string>;
  abort(): void;
}

export type EasyInput = { original: string; sample?: Sample; variant?: number };

/** やさしい日本語化 */
export interface EasyPart extends PartInfo {
  convert(input: EasyInput): Promise<string>;
}

export type TranslateInput = { text: string; lang: string; sample?: Sample; fromEasy: boolean; easyIsSample: boolean };

/** 翻訳。訳せない場合は error を返す（理由を先生に見せる） */
export interface TranslatePart extends PartInfo {
  translate(input: TranslateInput, onProgress?: (message: string) => void): Promise<{ text: string } | { error: string }>;
}
