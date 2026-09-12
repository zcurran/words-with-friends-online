// Words with Friends Web Audio API Procedural Sound Effects
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._unlocked = false;
  }

  // Create and immediately resume the AudioContext
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Must be called from a user gesture to unlock audio for the session.
  // Once unlocked, starts a silent keep-alive so the context never suspends again.
  unlock() {
    if (this._unlocked) return;
    this.init();
    const resume = () => {
      if (!this.ctx) return;
      this.ctx.resume().then(() => {
        this._unlocked = true;
        // Play a silent buffer to keep context warm — prevents auto-suspend
        this._keepAlive();
      });
    };
    if (this.ctx) resume();
  }

  // Plays a completely silent buffer every 20s to keep the AudioContext from auto-suspending
  _keepAlive() {
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1, 1, 22050);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(0);
    setTimeout(() => this._keepAlive(), 20000);
  }

  // Ensure context is running before playing anything — safe to call from socket callbacks
  _ensureRunning(callback) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'running') {
      callback();
    } else {
      this.ctx.resume().then(() => callback()).catch(() => {});
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Wooden tile placement click
  playTileClick() {
    if (!this.enabled) return;
    this._ensureRunning(() => {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  // Rack shuffle rattle
  playShuffle() {
    if (!this.enabled) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playTileClick(), i * 45);
    }
  }

  // Valid move fanfare (major triad arpeggio)
  playScoreFanfare(isBingo = false) {
    if (!this.enabled) return;
    this._ensureRunning(() => {
      const notes = isBingo ? [523.25, 659.25, 783.99, 1046.50, 1318.51] : [440, 554.37, 659.25, 880];
      const duration = 0.12;
      notes.forEach((freq, idx) => {
        const t = this.ctx.currentTime + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
      });
    });
  }

  // Invalid play buzzer
  playBuzz() {
    if (!this.enabled) return;
    this._ensureRunning(() => {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.linearRampToValueAtTime(110, t + 0.22);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  // YOUR TURN — rich triple-ding notification chime
  // Always plays regardless of mute (it's a notification, not a game sound)
  playTurnBell() {
    this._ensureRunning(() => {
      const chime = [523.25, 659.25, 783.99]; // C5, E5, G5
      const sustainSec = 1.4;

      chime.forEach((freq, idx) => {
        const startTime = this.ctx.currentTime + idx * 0.2;

        // Primary body
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);
        gain1.gain.setValueAtTime(0.0, startTime);
        gain1.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.001, startTime + sustainSec);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(startTime);
        osc1.stop(startTime + sustainSec);

        // Bell shimmer overtone
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.756, startTime);
        gain2.gain.setValueAtTime(0.0, startTime);
        gain2.gain.linearRampToValueAtTime(0.15, startTime + 0.005);
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime + sustainSec * 0.4);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(startTime);
        osc2.stop(startTime + sustainSec);
      });
    });
  }
}

const AUDIO = new AudioManager();

// Unlock AudioContext on ANY first user interaction
['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
  window.addEventListener(evt, () => AUDIO.unlock(), { passive: true });
});

