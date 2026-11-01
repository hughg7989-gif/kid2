/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private isEngineRunning: boolean = false;

  private initCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isMuted && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  /**
   * Cheerful dual-tone car horn: "Beep-Beep!"
   */
  public playHorn() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const notes = [
      { t: now, dur: 0.12, f1: 392, f2: 523 },
      { t: now + 0.15, dur: 0.18, f1: 440, f2: 587 },
    ];

    notes.forEach(({ t, dur, f1, f2 }) => {
      [f1, f2].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + dur);
      });
    });
  }

  /**
   * Cartoon spring "Boing!" sound for jumping.
   */
  public playJump() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * Playful obstacle impact pop / shatter sound with colorful harmonics.
   */
  public playImpact() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    // Pop oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    // Chime bell on top
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(880 + Math.random() * 200, now);

    chimeGain.gain.setValueAtTime(0.08, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(now);
    chime.stop(now + 0.25);
  }

  /**
   * Happy celebratory chime when landing or flipping upright.
   */
  public playCheer() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    arpeggio.forEach((freq, idx) => {
      const t = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /**
   * Gentle continuous engine purr that adjusts pitch with vehicle speed.
   */
  public updateEngine(speedMultiplier: number, isMoving: boolean) {
    if (this.isMuted || !isMoving) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }

    const ctx = this.initCtx();
    if (!ctx) return;

    if (!this.isEngineRunning) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, ctx.currentTime);

        // Low pass filter to make it a pleasant low rumble
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, ctx.currentTime);

        gain.gain.setValueAtTime(0.02, ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        this.engineOsc = osc;
        this.engineGain = gain;
        this.isEngineRunning = true;
      } catch {
        // Audio might still be locked before user interaction
      }
    }

    if (this.engineOsc && this.engineGain && ctx.state === 'running') {
      const targetFreq = 45 * Math.max(0.6, speedMultiplier);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
      this.engineGain.gain.setTargetAtTime(0.03, ctx.currentTime, 0.1);
    }
  }

  public stopEngine() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }
}

export const soundSynth = new SoundSynth();
