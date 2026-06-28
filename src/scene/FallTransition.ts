/**
 * Full-screen room transitions (bedroom ↔ ship): heavy canvas blur plus
 * overlay fade-out / fade-in. Pure DOM/CSS — decoupled from the Three.js scene.
 */
export type RoomTransitionVariant = 'fall' | 'return';

const FADE_OUT_MS = 1500;
const BLACKOUT_MS = 1700;
const TOTAL_MS = 4000;

export class FallTransition {
  private readonly overlay: HTMLElement | null;
  private readonly canvas: HTMLCanvasElement | null;
  private playing = false;

  constructor() {
    this.overlay = document.getElementById('fall-overlay');
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** Bedroom floor portal → ship deck (fall streaks). */
  playFall(onBlackout: () => void, onComplete: () => void): void {
    this.play('fall', onBlackout, onComplete);
  }

  /** Ship deck → bedroom (soft crossfade, no streaks). */
  playReturn(onBlackout: () => void, onComplete: () => void): void {
    this.play('return', onBlackout, onComplete);
  }

  private play(
    variant: RoomTransitionVariant,
    onBlackout: () => void,
    onComplete: () => void,
  ): void {
    if (!this.overlay || this.playing) {
      onBlackout();
      onComplete();
      return;
    }
    this.playing = true;
    const overlay = this.overlay;

    overlay.classList.remove(
      'hidden',
      'transition-fade-in',
      'fall-variant',
      'return-variant',
    );
    overlay.classList.add(variant === 'fall' ? 'fall-variant' : 'return-variant');
    void overlay.offsetWidth;
    overlay.classList.add('transition-fade-out');
    this.canvas?.classList.add('room-transition-blur');

    window.setTimeout(() => onBlackout(), FADE_OUT_MS);

    window.setTimeout(() => {
      overlay.classList.remove('transition-fade-out');
      overlay.classList.add('transition-fade-in');
    }, BLACKOUT_MS);

    window.setTimeout(() => {
      this.finish(overlay);
      onComplete();
    }, TOTAL_MS);
  }

  private finish(overlay: HTMLElement): void {
    overlay.classList.remove(
      'transition-fade-out',
      'transition-fade-in',
      'fall-variant',
      'return-variant',
    );
    overlay.classList.add('hidden');
    this.canvas?.classList.remove('room-transition-blur');
    this.playing = false;
  }
}
