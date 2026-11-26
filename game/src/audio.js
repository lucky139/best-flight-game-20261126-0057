// Sound for Sky Courier: everything synthesised with WebAudio,
// no audio files, no network. One clear job: engine hum, wind,
// and the chimes and thuds that mark what just happened.

export class Sound {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this.muted = false;
    this.unlocked = false;
  }

  // Browsers only let audio start after a gesture; call from input.
  unlock() {
    if (this.unlocked) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.unlocked = true;
      this.startEngine();
      this.startWind();
    } catch {
      this.ctx = null;
    }
  }

  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 62;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    // A second oscillator an octave up gives the prop its buzz.
    const buzz = ctx.createOscillator();
    buzz.type = 'square';
    buzz.frequency.value = 124;
    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.0;
    buzz.connect(buzzGain);
    buzzGain.connect(ctx.destination);
    buzz.start();
    this.buzzOsc = buzz;
    this.buzzGain = buzzGain;
  }

  startWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    src.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    src.start();
  }

  // Called every frame: engine pitch follows throttle, wind follows speed.
  update(throttle, speed01, flying) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const target = flying ? 0.045 + throttle * 0.05 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(58 + throttle * 96, t, 0.15);
    this.buzzGain.gain.setTargetAtTime(flying ? 0.012 + throttle * 0.014 : 0, t, 0.12);
    this.buzzOsc.frequency.setTargetAtTime(116 + throttle * 192, t, 0.15);
    this.windGain.gain.setTargetAtTime(flying ? speed01 * 0.05 : 0, t, 0.2);
  }

  blip(freq, dur, type, gainValue, when = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  ringChime() {
    this.blip(880, 0.35, 'sine', 0.16);
    this.blip(1318, 0.5, 'sine', 0.12, 0.08);
  }

  landChime() {
    this.blip(523, 0.3, 'sine', 0.15);
    this.blip(659, 0.3, 'sine', 0.15, 0.1);
    this.blip(784, 0.55, 'sine', 0.15, 0.2);
  }

  warning() {
    this.blip(220, 0.22, 'square', 0.06);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.blip(70, 0.5, 'sine', 0.25);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.05, t, 0.05);
      if (this.windGain) this.windGain.gain.setTargetAtTime(0, t, 0.05);
    }
    return this.muted;
  }
}
