// 照合の規則。原文と変換後の文から、否定、順序、数量、条件、用語、指示語、言い直しの手がかりを取り出す。
// どれも「見逃すより、警告を出す側に倒す」方針で作っている。
import { kanjiToNumber } from "../text/normalize";

export type Hit = { start: number; end: number; text: string };

/** 決まった範囲を、長さを変えずに「□」で塗りつぶす（ほかの規則に拾わせないため） */
export function mask(text: string, patterns: RegExp[]): string {
  let out = text;
  for (const p of patterns) {
    out = out.replace(new RegExp(p.source, "g"), (m) => "□".repeat(m.length));
  }
  return out;
}

export function findAll(text: string, pattern: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(new RegExp(pattern.source, "g"))) {
    if (m[0].length === 0) continue;
    hits.push({ start: m.index!, end: m.index! + m[0].length, text: m[0] });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// 言い直し（「3ページ、いや4ページ」「52ページじゃなくて53ページ」）
// ---------------------------------------------------------------------------
const RESTATE_MARK = /(?:あ、?)?いや(?=[、,]|\d|問|第)|じゃなくて|じゃなく|ではなくて|ちがった|違った|まちがえた|間違えた/;

export type Restatement = { marker: Hit; before: Hit };

export function findRestatements(text: string): Restatement[] {
  const out: Restatement[] = [];
  for (const marker of findAll(text, RESTATE_MARK)) {
    // 言い直す前の内容：直前の区切り（、。）から、言い直しの言葉まで
    let end = marker.start;
    while (end > 0 && /[、,\s]/.test(text[end - 1])) end--;
    let start = end;
    while (start > 0 && !/[、,。！？!?]/.test(text[start - 1])) start--;
    const before = text.slice(start, end);
    if (!before) continue;
    // 前の部分が長いときは、数量か、最後の語だけを「言い直す前の内容」とみなす
    const q = findQuantities(before);
    if (q.length > 0) {
      const last = q[q.length - 1];
      out.push({ marker, before: { start: start + last.start, end: start + last.end, text: last.text } });
    } else {
      const word = before.match(/[一-鿿゠-ヿA-Za-z0-9]+$/)?.[0] ?? before;
      out.push({ marker, before: { start: end - word.length, end, text: word } });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 否定
// ---------------------------------------------------------------------------
/** 否定に見えて否定ではない言葉（義務、可能性、形容詞） */
const NOT_NEGATION = [
  /なければ(?:なりません|ならない|いけません|いけない)/,
  /なくては(?:いけません|いけない|なりません|ならない)/,
  /ないと(?:いけません|いけない|だめ)/,
  /なきゃ/,
  /かもしれ(?:ない|ません)/,
  /少な(?=い|く)|すくな(?=い|く)|危な(?=い|く)|あぶな(?=い|く)|きたな(?=い|く)|汚な/,
  /かならず|必ず|まず|はず|みず/,
  RESTATE_MARK,
];
const NEGATION =
  /てはいけません|てはいけない|ではいけません|ではいけない|ちゃだめ|ちゃいけない|てはだめ|ないでください|ないように|ないで|ません|ずに|なくて|なく|なかった|ない|禁止|だめ|ダメ/;

export function findNegations(text: string): Hit[] {
  return findAll(mask(text, NOT_NEGATION), NEGATION).map((h) => ({ ...h, text: text.slice(h.start, h.end) }));
}

// ---------------------------------------------------------------------------
// 順序
// ---------------------------------------------------------------------------
export type OrderClass = "first" | "then" | "last";
const ORDER: Record<OrderClass, RegExp> = {
  first: /まず|はじめに|初めに|最初に|さいしょに/,
  then: /次に|つぎに|それから|その後で?|そのあとで?|終わってから|おわってから|終わった後で?|おわったあとで?|終わったら|おわったら|済んだら|すんだら|てから|でから|たあとで?|だあとで?/,
  last: /最後に|さいごに|終わりに|おわりに/,
};

export function findOrders(text: string): (Hit & { cls: OrderClass })[] {
  const hits: (Hit & { cls: OrderClass })[] = [];
  let masked = text;
  for (const cls of ["first", "last", "then"] as OrderClass[]) {
    for (const h of findAll(masked, ORDER[cls])) hits.push({ ...h, text: text.slice(h.start, h.end), cls });
    masked = mask(masked, [ORDER[cls]]);
  }
  return hits.sort((a, b) => a.start - b.start);
}

/** 手順の並びを見るための、各手順の目印の語（最初の漢字かカタカナのまとまり） */
const STOP_WORDS = new Set(["人", "方", "時", "中", "上", "下", "前", "後", "日", "今", "次", "最後", "最初", "先生", "全部", "自分"]);

export function stepKeys(text: string): Hit[] {
  const keys: Hit[] = [];
  const seen = new Set<string>();
  // 順序の言葉と句読点で手順に区切る（順序の言葉そのものは手順に数えない）
  const orders = findOrders(text);
  const cuts = [0];
  for (const h of orders) cuts.push(h.start, h.end);
  for (const m of text.matchAll(/[、。,]/g)) cuts.push(m.index! + 1);
  cuts.push(text.length);
  const bounds = [...new Set(cuts)].sort((a, b) => a - b);
  for (let i = 0; i < bounds.length - 1; i++) {
    if (orders.some((o) => o.start === bounds[i] && o.end === bounds[i + 1])) continue;
    const seg = text.slice(bounds[i], bounds[i + 1]);
    for (const m of seg.matchAll(/[一-鿿々]+|[ァ-ーー]{2,}/g)) {
      if (STOP_WORDS.has(m[0]) || seen.has(m[0])) continue;
      seen.add(m[0]);
      keys.push({ start: bounds[i] + m.index!, end: bounds[i] + m.index! + m[0].length, text: m[0] });
      break;
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// 条件
// ---------------------------------------------------------------------------
const NOT_CONDITION = [
  ORDER.then,
  /なければ(?:なりません|ならない|いけません|いけない)/,
  /ときどき|時々|あたらし|新し|はたら|だらけ|たらい/,
  // 「当たらない」「入らない」などの「ら」は、条件の「たら」ではない
  /[たっだ]ら(?=な|ず|せ)/,
];
const CONDITION = /もし|場合|ならば|なら(?=[、,。]|$)|ただし|ときは|時は|ときに|とき|たら|だら|れば/;
/** 条件の始まりの言葉。同じ文の中に条件の終わり（〜たら、〜場合）があれば、合わせて1つの条件と数える */
const OPENER = /^(?:もし|ただし)$/;

export function findConditions(text: string): Hit[] {
  const hits = findAll(mask(text, NOT_CONDITION), CONDITION).map((h) => ({ ...h, text: text.slice(h.start, h.end) }));
  return hits.filter((h, i) => {
    if (!OPENER.test(h.text)) return true;
    const next = hits[i + 1];
    return !(next && !OPENER.test(next.text) && !text.slice(h.end, next.start).includes("。"));
  });
}

// ---------------------------------------------------------------------------
// 数量（数字と単位の組）
// ---------------------------------------------------------------------------
const UNITS: [RegExp, string][] = [
  [/ページ/, "ページ"],
  [/問目|問/, "問"],
  [/段落目|段落/, "段落"],
  [/行目|行/, "行"],
  [/つ目/, "つ"],
  [/番目|番/, "番"],
  [/年生/, "年生"],
  [/回目|回/, "回"],
  [/人/, "人"],
  [/組/, "組"],
  [/枚/, "枚"],
  [/本/, "本"],
  [/個/, "個"],
  [/冊/, "冊"],
  [/文字|字/, "字"],
  [/マス/, "マス"],
  [/時間/, "時間"],
  [/分間|分/, "分"],
  [/秒/, "秒"],
  [/時/, "時"],
  [/週間/, "週間"],
  [/か月|ヶ月|カ月/, "か月"],
  [/日/, "日"],
  [/年/, "年"],
  [/歳|才/, "歳"],
  [/度/, "度"],
  [/点/, "点"],
  [/班/, "班"],
  [/列/, "列"],
  [/円/, "円"],
  [/ミリリットル|mL|ml/, "mL"],
  [/リットル|L(?![a-zA-Z])/, "L"],
  [/センチメートル|センチ|cm/, "cm"],
  [/ミリメートル|ミリ|mm/, "mm"],
  [/キロメートル|km/, "km"],
  [/メートル|m(?![a-zA-Z])/, "m"],
  [/キログラム|kg/, "kg"],
  [/グラム|g(?![a-zA-Z])/, "g"],
  [/つ/, "つ"],
];
const UNIT_SOURCE = UNITS.map(([r]) => r.source).join("|");
const QUANTITY = new RegExp(`(問|第)?(\\d+(?:\\.\\d+)?)(${UNIT_SOURCE})?`);
const KANJI_QUANTITY = new RegExp(`[〇一二三四五六七八九十百千]+(?=${UNIT_SOURCE})`);
const KANA_COUNT: [RegExp, string][] = [
  [/ひとり/, "1人"],
  [/ふたり/, "2人"],
  [/ひとつ/, "1つ"],
  [/ふたつ/, "2つ"],
  [/みっつ/, "3つ"],
  [/よっつ/, "4つ"],
  [/いつつ/, "5つ"],
];

export type Quantity = Hit & { value: number; unit: string };

function unitOf(s: string | undefined): string {
  if (!s) return "";
  for (const [r, u] of UNITS) if (new RegExp(`^(?:${r.source})$`).test(s)) return u;
  return s;
}

export function findQuantities(text: string): Quantity[] {
  // 漢数字とかなの数え方を、同じ長さのまま数字に置き換えてから探す（位置がずれないよう、余りは前を空白で埋める）
  let t = text;
  for (const h of findAll(text, KANJI_QUANTITY)) {
    // 「もう一度」の「一度」は回数の言い回しで、数量ではない
    if (h.text === "一" && text[h.end] === "度") continue;
    const n = kanjiToNumber(h.text);
    if (n === null) continue;
    const s = String(n);
    if (s.length <= h.text.length) t = t.slice(0, h.start) + s.padStart(h.text.length, "　") + t.slice(h.end);
  }
  for (const [r, rep] of KANA_COUNT) {
    t = t.replace(new RegExp(r.source, "g"), (m) => rep.padStart(m.length, "　"));
  }
  const out: Quantity[] = [];
  for (const m of t.matchAll(new RegExp(QUANTITY.source, "g"))) {
    const [, prefix, num, unitText] = m;
    let unit = unitOf(unitText);
    if (prefix === "問") unit = "問";
    // 「2つ目」と「2つ」は同じ数として扱う
    out.push({ start: m.index!, end: m.index! + m[0].length, text: text.slice(m.index!, m.index! + m[0].length).trim(), value: Number(num), unit });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 指示語（児童向けの画面では何を指すか伝わらない）
// ---------------------------------------------------------------------------
const DEMONSTRATIVE = /あそこ|ここ|そこ|これ(?!から|まで)|あれ(?!ば)|この|その(?!後|あと|まま|ほか)|あの/;

export function findDemonstratives(text: string): Hit[] {
  return findAll(mask(text, [/それから|これから|それぞれ|そこで/]), DEMONSTRATIVE).map((h) => ({
    ...h,
    text: text.slice(h.start, h.end),
  }));
}
