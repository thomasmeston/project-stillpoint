import type { Inventory } from '../game/Inventory';
import type { NarrativeManager } from '../game/NarrativeManager';
import type { PuzzleManager } from '../game/PuzzleManager';

export class HUD {
  private examinePanel = document.getElementById('examine-panel')!;
  private examineTitle = document.getElementById('examine-title')!;
  private examineBody = document.getElementById('examine-body')!;
  private examineClose = document.getElementById('examine-close')!;
  private thoughtToast = document.getElementById('thought-toast')!;
  private thoughtText = document.getElementById('thought-text')!;
  private journalPanel = document.getElementById('journal-panel')!;
  private journalList = document.getElementById('journal-list') as HTMLSelectElement;
  private journalDetail = document.getElementById('journal-detail')!;
  private journalToggle = document.getElementById('journal-toggle')!;
  private inventoryBar = document.getElementById('inventory-bar')!;
  private cursorLabel = document.getElementById('cursor-label')!;
  private winOverlay = document.getElementById('win-overlay')!;
  private winTitle = document.getElementById('win-title')!;
  private winBody = document.getElementById('win-body')!;
  private winRestart = document.getElementById('win-restart')!;
  private viewControls = document.getElementById('view-controls')!;
  private zoomBackBtn = document.getElementById('zoom-back-btn')!;

  private thoughtTimer: number | null = null;
  onZoomBack?: () => void;

  constructor(
    private inventory: Inventory,
    private narrative: NarrativeManager,
    private puzzleManager: PuzzleManager,
  ) {
    this.examineClose.addEventListener('click', () => this.hideExamine());
    this.journalToggle.addEventListener('click', () => this.toggleJournal());
    this.journalList.addEventListener('change', () => this.renderJournalDetail());
    this.winRestart.addEventListener('click', () => location.reload());
    this.zoomBackBtn.addEventListener('click', () => this.onZoomBack?.());

    this.narrative.events.on('examineShown', ({ title, body }) => this.showExamine(title, body));
    this.narrative.events.on('thoughtShown', (text) => this.showThought(text));
    this.narrative.events.on('journalUpdated', () => this.refreshJournal());
    this.narrative.events.on('winNarrative', ({ title, body }) => this.showWin(title, body));
    this.inventory.events.on('changed', () => this.renderInventory());
    this.inventory.events.on('itemSelected', () => this.renderInventory());
  }

  setCursorHint(hint: string, x: number, y: number): void {
    this.cursorLabel.textContent = hint;
    this.cursorLabel.style.left = `${x + 16}px`;
    this.cursorLabel.style.top = `${y + 16}px`;
  }

  private showExamine(title: string, body: string): void {
    this.examineTitle.textContent = title;
    this.examineBody.textContent = body;
    this.examinePanel.classList.remove('hidden');
  }

  private hideExamine(): void {
    this.examinePanel.classList.add('hidden');
  }

  private showThought(text: string): void {
    this.thoughtText.textContent = text;
    this.thoughtToast.classList.remove('hidden');
    this.thoughtToast.classList.add('visible');
    if (this.thoughtTimer) window.clearTimeout(this.thoughtTimer);
    this.thoughtTimer = window.setTimeout(() => {
      this.thoughtToast.classList.remove('visible');
      window.setTimeout(() => this.thoughtToast.classList.add('hidden'), 350);
    }, 4000);
  }

  private toggleJournal(): void {
    this.journalPanel.classList.toggle('hidden');
    if (!this.journalPanel.classList.contains('hidden')) this.refreshJournal();
  }

  refreshJournal(): void {
    const entries = this.narrative.getJournalList();
    this.journalList.innerHTML = '';
    for (const entry of entries) {
      const opt = document.createElement('option');
      opt.value = entry.id;
      opt.textContent = entry.title;
      this.journalList.appendChild(opt);
    }
    this.renderJournalDetail();
  }

  private renderJournalDetail(): void {
    const entries = this.narrative.getJournalList();
    const selected = entries.find((e) => e.id === this.journalList.value);
    this.journalDetail.textContent = selected?.body ?? 'Clues appear here.';
  }

  private renderInventory(): void {
    this.inventoryBar.innerHTML = '';
    for (const itemId of this.inventory.items) {
      const btn = document.createElement('button');
      btn.className = 'inv-slot';
      if (this.inventory.selectedItem === itemId) btn.classList.add('selected');
      btn.textContent = this.inventory.getLabel(itemId);
      btn.addEventListener('click', () => this.inventory.selectItem(itemId));
      this.inventoryBar.appendChild(btn);
    }
  }

  private showWin(title: string, body: string): void {
    this.winTitle.textContent = title;
    this.winBody.textContent = body;
    this.winOverlay.classList.remove('hidden');
  }

  getHintForHotspot(id: string | null): string {
    if (!id) return 'Walk';
    if (!this.puzzleManager.isHotspotAvailable(id)) return 'Locked';
    const action = this.puzzleManager.getHotspotAction(id);
    switch (action) {
      case 'pickup': return 'Take';
      case 'open_puzzle': return 'Use';
      case 'combine': return 'Combine';
      case 'sit': return 'Sit';
      default: return 'Examine';
    }
  }

  showZoomControls(showBack: boolean): void {
    if (showBack) {
      this.viewControls.classList.add('hidden');
      this.zoomBackBtn.classList.remove('hidden');
    } else {
      this.viewControls.classList.remove('hidden');
      this.zoomBackBtn.classList.add('hidden');
    }
  }
}
