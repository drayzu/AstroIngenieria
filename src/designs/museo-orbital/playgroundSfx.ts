/* Efectos de sonido del playground, sintetizados con Web Audio: sin archivos
   que descargar y con tono que sube con el combo. El contexto se crea y se
   reanuda solo dentro de un gesto del visitante (requisito del navegador). */

type PlaygroundSfxWeapon = 'rapid' | 'charged';

// Escala pentatónica mayor: cualquier secuencia de combos suena afinada.
const COMBO_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export class PlaygroundSfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();

  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        this.ctx = new AudioContextClass();
      } catch {
        return;
      }
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(compressor).connect(this.ctx.destination);
      const length = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  dispose() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }

  hit(weapon: PlaygroundSfxWeapon, matched: boolean) {
    if (weapon === 'rapid') {
      if (!this.ready('hit-rapid', 0.05)) return;
      this.tone(matched ? 1500 : 980, matched ? 900 : 620, 0.05, 0.05, 'sine');
      return;
    }
    if (!this.ready('hit-charged', 0.04)) return;
    this.tone(190, 52, 0.18, 0.32, 'sine');
    this.burst(matched ? 1400 : 700, 0.09, 0.16);
  }

  destroy(combo: number) {
    if (!this.ready('destroy', 0.03)) return;
    const note = COMBO_NOTES[Math.min(COMBO_NOTES.length - 1, Math.max(0, combo - 1))];
    this.tone(note, note, 0.42, 0.16, 'triangle');
    this.tone(note * 2, note * 2, 0.26, 0.05, 'sine', 0.012);
    this.tone(120, 38, 0.24, 0.32, 'sine');
    this.burst(2600, 0.22, 0.12);
  }

  launch(power: number) {
    if (!this.ready('launch', 0.08)) return;
    this.sweep(380, 2200 + power * 1800, 0.26, 0.08 + power * 0.1);
  }

  bonusAppear() {
    if (!this.ready('bonus-appear', 1)) return;
    [1318.5, 1567.98, 2093].forEach((frequency, index) =>
      this.tone(frequency, frequency, 0.3, 0.035, 'sine', index * 0.07));
  }

  bonus() {
    if (!this.ready('bonus', 0.2)) return;
    [783.99, 987.77, 1174.66, 1567.98, 1975.53].forEach((frequency, index) =>
      this.tone(frequency, frequency, 0.34, 0.09, 'triangle', index * 0.05));
    this.sweep(600, 4200, 0.4, 0.08);
  }

  complete() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, index) => {
      this.tone(frequency, frequency, 1.1, 0.12, 'triangle', index * 0.09);
      this.tone(frequency / 2, frequency / 2, 1.2, 0.06, 'sine', index * 0.09);
    });
  }

  timeout() {
    this.tone(392, 370, 0.45, 0.12, 'triangle');
    this.tone(311.13, 290, 0.8, 0.12, 'triangle', 0.32);
  }

  private ready(key: string, minimumGap: number) {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return false;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < minimumGap) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0,
  ) {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private burst(frequency: number, duration: number, volume: number) {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(start, Math.random() * 0.2);
    source.stop(start + duration + 0.02);
  }

  private sweep(from: number, to: number, duration: number, volume: number) {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(start, Math.random() * 0.2);
    source.stop(start + duration + 0.02);
  }
}
