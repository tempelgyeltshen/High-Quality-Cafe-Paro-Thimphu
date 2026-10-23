/**
 * Web Audio API synthesizer for kitchen order alerts and cashier notifications.
 * Pure native audio synthesis with zero external audio assets or network delays.
 */
export type SoundTone = 'restaurant_bell' | 'kitchen_chime' | 'urgent_chime';

class SoundService {
  private audioCtx: AudioContext | null = null;
  private enabled: boolean = true;
  private tone: SoundTone = 'kitchen_chime';
  private volume: number = 0.8;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hqc_sound_enabled');
      if (stored !== null) {
        this.enabled = stored === 'true';
      }
      const storedTone = localStorage.getItem('hqc_sound_tone') as SoundTone;
      if (storedTone) {
        this.tone = storedTone;
      }
      const storedVol = localStorage.getItem('hqc_sound_volume');
      if (storedVol) {
        this.volume = parseFloat(storedVol) || 0.8;
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('hqc_sound_enabled', String(enabled));
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setTone(tone: SoundTone) {
    this.tone = tone;
    if (typeof window !== 'undefined') {
      localStorage.setItem('hqc_sound_tone', tone);
    }
  }

  getTone(): SoundTone {
    return this.tone;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0.1, Math.min(1.0, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('hqc_sound_volume', String(this.volume));
    }
  }

  getVolume(): number {
    return this.volume;
  }

  /**
   * Play the configured kitchen order alert
   */
  playNewOrderChime(customTone?: SoundTone) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const targetTone = customTone || this.tone;
      const now = ctx.currentTime;
      const baseVol = this.volume;

      if (targetTone === 'restaurant_bell') {
        // High crisp brass service bell (1200Hz + 2400Hz harmonic)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1174.66, now); // D6
        gain1.gain.setValueAtTime(0.25 * baseVol, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 1.2);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2349.32, now); // D7 harmonic
        gain2.gain.setValueAtTime(0.08 * baseVol, now);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.8);
      } else if (targetTone === 'urgent_chime') {
        // 3-note ascending fanfare chime (C5 -> E5 -> G5)
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.22 * baseVol, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.6);
        });
      } else {
        // Standard two-tone melodic kitchen chime (E5 -> A5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.2 * baseVol, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.6);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.18);
        gain2.gain.setValueAtTime(0.25 * baseVol, now + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.9);
      }
    } catch (e) {
      // Audio autoplay may be suppressed until first interaction
    }
  }

  /**
   * Cashier payment success ring
   */
  playPaymentSuccess() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const baseVol = this.volume;

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.15 * baseVol, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } catch (e) {
      // ignore
    }
  }
}

export const soundService = new SoundService();
