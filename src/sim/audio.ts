export class Announcer {
  private ctx: AudioContext | null = null;
  private crowdGain: GainNode | null = null;
  muted = false;
  master = 1;
  sfx = 1;
  crowd = 0.25;

  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    void this.ctx.resume();
    this.ensureCrowd();
  }

  setMix(master: number, sfx: number, crowd: number, muted: boolean): void {
    this.master = master;
    this.sfx = sfx;
    this.crowd = crowd;
    this.muted = muted;
    this.ensureCrowd();
  }

  /** Short rising tone while a shot leaves the hood. */
  spin(): void {
    this.sweep(180, 520, 0.18);
  }

  start(): void {
    this.blip(523, 0.08, 0);
    this.blip(659, 0.08, 0.1);
    this.blip(784, 0.14, 0.2);
  }

  buzzer(): void {
    this.tone(150, 0.42, "sawtooth", 0.08);
  }

  bells(): void {
    this.blip(880, 0.16, 0);
    this.blip(1175, 0.22, 0.12);
  }

  chime(): void {
    this.blip(1568, 0.28, 0);
  }

  whistle(): void {
    this.sweep(700, 1400, 0.35);
  }

  private blip(freq: number, duration: number, delay: number): void {
    this.tone(freq, duration, "sine", 0.07, delay);
  }

  private level(): number {
    return this.muted ? 0 : this.master * this.sfx;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0): void {
    const level = this.level();
    if (level <= 0 || !this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(gain * level, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private sweep(from: number, to: number, duration: number): void {
    const level = this.level();
    if (level <= 0 || !this.ctx) return;
    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.linearRampToValueAtTime(to, start + duration);
    amp.gain.setValueAtTime(0.03 * level, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private ensureCrowd(): void {
    if (!this.ctx) return;
    if (!this.crowdGain) {
      const seconds = 2;
      const rate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
      const data = buffer.getChannelData(0);
      let hold = 0;
      for (let i = 0; i < data.length; i += 1) {
        if (i % 80 === 0) hold = Math.random() * 2 - 1;
        data[i] = hold * 0.35;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      this.crowdGain = this.ctx.createGain();
      source.connect(filter);
      filter.connect(this.crowdGain);
      this.crowdGain.connect(this.ctx.destination);
      source.start();
    }
    const amount = this.muted ? 0 : this.master * this.crowd * 0.03;
    this.crowdGain.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.05);
  }
}
