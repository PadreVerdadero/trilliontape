"use client";

export type DeskSound = "buy" | "sell" | "deposit" | "fail";

type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;
let primed = false;

function audioContext() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function primeDeskSounds() {
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  primed = true;
}

function listenForPrime() {
  if (typeof window === "undefined" || primed) return;
  const once = () => {
    primeDeskSounds();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
}

listenForPrime();

function beep(
  audio: AudioContext,
  {
    freq,
    freqEnd,
    when,
    dur,
    type = "sine",
    gain = 0.09,
  }: {
    freq: number;
    freqEnd?: number;
    when: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
  }
) {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), when + dur);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(type === "square" || type === "sawtooth" ? 1600 : 4200, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(filter);
  filter.connect(amp);
  amp.connect(audio.destination);
  osc.start(when);
  osc.stop(when + dur + 0.03);
}

function playBuy(audio: AudioContext, t: number) {
  beep(audio, { freq: 523.25, when: t, dur: 0.09, gain: 0.07 });
  beep(audio, { freq: 783.99, when: t + 0.07, dur: 0.18, gain: 0.1 });
}

function playSell(audio: AudioContext, t: number) {
  beep(audio, { freq: 659.25, when: t, dur: 0.08, type: "triangle", gain: 0.08 });
  beep(audio, { freq: 523.25, when: t + 0.07, dur: 0.1, type: "triangle", gain: 0.07 });
  beep(audio, { freq: 392.0, freqEnd: 329.63, when: t + 0.13, dur: 0.16, type: "sine", gain: 0.09 });
}

function playDeposit(audio: AudioContext, t: number) {
  const ticks = [1864, 2489, 2093, 2793];
  ticks.forEach((freq, i) => {
    beep(audio, {
      freq,
      when: t + i * 0.055,
      dur: 0.07,
      type: "square",
      gain: 0.045,
    });
  });
  beep(audio, { freq: 523.25, when: t + 0.02, dur: 0.28, gain: 0.06 });
  beep(audio, { freq: 783.99, when: t + 0.12, dur: 0.32, gain: 0.07 });
}

function playFail(audio: AudioContext, t: number) {
  beep(audio, { freq: 130.81, freqEnd: 98, when: t, dur: 0.22, type: "triangle", gain: 0.12 });
  beep(audio, { freq: 196, freqEnd: 155, when: t + 0.04, dur: 0.14, type: "square", gain: 0.035 });
}

export function playDeskSound(kind: DeskSound) {
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  const t = audio.currentTime + 0.01;
  if (kind === "buy") playBuy(audio, t);
  else if (kind === "sell") playSell(audio, t);
  else if (kind === "deposit") playDeposit(audio, t);
  else playFail(audio, t);
}

export function deskSoundForAction(action: string, side?: unknown): DeskSound | null {
  if (action === "order") return side === "sell" ? "sell" : "buy";
  if (action === "take") return side === "buy" ? "sell" : "buy";
  return null;
}

export function isDeskTradeAction(action: string) {
  return action === "order" || action === "take" || action === "cancel";
}
