"use client";

export type DeskSound = "buy" | "sell" | "deposit" | "fail";

type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const MUTE_KEY = "trilliontape_sound";
const SAMPLE_RATE = 22050;

let ctx: AudioContext | null = null;
let unlocked = false;
let wavUrls: Partial<Record<DeskSound | "silent", string>> = {};
const prefListeners = new Set<() => void>();

function audioContext() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function deskSoundsMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "0";
  } catch {
    return false;
  }
}

export function setDeskSoundsMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "0" : "1");
  } catch {
    /* private mode */
  }
  notifyPref();
}

export function deskSoundsUnlocked() {
  return unlocked;
}

function notifyPref() {
  for (const listener of prefListeners) listener();
}

function writeWav(pcm: Int16Array) {
  const bytes = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, bytes, true);
  for (let i = 0; i < pcm.length; i += 1) view.setInt16(44 + i * 2, pcm[i], true);
  return new Blob([buffer], { type: "audio/wav" });
}

export function subscribeDeskSoundPref(listener: () => void) {
  prefListeners.add(listener);
  return () => {
    prefListeners.delete(listener);
  };
}

function mixTone(
  out: Float32Array,
  freq: number,
  startSec: number,
  durSec: number,
  amp: number,
  slideTo = freq
) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const n = Math.floor(durSec * SAMPLE_RATE);
  for (let i = 0; i < n; i += 1) {
    const idx = start + i;
    if (idx >= out.length) break;
    const t = i / n;
    const env = t < 0.06 ? t / 0.06 : Math.pow(1 - (t - 0.06) / 0.94, 1.45);
    const freqNow = freq + (slideTo - freq) * t;
    out[idx] += amp * env * Math.sin(2 * Math.PI * freqNow * (i / SAMPLE_RATE));
  }
}

function renderCue(kind: DeskSound | "silent") {
  const duration =
    kind === "silent" ? 0.05 : kind === "deposit" ? 0.55 : kind === "fail" ? 0.32 : kind === "sell" ? 0.5 : 0.38;
  const out = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  if (kind === "buy") {
    mixTone(out, 523.25, 0, 0.12, 0.62);
    mixTone(out, 783.99, 0.08, 0.26, 0.72);
    mixTone(out, 1046.5, 0.16, 0.2, 0.35);
  } else if (kind === "sell") {
    mixTone(out, 783.99, 0, 0.1, 0.52);
    mixTone(out, 987.77, 0.07, 0.11, 0.6);
    mixTone(out, 1174.66, 0.14, 0.14, 0.68);
    mixTone(out, 1567.98, 0.22, 0.24, 0.78);
    mixTone(out, 3135.96, 0.24, 0.14, 0.22);
  } else if (kind === "deposit") {
    mixTone(out, 1760, 0, 0.08, 0.5);
    mixTone(out, 2349, 0.07, 0.08, 0.55);
    mixTone(out, 1976, 0.14, 0.08, 0.5);
    mixTone(out, 2637, 0.21, 0.09, 0.58);
    mixTone(out, 523.25, 0.04, 0.4, 0.28);
    mixTone(out, 783.99, 0.16, 0.36, 0.32);
  } else if (kind === "fail") {
    mixTone(out, 196, 0, 0.28, 0.7, 130.81);
    mixTone(out, 147, 0.03, 0.22, 0.55, 110);
    mixTone(out, 98, 0.06, 0.2, 0.4);
  }
  const pcm = new Int16Array(out.length);
  for (let i = 0; i < out.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, out[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return writeWav(pcm);
}

function cueUrl(kind: DeskSound | "silent") {
  if (!wavUrls[kind]) wavUrls[kind] = URL.createObjectURL(renderCue(kind));
  return wavUrls[kind] as string;
}

function playHtml(kind: DeskSound | "silent", volume: number) {
  const node = new Audio(cueUrl(kind));
  node.preload = "auto";
  (node as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  node.volume = volume;
  return node.play();
}

async function resumeContext() {
  const audio = audioContext();
  if (!audio) return null;
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      /* ignore */
    }
  }
  if (audio.state === "running") {
    const buffer = audio.createBuffer(1, 1, audio.sampleRate);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    try {
      source.start(0);
    } catch {
      /* ignore */
    }
  }
  return audio;
}

export async function unlockDeskSounds() {
  if (typeof window === "undefined") return false;
  const audio = audioContext();
  const resume = audio && audio.state === "suspended" ? audio.resume() : Promise.resolve();
  const html = unlocked ? Promise.resolve() : playHtml("silent", 0.01);
  try {
    await Promise.all([resume, html]);
    unlocked = true;
  } catch {
    unlocked = audio?.state === "running" || unlocked;
  }
  if (audio?.state === "running") {
    const buffer = audio.createBuffer(1, 1, audio.sampleRate);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    try {
      source.start(0);
    } catch {
      /* ignore */
    }
    unlocked = true;
  }
  notifyPref();
  return unlocked;
}

function listenForUnlock() {
  if (typeof window === "undefined") return;
  const arm = () => {
    void unlockDeskSounds();
  };
  window.addEventListener("pointerdown", arm, { capture: true });
  window.addEventListener("keydown", arm, { capture: true });
  window.addEventListener("touchstart", arm, { capture: true });
}

listenForUnlock();

export async function playDeskSound(kind: DeskSound) {
  if (typeof window === "undefined" || deskSoundsMuted()) return;
  await unlockDeskSounds();
  try {
    await playHtml(kind, 1);
  } catch {
    const audio = await resumeContext();
    if (!audio || audio.state !== "running") return;
    playWebFallback(audio, kind);
  }
}

function beep(
  audio: AudioContext,
  freq: number,
  when: number,
  dur: number,
  gain: number,
  type: OscillatorType = "sine",
  freqEnd = freq
) {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), when + dur);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(when);
  osc.stop(when + dur + 0.04);
}

function playWebFallback(audio: AudioContext, kind: DeskSound) {
  const t = audio.currentTime + 0.02;
  if (kind === "buy") {
    beep(audio, 523.25, t, 0.12, 0.22);
    beep(audio, 783.99, t + 0.08, 0.22, 0.28);
  } else if (kind === "sell") {
    beep(audio, 783.99, t, 0.09, 0.2);
    beep(audio, 987.77, t + 0.07, 0.1, 0.22);
    beep(audio, 1174.66, t + 0.14, 0.12, 0.24);
    beep(audio, 1567.98, t + 0.22, 0.2, 0.28);
  } else if (kind === "deposit") {
    beep(audio, 1760, t, 0.08, 0.16, "square");
    beep(audio, 2349, t + 0.07, 0.08, 0.16, "square");
    beep(audio, 1976, t + 0.14, 0.08, 0.16, "square");
    beep(audio, 783.99, t + 0.1, 0.28, 0.18);
  } else {
    beep(audio, 147, t, 0.24, 0.3, "triangle", 98);
  }
}

export function deskSoundForAction(action: string, side?: unknown): DeskSound | null {
  if (action === "order") return side === "sell" ? "sell" : "buy";
  if (action === "take") return side === "buy" ? "sell" : "buy";
  return null;
}

export function isDeskTradeAction(action: string) {
  return action === "order" || action === "take" || action === "cancel";
}
