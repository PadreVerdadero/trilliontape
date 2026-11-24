type SoundName =
  | "bid"
  | "ask"
  | "close"
  | "take"
  | "pull"
  | "deal"
  | "dice"
  | "payout"
  | "fee"
  | "auction"
  | "win"
  | "tick";

let ctx: AudioContext | null = null;
let enabled = true;
let started = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let step = 0;

const MELODY = [262, 294, 330, 392, 330, 294, 349, 330, 294, 262, 247, 294];

function context() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Audio = window.AudioContext;
    if (!Audio) return null;
    ctx = new Audio();
  }
  return ctx;
}

function tone(audio: AudioContext, frequency: number, duration: number, type: OscillatorType, gain: number, delay = 0) {
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(audio: AudioContext, duration: number, gain: number) {
  const length = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 800;
  amp.gain.setValueAtTime(gain, audio.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(audio.destination);
  source.start();
}

function startMusic() {
  const audio = context();
  if (!audio || musicTimer != null) return;
  musicTimer = setInterval(() => {
    if (!enabled || !ctx) return;
    const note = MELODY[step % MELODY.length] ?? 262;
    step += 1;
    tone(ctx, note, 0.22, "triangle", 0.018);
    if (step % 2 === 0) tone(ctx, note / 2, 0.28, "sine", 0.01);
  }, 320);
}

function stopMusic() {
  if (musicTimer != null) clearInterval(musicTimer);
  musicTimer = null;
}

export function soundOn() {
  return enabled;
}

export function unlockSound() {
  const audio = context();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  started = true;
  if (enabled) startMusic();
}

export function toggleSound() {
  enabled = !enabled;
  if (!enabled) stopMusic();
  else if (started) {
    unlockSound();
  }
  return enabled;
}

export function play(name: SoundName) {
  if (!enabled || !started) return;
  const audio = context();
  if (!audio || audio.state !== "running") return;
  if (name === "bid") tone(audio, 520, 0.12, "triangle", 0.05);
  if (name === "ask") tone(audio, 340, 0.14, "sawtooth", 0.03);
  if (name === "close") {
    tone(audio, 523, 0.16, "triangle", 0.05);
    tone(audio, 659, 0.22, "triangle", 0.04, 0.08);
  }
  if (name === "take") tone(audio, 880, 0.1, "square", 0.03);
  if (name === "pull") tone(audio, 180, 0.12, "sine", 0.04);
  if (name === "deal") noise(audio, 0.08, 0.04);
  if (name === "dice") noise(audio, 0.18, 0.05);
  if (name === "payout") {
    tone(audio, 660, 0.08, "triangle", 0.04);
    tone(audio, 880, 0.1, "triangle", 0.04, 0.08);
    tone(audio, 990, 0.14, "triangle", 0.03, 0.16);
  }
  if (name === "fee") {
    tone(audio, 494, 0.1, "triangle", 0.04);
    tone(audio, 392, 0.14, "triangle", 0.04, 0.1);
  }
  if (name === "auction") tone(audio, 440, 0.2, "triangle", 0.05);
  if (name === "tick") tone(audio, 740, 0.06, "square", 0.02);
  if (name === "win") {
    [523, 659, 784, 1047].forEach((frequency, index) => tone(audio, frequency, 0.2, "triangle", 0.05, index * 0.12));
  }
}
