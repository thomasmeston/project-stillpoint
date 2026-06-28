type WordEntry = {
  wordEl: HTMLElement;
};

export class ThoughtOverlay {
  onBlockingChange?: (active: boolean) => void;

  private overlay: HTMLElement;
  private anchorEl: HTMLElement | null = null;
  private dismissable = false;
  private fadeTimers: number[] = [];
  private dismissTimer: number | null = null;

  constructor() {
    this.overlay = document.getElementById('thought-words-overlay')!;
    this.overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tryDismiss();
    });
  }

  show(text: string): void {
    this.clear();

    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    this.dismissable = false;
    this.overlay.innerHTML = '';
    this.overlay.classList.remove('hidden', 'fade-out');
    this.onBlockingChange?.(true);

    const anchorEl = document.createElement('div');
    anchorEl.className = 'thought-sentence-anchor';
    this.anchorEl = anchorEl;

    const sentenceEl = document.createElement('div');
    sentenceEl.className = 'thought-sentence floating';

    const duration = 10 + Math.random() * 6;
    sentenceEl.style.animationDuration = `${duration}s`;
    sentenceEl.style.animationDelay = `${-Math.random() * duration}s`;

    const entries: WordEntry[] = [];
    words.forEach((word) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'thought-word';
      wordEl.textContent = word;
      sentenceEl.appendChild(wordEl);
      entries.push({ wordEl });
    });

    anchorEl.appendChild(sentenceEl);
    this.overlay.appendChild(anchorEl);

    const order = entries.map((_, i) => i);
    this.shuffle(order);

    let revealed = 0;
    const onAllRevealed = (): void => {
      this.dismissable = true;
      this.overlay.classList.add('dismissable');
    };

    order.forEach((entryIdx) => {
      const delay = 120 + Math.random() * 1400;
      const timer = window.setTimeout(() => {
        entries[entryIdx].wordEl.classList.add('visible');
        revealed += 1;
        if (revealed >= entries.length) onAllRevealed();
      }, delay);
      this.fadeTimers.push(timer);
    });
  }

  private tryDismiss(): void {
    if (!this.dismissable) return;
    this.dismiss();
  }

  private dismiss(): void {
    this.dismissable = false;
    this.overlay.classList.remove('dismissable');
    this.overlay.classList.add('fade-out');
    this.anchorEl?.classList.add('dismissed');

    if (this.dismissTimer) window.clearTimeout(this.dismissTimer);
    this.dismissTimer = window.setTimeout(() => {
      this.overlay.classList.add('hidden');
      this.overlay.innerHTML = '';
      this.overlay.classList.remove('fade-out');
      this.anchorEl = null;
      this.dismissTimer = null;
      this.onBlockingChange?.(false);
    }, 900);
  }

  private clear(): void {
    for (const timer of this.fadeTimers) window.clearTimeout(timer);
    this.fadeTimers = [];
    if (this.dismissTimer) {
      window.clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this.dismissable = false;
    this.anchorEl = null;
    this.overlay.classList.remove('dismissable', 'fade-out');
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
