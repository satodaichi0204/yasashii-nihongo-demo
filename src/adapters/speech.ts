// 音声認識の部品（デモ用：ブラウザ標準の Web Speech API）。音声は保存しない。
import type { SpeechPart } from "./types";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const ERRORS: Record<string, string> = {
  "no-speech": "声が聞き取れませんでした（無音でした）。マイクに近づいて、もう一度話してください。",
  "audio-capture": "マイクが見つかりません。マイクがつながっているか確かめてください。",
  "not-allowed": "マイクの使用が許可されていません。アドレスバーの左のマークから、マイクを「許可」にしてください。",
  "service-not-allowed": "この環境では、音声認識が許可されていません。",
  network: "音声認識に失敗しました（ネットワークにつながっていない可能性があります）。",
  aborted: "録音を中止しました。",
  "language-not-supported": "日本語の音声認識が使えません。",
};

function ctor(): (new () => Recognition) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function createWebSpeech(): SpeechPart {
  let rec: Recognition | null = null;
  let finalText = "";
  let ended: Promise<void> = Promise.resolve();
  let failed = false;

  return {
    id: "web-speech",
    label: "ブラウザ標準",
    note: "デモ用の音声認識（ブラウザ標準）。本番では、学習に利用されない設定の音声認識サービスに差し替えます。",
    supported: () => !!ctor(),
    start({ onInterim, onError }) {
      const C = ctor();
      if (!C) {
        onError("このブラウザでは音声認識が使えません。Windows の Chrome か Edge でお試しください。");
        return;
      }
      finalText = "";
      failed = false;
      rec = new C();
      rec.lang = "ja-JP";
      rec.continuous = true;
      rec.interimResults = true;
      let resolveEnd: () => void = () => {};
      ended = new Promise((r) => (resolveEnd = r));
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        onInterim(finalText + interim);
      };
      rec.onerror = (e) => {
        failed = true;
        if (e.error !== "aborted") onError(ERRORS[e.error] ?? `音声認識に失敗しました（${e.error}）。`);
      };
      rec.onend = () => resolveEnd();
      rec.start();
    },
    async stop() {
      if (!rec) return "";
      rec.stop();
      // 止めてから最後の結果が届くまで待つ（届かないときは5秒で打ち切る）
      await Promise.race([ended, new Promise((r) => setTimeout(r, 5000))]);
      rec = null;
      return failed && !finalText ? "" : finalText.trim();
    },
    abort() {
      rec?.abort();
      rec = null;
    },
  };
}

/** マイクの接続状態と入力音量（Web Audio API）。音は保存せず、音量の数字だけを使う */
export class MicMonitor {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private raf = 0;

  static async devices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
  }

  /** 音量を 0〜1 で onLevel に渡し続ける */
  async start(deviceId: string | undefined, onLevel: (level: number) => void): Promise<string> {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("このブラウザではマイクが使えません（https で開いているか確かめてください）。");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "SecurityError") throw new Error("マイクの使用が許可されていません。アドレスバーの左のマークから、マイクを「許可」にしてください。", { cause: e });
      if (name === "NotFoundError" || name === "OverconstrainedError") throw new Error("マイクが見つかりません。マイクがつながっているか確かめてください。", { cause: e });
      throw new Error(`マイクを開けませんでした（${name}）。`, { cause: e });
    }
    this.ctx = new AudioContext();
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024;
    this.ctx.createMediaStreamSource(this.stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 6));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
    const track = this.stream.getAudioTracks()[0];
    return track?.label || "マイク";
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
  }
}
