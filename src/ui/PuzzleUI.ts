export class PuzzleUI {
  private clockModal = document.getElementById('clock-modal')!;
  private clockHour = document.getElementById('clock-hour') as HTMLInputElement;
  private clockMinute = document.getElementById('clock-minute') as HTMLInputElement;
  private photoModal = document.getElementById('photo-modal')!;
  private photoTiles = document.getElementById('photo-tiles')!;
  private combineModal = document.getElementById('combine-modal')!;
  private combineA = document.getElementById('combine-a') as HTMLSelectElement;
  private combineB = document.getElementById('combine-b') as HTMLSelectElement;
  private padlockModal = document.getElementById('padlock-modal')!;
  private padlockEntry = document.getElementById('padlock-entry') as HTMLInputElement;

  private activePuzzleId = '';
  private photoLetters: string[] = ['L', 'I', 'T', 'S', 'L'];

  onClockSubmit?: (puzzleId: string, hour: number, minute: number) => void;
  onPhotoSubmit?: (puzzleId: string, answer: string) => void;
  onPadlockSubmit?: (puzzleId: string, answer: string) => void;
  onCombine?: (a: string, b: string) => void;
  getInventoryItems?: () => string[];
  getItemLabel?: (id: string) => string;

  constructor() {
    document.getElementById('clock-submit')!.addEventListener('click', () => {
      this.onClockSubmit?.(this.activePuzzleId, Number(this.clockHour.value), Number(this.clockMinute.value));
    });
    document.getElementById('clock-close')!.addEventListener('click', () => this.closeClock());
    document.getElementById('photo-submit')!.addEventListener('click', () => {
      this.onPhotoSubmit?.(this.activePuzzleId, this.photoLetters.join(''));
    });
    document.getElementById('photo-close')!.addEventListener('click', () => this.closePhoto());
    document.getElementById('combine-submit')!.addEventListener('click', () => {
      const a = this.combineA.value;
      const b = this.combineB.value;
      if (a && b) this.onCombine?.(a, b);
      this.closeCombine();
    });
    document.getElementById('combine-close')!.addEventListener('click', () => this.closeCombine());
    document.getElementById('padlock-submit')!.addEventListener('click', () => this.submitPadlock());
    document.getElementById('padlock-close')!.addEventListener('click', () => this.closePadlock());
    this.padlockEntry.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitPadlock();
    });
  }

  openClock(puzzleId: string): void {
    this.activePuzzleId = puzzleId;
    this.clockHour.value = '12';
    this.clockMinute.value = '0';
    this.clockModal.classList.remove('hidden');
  }

  closeClock(): void {
    this.clockModal.classList.add('hidden');
  }

  openPhoto(puzzleId: string): void {
    this.activePuzzleId = puzzleId;
    this.photoLetters = ['L', 'I', 'T', 'S', 'L'];
    this.renderPhotoTiles();
    this.photoModal.classList.remove('hidden');
  }

  closePhoto(): void {
    this.photoModal.classList.add('hidden');
  }

  openPadlock(puzzleId: string): void {
    this.activePuzzleId = puzzleId;
    const titleEl = document.querySelector('#padlock-modal h2');
    const isSafe = puzzleId === 'wall_safe_lock';
    if (titleEl) titleEl.textContent = isSafe ? 'Wall Safe Dial' : 'Door Padlock';
    this.padlockEntry.placeholder = isSafe ? 'STILL' : 'STILLPOINT';
    this.padlockEntry.value = '';
    this.padlockModal.classList.remove('hidden');
    this.padlockEntry.focus();
  }

  closePadlock(): void {
    this.padlockModal.classList.add('hidden');
  }

  openCombine(): void {
    const items = this.getInventoryItems?.() ?? [];
    this.fillSelect(this.combineA, items);
    this.fillSelect(this.combineB, items);
    this.combineModal.classList.remove('hidden');
  }

  closeCombine(): void {
    this.combineModal.classList.add('hidden');
  }

  private submitPadlock(): void {
    this.onPadlockSubmit?.(this.activePuzzleId, this.padlockEntry.value.trim());
  }

  private fillSelect(select: HTMLSelectElement, items: string[]): void {
    select.innerHTML = '<option value="">(select)</option>';
    for (const id of items) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = this.getItemLabel?.(id) ?? id;
      select.appendChild(opt);
    }
  }

  private renderPhotoTiles(): void {
    this.photoTiles.innerHTML = '';
    this.photoLetters.forEach((letter, index) => {
      const btn = document.createElement('button');
      btn.className = 'photo-tile';
      btn.textContent = letter;
      btn.addEventListener('click', () => {
        const next = (index + 1) % this.photoLetters.length;
        [this.photoLetters[index], this.photoLetters[next]] = [
          this.photoLetters[next],
          this.photoLetters[index],
        ];
        this.renderPhotoTiles();
      });
      this.photoTiles.appendChild(btn);
    });
  }
}
