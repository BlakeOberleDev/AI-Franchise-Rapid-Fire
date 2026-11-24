export class AudioEngine {
  constructor() { this.ctx = null; this.master = 0.7; this.sfx = 0.8; this.music = 0.45; this.nodes = []; }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setVolumes(settings) { this.master = settings.master ?? this.master; this.sfx = settings.sfx ?? this.sfx; this.music = settings.music ?? this.music; }
  tone(freq = 440, duration = 0.12, type = 'square', gain = 0.12, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    amp.gain.setValueAtTime(gain * this.master * this.sfx, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp).connect(this.ctx.destination); osc.start(t); osc.stop(t + duration);
  }
  sfx(name) {
    const sounds = {
      sword: [180, 0.08, 'sawtooth', 0.12, -90], bow: [520, 0.08, 'triangle', 0.09, 220],
      spell: [330, 0.18, 'sine', 0.12, 440], heal: [520, 0.25, 'sine', 0.1, -120],
      place: [240, 0.12, 'square', 0.08, 100], boss: [72, 0.5, 'sawtooth', 0.14, -20],
      victory: [440, 0.6, 'triangle', 0.13, 440], hurt: [110, 0.12, 'square', 0.12, -50]
    };
    this.tone(...(sounds[name] || [300, 0.1, 'square', 0.08, 0]));
  }
  stopMusic() { this.nodes.forEach(n => { try { n.stop(); } catch {} }); this.nodes = []; }
  startMusic(seed = 1) {
    if (!this.ctx) return;
    this.stopMusic();
    const notes = [110, 138.59, 164.81, 196, 220, 164.81];
    let i = 0;
    const timer = setInterval(() => {
      if (!this.ctx) { clearInterval(timer); return; }
      const f = notes[(i++ + seed) % notes.length];
      const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = f;
      amp.gain.value = 0.025 * this.master * this.music;
      osc.connect(amp).connect(this.ctx.destination); osc.start();
      osc.stop(this.ctx.currentTime + 1.1);
      this.nodes.push(osc);
    }, 600);
  }
}
