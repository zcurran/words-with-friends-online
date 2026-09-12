// Words with Friends Web Audio API Procedural Sound Effects
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._unlocked = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Browsers block AudioContext until a user gesture. Call this on any click/keydown to unlock.
  unlock() {
    if (this._unlocked) return;
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => { this._unlocked = true; });
    } else if (this.ctx) {
      this._unlocked = true;
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Wooden tile placement click
  playTileClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Rack shuffle rattle
  playShuffle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playTileClick(), i * 45);
    }
  }

  // Valid move fanfare (major triad arpeggio)
  playScoreFanfare(isBingo = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = isBingo ? [523.25, 659.25, 783.99, 1046.50, 1318.51] : [440, 554.37, 659.25, 880];
    const duration = 0.12;

    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + duration);
    });
  }

  // Invalid play buzzer
  playBuzz() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.22);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  // YOUR TURN — rich triple-ding notification chime
  // Plays three ascending bell tones with a long sustain so it's clearly audible
  playTurnBell() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Three ding pitches: C5, E5, G5 (a bright major chord)
    const chime = [523.25, 659.25, 783.99];
    const sustainSec = 1.2; // long bell tail

    chime.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.18;

      // Primary sine tone — the "ding" body
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, startTime);
      gain1.gain.setValueAtTime(0.0, startTime);
      gain1.gain.linearRampToValueAtTime(0.7, startTime + 0.01);   // fast attack
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + sustainSec);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(startTime);
      osc1.stop(startTime + sustainSec);

      // Overtone at 2× frequency — adds bell-like shimmer
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.756, startTime); // inharmonic partial, gives bell colour
      gain2.gain.setValueAtTime(0.0, startTime);
      gain2.gain.linearRampToValueAtTime(0.25, startTime + 0.005);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + sustainSec * 0.4);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(startTime);
      osc2.stop(startTime + sustainSec);
    });
  }
}

const AUDIO = new AudioManager();

// Unlock AudioContext on the very first user interaction so the browser allows sound
['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
  window.addEventListener(evt, () => AUDIO.unlock(), { once: false, passive: true });
});

