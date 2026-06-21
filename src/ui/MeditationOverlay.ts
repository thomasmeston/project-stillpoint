const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was', 'one', 'our',
  'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old',
  'see', 'way', 'who', 'did', 'let', 'say', 'she', 'too', 'use', 'that', 'this', 'with',
  'have', 'from', 'they', 'been', 'when', 'what', 'your', 'into', 'just', 'like', 'know',
  'take', 'than', 'them', 'then', 'some', 'will', 'would', 'there', 'their', 'about',
]);

function tokenizeForFloat(text: string): string[] {
  const tokens: string[] = [];
  const chunks = text.split(/[\n—–.!?;,]+/).map((s) => s.trim()).filter(Boolean);
  for (const chunk of chunks) {
    if (chunk.length <= 36) {
      tokens.push(chunk);
      continue;
    }
    const words = chunk.split(/\s+/).filter((w) => w.length > 0);
    for (let i = 0; i < words.length; i += 2) {
      const pair = words.slice(i, i + 2).join(' ');
      if (pair.length >= 3) tokens.push(pair);
    }
  }
  const singles = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  tokens.push(...singles);
  return tokens;
}

export class MeditationOverlay {
  private readonly root: HTMLElement;
  private readonly wordsHost: HTMLElement;
  private visible = false;

  constructor() {
    this.root = document.getElementById('meditate-overlay')!;
    this.wordsHost = document.getElementById('meditate-words')!;
  }

  isVisible(): boolean {
    return this.visible;
  }

  show(fragments: string[]): void {
    this.wordsHost.innerHTML = '';
    this.spawnWords(fragments.length > 0 ? fragments : ['still', 'point', 'remember', 'forget']);
    this.root.classList.remove('hidden');
    document.getElementById('game-canvas')?.classList.add('meditate-blur');
    this.visible = true;
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.wordsHost.innerHTML = '';
    document.getElementById('game-canvas')?.classList.remove('meditate-blur');
    this.visible = false;
  }

  private spawnWords(rawFragments: string[]): void {
    const expanded: string[] = [];
    const seen = new Set<string>();
    for (const fragment of rawFragments) {
      for (const token of tokenizeForFloat(fragment)) {
        const key = token.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        expanded.push(token);
      }
    }

    const slots: { col: number; row: number }[] = [];
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 9; r++) {
        slots.push({ col: c, row: r });
      }
    }
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    expanded.forEach((text, idx) => {
      if (idx >= slots.length) return;
      const slot = slots[idx];

      const containerEl = document.createElement('div');
      containerEl.className = 'intro-word-container meditate-word-container';

      const wordEl = document.createElement('span');
      wordEl.className = 'intro-word meditate-word';
      wordEl.textContent = text;

      const left = 2 + slot.col * 12 + Math.random() * 8;
      const top = 5 + slot.row * 10 + Math.random() * 6;
      containerEl.style.left = `${left}%`;
      containerEl.style.top = `${top}%`;

      const randVal = Math.random();
      let fontSize = 1.4;
      if (randVal < 0.35) {
        fontSize = 0.75 + Math.random() * 0.55;
      } else if (randVal < 0.7) {
        fontSize = 1.2 + Math.random() * 1.4;
      } else {
        fontSize = 2.4 + Math.random() * 2.2;
      }
      wordEl.style.fontSize = `${fontSize}rem`;

      const duration = 9 + Math.random() * 10;
      containerEl.style.animationDuration = `${duration}s`;
      containerEl.style.animationDelay = `${-Math.random() * duration}s`;

      containerEl.appendChild(wordEl);
      this.wordsHost.appendChild(containerEl);
    });
  }
}
