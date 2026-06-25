/**
 * Full-screen cinematic for falling through the bedroom floor portal onto the
 * pirate-ship deck. Pure DOM/CSS so it stays decoupled from the Three.js scene.
 */
export class FallTransition {
  private readonly overlay: HTMLElement | null;
  private playing = false;

  constructor() {
    this.overlay = document.getElementById('fall-overlay');
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Play the ~3s fall sequence.
   * @param onBlackout called while the screen is fully dark — swap rooms here.
   * @param onComplete called once the overlay has faded back out.
   */
  play(onBlackout: () => void, onComplete: () => void): void {
    if (!this.overlay || this.playing) {
      onBlackout();
      onComplete();
      return;
    }
    this.playing = true;
    const overlay = this.overlay;

    overlay.classList.remove('hidden', 'fall-rising');
    // Force reflow so the opacity transition starts from 0.
    void overlay.offsetWidth;
    overlay.classList.add('fall-falling');

    window.setTimeout(() => onBlackout(), 1500);

    window.setTimeout(() => {
      overlay.classList.remove('fall-falling');
      overlay.classList.add('fall-rising');
    }, 1750);

    window.setTimeout(() => {
      overlay.classList.remove('fall-rising');
      overlay.classList.add('hidden');
      this.playing = false;
      onComplete();
    }, 3000);
  }
}
