import type { Inventory } from '../game/Inventory';
import type { NarrativeManager } from '../game/NarrativeManager';
import type { PuzzleManager } from '../game/PuzzleManager';
import { ThoughtOverlay } from './ThoughtOverlay';
import { mountItemInspectVisual, mountItemRailVisual } from './itemVisuals';

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
  private inventoryRail = document.getElementById('inventory-rail')!;
  private itemInspectOverlay = document.getElementById('item-inspect-overlay')!;
  private itemInspectVisual = document.getElementById('item-inspect-visual')!;
  private itemInspectTitle = document.getElementById('item-inspect-title')!;
  private itemInspectBody = document.getElementById('item-inspect-body')!;
  private itemInspectDismiss = document.getElementById('item-inspect-dismiss')!;
  private itemInspectUse = document.getElementById('item-inspect-use')!;
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

  private inspectedItemId = '';

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

    this.itemInspectDismiss.addEventListener('click', () => this.hideItemInspect());
    this.itemInspectOverlay.addEventListener('click', (e) => {
      if (e.target === this.itemInspectOverlay) this.hideItemInspect();
    });
    this.itemInspectUse.addEventListener('click', () => this.toggleItemArmed());

    this.thoughtOverlay.onBlockingChange = (active) => this.onThoughtBlockingChange?.(active);

    this.narrative.events.on('examineShown', ({ title, body }) => this.showExamine(title, body));
    this.narrative.events.on('thoughtShown', (text) => this.showThought(text));
    this.narrative.events.on('journalUpdated', () => this.refreshJournal());
    this.narrative.events.on('winNarrative', ({ title, body }) => this.showWin(title, body));
    this.inventory.events.on('changed', () => this.renderInventory());
    this.inventory.events.on('itemSelected', () => {
      this.renderInventory();
      this.updateItemInspectUseButton();
    });

    this.renderInventory();
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

  isItemInspectOpen(): boolean {
    return !this.itemInspectOverlay.classList.contains('hidden');
  }

  hideExamine(): void {
    this.examinePanel.classList.add('hidden');
    this.onExamineDismiss?.();
  }

  hideItemInspect(): void {
    this.itemInspectOverlay.classList.add('hidden');
    this.itemInspectOverlay.setAttribute('aria-hidden', 'true');
    this.inspectedItemId = '';
    this.itemInspectVisual.innerHTML = '';
    this.itemInspectVisual.classList.remove('calendar-mode');
    this.itemInspectBody.classList.remove('hidden');
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
    this.inventoryRail.innerHTML = '';
    const hasItems = this.inventory.items.length > 0;
    this.inventoryRail.classList.toggle('hidden', !hasItems);

    for (const itemId of this.inventory.items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inv-rail-slot';
      btn.dataset.itemId = itemId;
      btn.title = this.inventory.getLabel(itemId);
      btn.setAttribute('aria-label', this.inventory.getLabel(itemId));
      if (this.inventory.selectedItem === itemId) btn.classList.add('armed');

      const visual = document.createElement('span');
      visual.className = 'inv-rail-visual';
      mountItemRailVisual(itemId, visual);
      btn.appendChild(visual);

      btn.addEventListener('click', () => this.showItemInspect(itemId));
      this.inventoryRail.appendChild(btn);
    }

    if (this.inspectedItemId && !this.inventory.hasItem(this.inspectedItemId)) {
      this.hideItemInspect();
    } else if (this.inspectedItemId && this.isItemInspectOpen()) {
      this.showItemInspect(this.inspectedItemId);
    }
  }

  private showItemInspect(itemId: string): void {
    if (!this.inventory.hasItem(itemId)) return;

    this.inspectedItemId = itemId;
    this.itemInspectTitle.textContent = this.inventory.getLabel(itemId);

    const { hideDescription } = mountItemInspectVisual(itemId, this.itemInspectVisual);
    this.itemInspectVisual.classList.toggle('calendar-mode', itemId === 'calendar_scrap');

    if (hideDescription) {
      this.itemInspectBody.textContent = '';
      this.itemInspectBody.classList.add('hidden');
    } else {
      this.itemInspectBody.textContent = this.inventory.getDescription(itemId);
      this.itemInspectBody.classList.remove('hidden');
    }

    this.itemInspectOverlay.classList.remove('hidden');
    this.itemInspectOverlay.setAttribute('aria-hidden', 'false');
    this.updateItemInspectUseButton();
  }

  private updateItemInspectUseButton(): void {
    if (!this.inspectedItemId) return;
    const armed = this.inventory.selectedItem === this.inspectedItemId;
    this.itemInspectUse.classList.remove('hidden');
    this.itemInspectUse.classList.toggle('armed', armed);
    this.itemInspectUse.textContent = armed ? 'Cancel use' : 'Use on object';
  }

  private toggleItemArmed(): void {
    if (!this.inspectedItemId) return;
    if (this.inventory.selectedItem === this.inspectedItemId) {
      this.inventory.selectItem('');
    } else {
      this.inventory.selectItem(this.inspectedItemId);
    }
    this.updateItemInspectUseButton();
    this.renderInventory();
  }

  private showWin(title: string, body: string): void {
    this.winTitle.textContent = title;
    this.winBody.textContent = body;
    this.winOverlay.classList.remove('hidden');
  }

  getHintForHotspot(id: string | null): string {
    if (!id) return 'Walk';
    if (this.inventory.selectedItem) return 'Use item';
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
