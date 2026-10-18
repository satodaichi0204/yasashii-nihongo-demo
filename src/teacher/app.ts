// 教師用の画面の枠：ページの切り替え、共有の状態、児童向けの画面の開き方、今使っている部品の表示。
import { createBrowserTranslate, createSimpleEasy, referenceTranslate, sampleEasy } from "../adapters/parts";
import { createWebSpeech } from "../adapters/speech";
import type { EasyPart, TranslatePart } from "../adapters/types";
import { Channel, type DisplayOptions, type DisplayPayload } from "../channel/channel";
import { DEFAULT_LANGS } from "../data/languages";
import { loadGlossary, loadSettings, saveSettings, type Settings } from "../glossary/store";
import type { GlossaryTerm, Sample } from "../types";
import { $, esc } from "../ui/dom";
import { renderLesson } from "./lesson";
import { renderDataPage, renderGlossaryPage, renderPartsPage, renderPhrasesPage, renderResultsPage } from "./pages";
import { newSession, type Session } from "./session";

export type Timings = { speech?: number; easy?: number; check?: number; translate?: number; review?: number };

export type AppState = {
  glossary: GlossaryTerm[];
  settings: Settings;
  session: Session;
  sample: Sample | null;
  variant: number;
  /** 指示をどこから入れたか */
  inputMode: "sample" | "mic" | "phrase" | "text";
  timings: Timings;
  /** やさしい日本語ができた時刻（先生の確認にかかった時間を測る） */
  readyAt: number | null;
  ackLog: { at: string; kind: string; message: string }[];
  display: DisplayOptions;
  shown: DisplayPayload | null;
  studentConnected: boolean;
  parts: { speech: string; easy: string; translate: string };
};

export const speechPart = createWebSpeech();
export const easyParts: Record<"sample" | "simple", EasyPart> = { sample: sampleEasy, simple: createSimpleEasy(() => state.glossary) };
export const translateParts: Record<"reference" | "browser", TranslatePart> = { reference: referenceTranslate, browser: createBrowserTranslate() };

const settings = loadSettings({ langs: DEFAULT_LANGS, source: "easy", showGlossaryEasy: true });

export const state: AppState = {
  glossary: loadGlossary(),
  settings,
  session: newSession(settings.langs, settings.source),
  sample: null,
  variant: 0,
  inputMode: "sample",
  timings: {},
  readyAt: null,
  ackLog: [],
  display: { original: false, easy: true, ruby: true, langs: [...settings.langs], cards: false, scale: 1 },
  shown: null,
  studentConnected: false,
  parts: { speech: "見本（音声認識なし）", easy: "—", translate: "—" },
};

export function updateSettings(patch: Partial<Settings>) {
  state.settings = { ...state.settings, ...patch };
  saveSettings(state.settings);
}

// ------------------------------------------------------------------ 児童向けの画面
let studentWindow: Window | null = null;
const listeners = new Set<() => void>();
export const onAppChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const notify = () => listeners.forEach((fn) => fn());

export const channel = new Channel((m) => {
  if (m.type === "hello") {
    state.studentConnected = true;
    // 開き直した児童向けの画面に、表示中の内容をもう一度送る
    if (state.shown) channel.send({ type: "show", payload: state.shown, options: state.display });
    notify();
  } else if (m.type === "bye") {
    state.studentConnected = false;
    notify();
  }
});
setInterval(() => {
  if (studentWindow && studentWindow.closed && state.studentConnected) {
    state.studentConnected = false;
    notify();
  }
}, 1500);

type ScreenDetailed = { label?: string; availLeft: number; availTop: number; availWidth: number; availHeight: number; isPrimary: boolean };
type ScreenDetails = { screens: ScreenDetailed[]; currentScreen: ScreenDetailed };

/** 拡張ディスプレイの情報。Window Management API が使えて、すでに許可されているときだけ返す */
async function extendedScreen(requestPermission: boolean): Promise<{ screen: ScreenDetailed | null; message: string }> {
  const w = window as unknown as { getScreenDetails?: () => Promise<ScreenDetails> };
  if (!w.getScreenDetails) return { screen: null, message: "このブラウザでは、拡張ディスプレイの位置を調べられません。ウィンドウを拡張ディスプレイへ手で移動してください。" };
  try {
    const perm = await navigator.permissions.query({ name: "window-management" as PermissionName });
    if (perm.state === "denied") return { screen: null, message: "拡張ディスプレイの使用が許可されていません。ウィンドウを手で移動してください。" };
    if (perm.state === "prompt" && !requestPermission) return { screen: null, message: "" };
  } catch {
    // 権限の問い合わせができない環境では、そのまま試す
  }
  try {
    const d = await w.getScreenDetails();
    const other = d.screens.find((s) => s !== d.currentScreen && !s.isPrimary) ?? d.screens.find((s) => s !== d.currentScreen) ?? null;
    return other
      ? { screen: other, message: "" }
      : { screen: null, message: "拡張ディスプレイが見つかりません（画面が1つです）。拡張ディスプレイをつないでから開き直してください。" };
  } catch {
    return { screen: null, message: "拡張ディスプレイの位置を調べられませんでした。ウィンドウを手で移動してください。" };
  }
}

/** 拡張ディスプレイの使用を許可してもらう（ボタンを押したときだけ） */
export async function requestScreenPermission(): Promise<string> {
  const r = await extendedScreen(true);
  return r.screen ? `拡張ディスプレイ「${r.screen.label || "2つ目の画面"}」が使えます。もう一度「児童向けの画面を開く」を押してください。` : r.message;
}

export async function openStudentWindow(): Promise<string> {
  const url = `${location.href.split("#")[0]}#student`;
  const { screen, message } = await extendedScreen(false);
  const features = screen
    ? `popup,left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight}`
    : "popup,width=1280,height=760";
  const w = window.open(url, "yasashii-student", features);
  if (!w) return "ウィンドウを開けませんでした。ブラウザのポップアップの設定で、このページを許可してください。";
  studentWindow = w;
  channel.addPeer(w);
  if (screen) {
    try {
      w.moveTo(screen.availLeft, screen.availTop);
      w.resizeTo(screen.availWidth, screen.availHeight);
    } catch {
      // 移動できなくても、表示はできる
    }
    return `拡張ディスプレイ「${screen.label || "2つ目の画面"}」に開きました。児童向けの画面の「全画面にする」を押すと、全画面になります。`;
  }
  return message || "別のウィンドウで開きました。拡張ディスプレイへ手で移動し、「全画面にする」を押してください。拡張ディスプレイに自動で出すには、下の「拡張ディスプレイを使う」を押して許可してください。";
}

// ------------------------------------------------------------------ ページの切り替え
const PAGES: { hash: string; label: string; render: (el: HTMLElement) => void | (() => void) }[] = [
  { hash: "#/", label: "授業（教師用）", render: renderLesson },
  { hash: "#/glossary", label: "教科の用語集", render: renderGlossaryPage },
  { hash: "#/phrases", label: "定型文", render: renderPhrasesPage },
  { hash: "#/results", label: "検証結果", render: renderResultsPage },
  { hash: "#/parts", label: "本番での差し替えの考え方", render: renderPartsPage },
  { hash: "#/data", label: "データの扱い", render: renderDataPage },
];

export function mountApp(root: HTMLElement) {
  root.innerHTML = `
    <header class="topbar">
      <div class="brand">やさしい日本語＋多言語 教室表示<small>デモ版（APIキー不使用・ブラウザだけで動作）</small></div>
      <nav class="nav" aria-label="ページ">${PAGES.map((p) => `<a href="${p.hash}">${esc(p.label)}</a>`).join("")}</nav>
      <span class="spacer"></span>
      <span class="demo-flag">デモ：生成AIは使っていません</span>
    </header>
    <main id="page"></main>
    <aside class="parts" id="parts" aria-label="今使っている部品"></aside>`;
  const page = $(root, "#page");
  let cleanup: (() => void) | void;

  const route = () => {
    const current = PAGES.find((p) => p.hash === (location.hash || "#/")) ?? PAGES[0];
    root.querySelectorAll(".nav a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === current.hash ? "page" : "false"));
    if (typeof cleanup === "function") cleanup();
    page.innerHTML = "";
    cleanup = current.render(page);
    window.scrollTo(0, 0);
  };
  window.addEventListener("hashchange", route);
  route();

  const renderParts = () => {
    $(root, "#parts").innerHTML = `<b>今使っている部品</b>
      <dl>
        <dt>音声認識</dt><dd>${esc(state.parts.speech)}</dd>
        <dt>やさしい日本語化</dt><dd>${esc(state.parts.easy)}</dd>
        <dt>翻訳</dt><dd>${esc(state.parts.translate)}</dd>
      </dl>
      <a href="#/parts">差し替えの考え方 →</a>`;
  };
  onAppChange(renderParts);
  renderParts();
  if (__SINGLE_FILE__ || location.protocol === "file:") {
    // 1ファイル版の注意（ファイルを直接開くと、マイクや音声認識が動かない場合がある）
    const note = document.createElement("div");
    note.className = "note";
    note.style.cssText = "margin:0;border-radius:0;background:#fff4e0;border-left-color:#f0c27a;color:#5c3a00";
    note.textContent =
      "1ファイル版です。ファイルを直接開くと、マイク、音声認識、ブラウザ内の翻訳、別ウィンドウとの連動が動かない場合があります。すべての機能は、公開URLでお試しください。";
    root.querySelector(".topbar")!.after(note);
  }
}

declare global {
  const __SINGLE_FILE__: boolean;
}
