// 意味の取りこぼしの照合：原文にあって、やさしい日本語で消えた要素を見つける。
import { normalize, toRawSpan, type Normalized } from "../text/normalize";
import type { ElementKind, GlossaryTerm, Span, Warning } from "../types";
import {
  findConditions,
  findDemonstratives,
  findNegations,
  findOrders,
  findQuantities,
  findRestatements,
  stepKeys,
  type Hit,
  type OrderClass,
  type Quantity,
} from "./rules";

const ORDER_LABEL: Record<OrderClass, string> = { first: "はじめの手順", then: "手順のつながり", last: "最後の手順" };

const quote = (h: Hit[]) => h.map((x) => `「${x.text}」`).join("");
const spans = (n: Normalized, hits: Hit[]): Span[] => hits.map((h) => toRawSpan(n, h.start, h.end));

/** 数量 q が、変換後の数量の中にあるか（単位なしの数字は、同じ数字があればよい） */
function hasQuantity(q: Quantity, list: Quantity[], targetText: string): boolean {
  return list.some((t) => {
    if (t.value !== q.value) return false;
    if (q.unit === "" || t.unit === q.unit) return true;
    // 「4ページ」が「ページは 4」のように離れて書かれていても、単位の言葉があればよい
    return t.unit === "" && targetText.includes(q.unit);
  });
}

export function check(original: string, converted: string, glossary: GlossaryTerm[] = []): Warning[] {
  const src = normalize(original);
  const dst = normalize(converted);
  const S = src.text;
  const D = dst.text;
  const warnings: Warning[] = [];
  const add = (kind: ElementKind, key: string, message: string, sourceHits: Hit[], targetHits: Hit[] = []) =>
    warnings.push({
      id: `${kind}:${key}`,
      kind,
      message,
      sourceSpans: spans(src, sourceHits),
      targetSpans: spans(dst, targetHits),
    });

  // --- 言い直し ---
  const restates = findRestatements(S);
  const droppedQuantities = new Set<string>();
  for (const r of restates) {
    for (const q of findQuantities(r.before.text)) droppedQuantities.add(`${q.value}${q.unit}`);
    const remain = findQuantities(D).filter((q) => findQuantities(r.before.text).some((b) => b.value === q.value && b.unit === q.unit));
    const remainWord = remain.length === 0 && !/\d/.test(r.before.text) && D.includes(r.before.text);
    if (remain.length > 0 || remainWord) {
      const targetHits = remain.length > 0 ? remain : [{ start: D.indexOf(r.before.text), end: D.indexOf(r.before.text) + r.before.text.length, text: r.before.text }];
      add(
        "restatement",
        r.before.text,
        `言い直す前の「${r.before.text}」が、やさしい日本語に残っています。先生が言い直した後の内容だけにしてください。`,
        [r.before, r.marker],
        targetHits,
      );
    }
  }

  // --- 否定 ---
  const negS = findNegations(S);
  const negD = findNegations(D);
  if (negS.length > negD.length) {
    add(
      "negation",
      String(negS.length),
      negD.length === 0
        ? `原文の否定${quote(negS)}が、やさしい日本語では消えています。「しない」「してはいけない」が「する」に変わっていないか確かめてください。`
        : `原文には否定が${negS.length}つ${quote(negS)}ありますが、やさしい日本語には${negD.length}つしかありません。`,
      negS,
    );
  }

  // --- 順序 ---
  const ordS = findOrders(S);
  const ordD = findOrders(D);
  for (const cls of ["first", "then", "last"] as OrderClass[]) {
    const a = ordS.filter((h) => h.cls === cls);
    const b = ordD.filter((h) => h.cls === cls);
    if (a.length > b.length) {
      add("order", cls, `原文の順序の言葉${quote(a)}（${ORDER_LABEL[cls]}）が、やさしい日本語で消えています。`, a);
    }
  }
  if (ordS.length > 0) {
    // 手順の目印の語を、原文の順に、変換後の文の前から順に探していく。
    // 前の手順より後ろに見つからず、前にだけあれば、順番が入れ替わっている
    let cursor = 0;
    let prev: (Hit & { pos: number }) | null = null;
    for (const k of stepKeys(S)) {
      const pos = D.indexOf(k.text, cursor);
      if (pos >= 0) {
        cursor = pos;
        prev = { ...k, pos };
        continue;
      }
      const earlier = D.indexOf(k.text);
      if (earlier >= 0 && prev) {
        add(
          "order",
          `swap:${k.text}`,
          `手順の順番が入れ替わっています。原文では「${prev.text}」が「${k.text}」より先です。`,
          [prev, k],
          [
            { start: earlier, end: earlier + k.text.length, text: k.text },
            { start: prev.pos, end: prev.pos + prev.text.length, text: prev.text },
          ],
        );
        break;
      }
    }
  }

  // --- 数量 ---
  const qD = findQuantities(D);
  const missing = findQuantities(S).filter((q) => !droppedQuantities.has(`${q.value}${q.unit}`) && !hasQuantity(q, qD, D));
  if (missing.length > 0) {
    add(
      "quantity",
      missing.map((q) => q.text).join(","),
      `原文の数量${quote(missing)}が、やさしい日本語で見つかりません。数字や単位が変わっていないか確かめてください。`,
      missing,
    );
  }

  // --- 条件 ---
  const condS = findConditions(S);
  const condD = findConditions(D);
  if (condS.length > condD.length) {
    add(
      "condition",
      String(condS.length),
      `原文の条件${quote(condS)}が、やさしい日本語で消えています。「〜なら」「〜たら」「〜とき」などの条件が抜けると、全員がすることに変わってしまいます。`,
      condS,
    );
  }

  // --- 教科の用語 ---
  for (const g of glossary) {
    const at = S.indexOf(g.term);
    if (at < 0) continue;
    if (D.includes(g.term) || (g.reading && D.includes(g.reading))) continue;
    add(
      "term",
      g.term,
      `教科の用語「${g.term}」が、やさしい日本語で消えています。授業で覚える言葉なので、言い換えずに残し、ふりがなや説明を付けてください。`,
      [{ start: at, end: at + g.term.length, text: g.term }],
    );
  }

  // --- 指示語 ---
  const dem = findDemonstratives(D);
  if (dem.length > 0) {
    add(
      "demonstrative",
      dem.map((d) => d.text).join(","),
      `やさしい日本語に${quote(dem)}が残っています。児童向けの画面では何を指すか伝わらないため、具体的な言葉にしてください。`,
      findDemonstratives(S),
      dem,
    );
  }

  return warnings;
}
