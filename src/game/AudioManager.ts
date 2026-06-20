import { Howl } from 'howler';
import { publicUrl } from '../utils/publicUrl';

export class AudioManager {
  private started = false;
  private ctx: AudioContext | null = null;
  private bgm: Howl | null = null;

  private bgmVolume = 0.2;
  private bgmMuted = false;

  private initCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  startOnFirstInteraction(): void {
    if (this.started) return;
    this.started = true;
    this.initCtx(); // still initialize/resume context for SFX

    const bgmPath = publicUrl('audio/Glass Rain Drift.mp3');
    this.bgm = new Howl({
      src: [bgmPath],
      html5: true,
      loop: true,
      volume: this.bgmVolume,
      mute: this.bgmMuted,
      onloaderror: (_id, err) => {
        console.warn('Failed to load background music:', err);
      },
      onplayerror: (_id, err) => {
        console.warn('Failed to play background music:', err);
        const retry = () => {
          this.bgm?.play();
          window.removeEventListener('click', retry);
          window.removeEventListener('keydown', retry);
        };
        window.addEventListener('click', retry);
        window.addEventListener('keydown', retry);
      }
    });
    this.bgm.play();
  }

  stopBgm(): void {
    this.bgm?.stop();
  }

  setBgmVolume(vol: number): void {
    this.bgmVolume = vol;
    if (this.bgm) {
      this.bgm.volume(vol);
    }
  }

  getBgmVolume(): number {
    return this.bgmVolume;
  }

  setBgmMuted(muted: boolean): void {
    this.bgmMuted = muted;
    if (this.bgm) {
      this.bgm.mute(muted);
    }
  }

  isBgmMuted(): boolean {
    return this.bgmMuted;
  }

  playSfx(name: string): void {
    const path = publicUrl(`audio/${name}.ogg`);
    const sfx = new Howl({
      src: [path],
      volume: 0.6,
      onloaderror: () => {
        this.playSynthesizedSfx(name);
      }
    });
    sfx.play();
  }

  private playSynthesizedSfx(name: string): void {
    try {
      const ctx = this.initCtx();
      if (name === 'click') {
        this.playClickSfx(ctx);
      } else if (name === 'door_unlock') {
        this.playUnlockSfx(ctx);
      } else if (name === 'rotate') {
        this.playRotateSfx(ctx);
      }
    } catch (err) {
      console.warn(`Failed to play synthesized SFX for ${name}:`, err);
    }
  }

  private playClickSfx(ctx: AudioContext): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  private playUnlockSfx(ctx: AudioContext): void {
    const t = ctx.currentTime;

    // First click
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(800, t);
    osc1.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    gain1.gain.setValueAtTime(0.06, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.09);

    // Second click (delayed)
    const t2 = t + 0.12;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, t2);
    osc2.frequency.exponentialRampToValueAtTime(300, t2 + 0.1);
    gain2.gain.setValueAtTime(0.05, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.11);
  }

  private playRotateSfx(ctx: AudioContext): void {
    const duration = 0.6;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;

    const gain = ctx.createGain();

    const t = ctx.currentTime;
    filter.frequency.setValueAtTime(150, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(150, t + duration);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.12, t + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(t);
  }
}
