export class AudioEngine {
  constructor() { this.ctx = null; this.master = 0.7; this.sfxVolume = 0.8; this.music = 0.45; this.nodes = []; this.musicTimer = null; }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setVolumes(settings) { this.master = settings.master ?? this.master; this.sfxVolume = settings.sfx ?? this.sfxVolume; this.music = settings.music ?? this.music; }
  tone(freq = 440, duration = 0.12, type = 'square', gain = 0.12, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    amp.gain.setValueAtTime(gain * this.master * this.sfxVolume, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(amp).connect(this.ctx.destination); osc.start(t); osc.stop(t + duration);
  }
  sfx(name) {
    const sounds = {
      sword: [180, 0.08, 'sawtooth', 0.12, -90], bow: [520, 0.08, 'triangle', 0.09, 220],
      spell: [330, 0.18, 'sine', 0.12, 440], heal: [520, 0.25, 'sine', 0.1, -120],
      impact: [125, 0.22, 'triangle', 0.16, -75],
      place: [240, 0.12, 'square', 0.08, 100], boss: [72, 0.5, 'sawtooth', 0.14, -20],
      victory: [440, 0.6, 'triangle', 0.13, 440], hurt: [110, 0.12, 'square', 0.12, -50]
    };
    this.tone(...(sounds[name] || [300, 0.1, 'square', 0.08, 0]));
  }
  stopMusic() {
    if(this.musicTimer)clearInterval(this.musicTimer);
    this.musicTimer=null;
    this.nodes.forEach(n => { try { n.stop(); } catch {} });
    this.nodes = [];
  }
  startMusic(seed = 1) {
    if (!this.ctx) return;
    this.stopMusic();
    const scales = [
      [110,130.81,164.81,196,220,164.81],
      [98,123.47,146.83,185,196,146.83],
      [116.54,146.83,174.61,220,233.08,174.61],
      [103.83,130.81,155.56,196,207.65,155.56]
    ];
    const notes=scales[(seed-1)%scales.length];
    let i = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx) { this.stopMusic(); return; }
      const f = notes[(i++ + seed) % notes.length];
      const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
      osc.type = i%3===0?'sine':'triangle'; osc.frequency.setValueAtTime(f, this.ctx.currentTime);
      amp.gain.setValueAtTime(0.001,this.ctx.currentTime);
      amp.gain.linearRampToValueAtTime(0.025 * this.master * this.music,this.ctx.currentTime+.12);
      amp.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+1.35);
      osc.connect(amp).connect(this.ctx.destination); osc.start();
      osc.stop(this.ctx.currentTime + 1.4);
      osc.onended=()=>{osc.disconnect();amp.disconnect();};
      if(i%4===0)this.tone(f*2,.18,'sine',.018*this.music,0);
    }, 600);
  }
}
