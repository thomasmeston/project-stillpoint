import type { Inventory } from '../game/Inventory';
import type { NarrativeManager } from '../game/NarrativeManager';
import type { PuzzleManager } from '../game/PuzzleManager';
import { ThoughtOverlay } from './ThoughtOverlay';

export class HUD {
  private examinePanel = document.getElementById('examine-panel')!;
  private examineTitle = document.getElementById('examine-title')!;
  private examineBody = document.getElementById('examine-body')!;
  private examineDismiss = document.getElementById('examine-dismiss')!;
  private thoughtOverlay = new ThoughtOverlay();
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
  private meditateBtn = document.getElementById('meditate-btn')!;
  private meditateReturnBtn = document.getElementById('meditate-return-btn')!;
  private returnRoomBtn = document.getElementById('return-room-btn')!;

  onThoughtBlockingChange?: (active: boolean) => void;
  onZoomBack?: () => void;
  onMeditate?: () => void;
  onReturnToRoom?: () => void;
  onExamineDismiss?: () => void;

  constructor(
    private inventory: Inventory,
    private narrative: NarrativeManager,
    private puzzleManager: PuzzleManager,
  ) {
    this.examineDismiss.addEventListener('click', () => this.hideExamine());
    this.journalToggle.addEventListener('click', () => this.toggleJournal());
    this.journalList.addEventListener('change', () => this.renderJournalDetail());
    this.winRestart.addEventListener('click', () => location.reload());
    this.zoomBackBtn.addEventListener('click', () => this.onZoomBack?.());
    this.meditateBtn.addEventListener('click', () => this.onMeditate?.());
    this.meditateReturnBtn.addEventListener('click', () => this.onMeditate?.());
    this.returnRoomBtn.addEventListener('click', () => this.onReturnToRoom?.());

    this.thoughtOverlay.onBlockingChange = (active) => this.onThoughtBlockingChange?.(active);

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

  setCursorHintVisible(visible: boolean): void {
    this.cursorLabel.classList.toggle('hidden', !visible);
  }

  isExamineOpen(): boolean {
    return !this.examinePanel.classList.contains('hidden');
  }

  hideExamine(): void {
    this.examinePanel.classList.add('hidden');
    this.onExamineDismiss?.();
  }

  private showExamine(title: string, body: string): void {
    this.examineTitle.textContent = title;
    this.examineBody.textContent = body;
    this.examinePanel.classList.remove('hidden');
  }

  private showThought(text: string): void {
    this.thoughtOverlay.show(text);
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
      default: return 'Examine';
    }
  }

  showZoomControls(showBack: boolean): void {
    if (showBack) {
      this.viewControls.classList.add('hidden');
      this.zoomBackBtn.classList.remove('hidden');
      this.meditateBtn.classList.add('hidden');
    } else {
      this.viewControls.classList.remove('hidden');
      this.zoomBackBtn.classList.add('hidden');
      this.meditateBtn.classList.remove('hidden');
    }
  }

  setMeditating(active: boolean): void {
    this.meditateBtn.textContent = active ? 'Return' : 'Meditate';
    this.meditateBtn.classList.toggle('meditate-active', active);
    this.meditateBtn.classList.toggle('hidden', active);
    this.meditateReturnBtn.classList.toggle('hidden', !active);
  }

  setRoomTitle(name: string): void {
    const el = document.getElementById('room-title');
    if (el) el.textContent = name;
  }

  setMeditateAvailable(available: boolean): void {
    this.meditateBtn.classList.toggle('meditate-unavailable', !available);
  }

  setReturnToRoomVisible(visible: boolean): void {
    this.returnRoomBtn.classList.toggle('hidden', !visible);
  }
}
