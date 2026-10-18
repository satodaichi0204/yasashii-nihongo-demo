/** 意味の取りこぼしの照合で見る要素 */
export type ElementKind = "negation" | "order" | "quantity" | "condition" | "term" | "demonstrative" | "restatement";

export const ELEMENT_LABEL: Record<ElementKind, string> = {
  negation: "否定",
  order: "順序",
  quantity: "数量",
  condition: "条件",
  term: "教科の用語",
  demonstrative: "指示語",
  restatement: "言い直し",
};

export const ELEMENT_KINDS = Object.keys(ELEMENT_LABEL) as ElementKind[];

/** 文字列の中の位置（start は含み、end は含まない） */
export type Span = { start: number; end: number };

export type Warning = {
  /** 先生が「確認して進む」を押したかを覚えるための識別子 */
  id: string;
  kind: ElementKind;
  message: string;
  /** 原文のどこから消えたか */
  sourceSpans: Span[];
  /** 変換後のどこに問題があるか（指示語、言い直し） */
  targetSpans: Span[];
};

/** 用語集の1語 */
export type GlossaryTerm = {
  term: string;
  reading: string;
  /** 児童向けのやさしい説明 */
  easy: string;
  /** 学校で決めた訳（言語コード → 訳） */
  translations: Record<string, string>;
  /** よくある別の訳。翻訳の中で見つけたら、学校で決めた訳に置き換える */
  aliases: Record<string, string[]>;
  subject: string;
};

export type Mistake = { text: string; drops: ElementKind[]; note: string };

/** 見本の先生の指示 */
export type Sample = {
  id: string;
  subject: string;
  scene: string;
  original: string;
  /** 正しいやさしい日本語。[漢字|よみ] でふりがなを付ける */
  easyRuby: string;
  /** AIがよく起こす間違いの例（2つ） */
  mistakes: Mistake[];
  /** 正しいやさしい日本語から訳した参考訳（言語コード → 訳） */
  translations: Record<string, string>;
  /** この件で守るべき要素（照合の正解） */
  elements: ElementKind[];
};
