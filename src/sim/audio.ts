export class Announcer {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock(): void {
    if (this.muted) return;
    if (!this.ctx) this.ctx = new AudioContext();
    void this.ctx.resume();
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

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0): void {
    if (this.muted || !this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private sweep(from: number, to: number, duration: number): void {
    if (this.muted || !this.ctx) return;
    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.linearRampToValueAtTime(to, start + duration);
    amp.gain.setValueAtTime(0.03, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}
