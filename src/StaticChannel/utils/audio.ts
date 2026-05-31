// CRT TV audio. Per CLAUDE.md memory rules:
//   - never init AudioContext on mount; only on first user gesture
//   - hiss (static) volume tracks tuning velocity; it does NOT drone forever
//     when idle — fades to ~0 a second after the user releases the dial
//
// Voices:
//   - hiss: looping white noise → low-pass → gain (driven externally)
//   - sweepTone: short pitched ping when frequency ticks past a station
//   - lockChime: low warm chime when a channel locks in
//   - pop / haptic: global tap feedback (delegated listener)

let actx: AudioContext | null = null;
let master: GainNode | null = null;
let hissGain: GainNode | null = null;
let hissTarget = 0;
let hissCurrent = 0;
let hissRaf: number | null = null;
let muted = false;

const MASTER_VOL = 0.45;

export function initAudio(): void {
  if (actx) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    actx = new Ctx();
    master = actx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    master.connect(actx.destination);

    hissGain = actx.createGain();
    hissGain.gain.value = 0;
    hissGain.connect(master);

    // ~1s of white noise looped — cheap continuous static
    const sr = actx.sampleRate;
    const buf = actx.createBuffer(1, Math.floor(sr * 1.0), sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = actx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5500;
    src.connect(hp).connect(lp).connect(hissGain);
    src.start();

    startHissTween();
  } catch (_) {
    actx = null;
  }
}

function startHissTween() {
  if (hissRaf != null) return;
  const tick = () => {
    if (!hissGain || !actx) {
      hissRaf = null;
      return;
    }
    // Approach target smoothly. Decay is faster than attack so release feels snappy.
    const lerp = hissCurrent < hissTarget ? 0.18 : 0.10;
    hissCurrent += (hissTarget - hissCurrent) * lerp;
    if (hissCurrent < 0.0008) hissCurrent = 0;
    try {
      hissGain.gain.setValueAtTime(hissCurrent, actx.currentTime);
    } catch (_) {}
    hissRaf = requestAnimationFrame(tick);
  };
  hissRaf = requestAnimationFrame(tick);
}

export function audioReady(): boolean {
  return !!actx && actx.state === 'running';
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  if (!master) return;
  try {
    master.gain.setValueAtTime(muted ? 0 : MASTER_VOL, actx!.currentTime);
  } catch (_) {}
}

/** Drive the static hiss volume 0..1. Caller should pass 0 when idle. */
export function setHiss(level: number): void {
  hissTarget = Math.max(0, Math.min(1, level)) * 0.55;
}

/** Short pitched ping when a tuner tick passes a 0.5-MHz boundary. */
export function playSweep(freq: number) {
  if (!audioReady() || !actx || !master) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'square';
  // Map freq 88..108 → 600..1400 Hz so listener feels position
  const pitch = 600 + ((freq - 88) / 20) * 800;
  o.frequency.value = pitch;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.08);
}

/** Warm low chime when a channel finally locks in. */
export function playLockChime() {
  if (!audioReady() || !actx || !master) return;
  const t = actx.currentTime;
  const make = (f: number, delay: number, vol = 0.14) => {
    const o = actx!.createOscillator();
    const g = actx!.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.9);
    o.connect(g).connect(master!);
    o.start(t + delay);
    o.stop(t + delay + 1.0);
  };
  make(330, 0);
  make(495, 0.07);
  make(660, 0.14);
}

// ── Global delegated tap feedback ────────────────────────────────────────
let globalTapInstalled = false;
export function installGlobalTapFeedback(): void {
  if (globalTapInstalled || typeof window === 'undefined') return;
  globalTapInstalled = true;
  window.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest('button, [role="button"], a[href]') as HTMLElement | null;
    if (!interactive) return;
    if ((interactive as HTMLButtonElement).disabled) return;
    if (interactive.closest('[data-no-feedback]')) return;
    playPop();
    hapticTap();
  }, true);
}
function playPop() {
  if (!audioReady() || !actx || !master) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'sine';
  o.frequency.value = 360 + Math.random() * 80;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.12);
}
function hapticTap() {
  try {
    if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (n: number) => void }).vibrate(8);
  } catch (_) {}
}
