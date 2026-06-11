import itemsData from '../../data/items.json';
import { EventBus } from '../utils/EventBus';
import type { PuzzleManager } from './PuzzleManager';

export type InventoryEvents = {
  changed: void;
  itemSelected: string;
  combineFailed: { a: string; b: string };
};

export class Inventory {
  readonly events = new EventBus<InventoryEvents>();

  items: string[] = [];
  selectedItem = '';
  private defs = itemsData.items as Record<string, { label: string; description?: string }>;
  private combineRules = itemsData.combine_rules;
  private puzzleManager: PuzzleManager | null = null;

  bindPuzzleManager(pm: PuzzleManager): void {
    this.puzzleManager = pm;
  }

  getLabel(itemId: string): string {
    return this.defs[itemId]?.label ?? itemId;
  }

  hasItem(itemId: string): boolean {
    return this.items.includes(itemId);
  }

  addItem(itemId: string): boolean {
    if (!itemId || this.hasItem(itemId)) return false;
    this.items.push(itemId);
    this.events.emit('changed', undefined);
    return true;
  }

  removeItem(itemId: string): boolean {
    if (!this.hasItem(itemId)) return false;
    this.items = this.items.filter((id) => id !== itemId);
    if (this.selectedItem === itemId) this.selectedItem = '';
    this.events.emit('changed', undefined);
    return true;
  }

  selectItem(itemId: string): void {
    if (!itemId) {
      this.selectedItem = '';
      this.events.emit('itemSelected', '');
      return;
    }
    if (!this.hasItem(itemId)) return;
    this.selectedItem = this.selectedItem === itemId ? '' : itemId;
    this.events.emit('itemSelected', this.selectedItem);
  }

  tryCombine(itemA: string, itemB: string): string {
    if (itemA === itemB) return '';
    for (const rule of this.combineRules) {
      const [a, b] = rule.inputs;
      const match =
        (itemA === a && itemB === b) || (itemA === b && itemB === a);
      if (match && this.hasItem(a) && this.hasItem(b)) {
        this.removeItem(a);
        this.removeItem(b);
        this.addItem(rule.result);
        for (const consequence of rule.on_success ?? []) {
          this.puzzleManager?.applyConsequence(consequence);
        }
        return rule.result;
      }
    }
    this.events.emit('combineFailed', { a: itemA, b: itemB });
    return '';
  }

  getSaveData() {
    return { items: [...this.items], selectedItem: this.selectedItem };
  }

  loadSaveData(data: ReturnType<Inventory['getSaveData']>): void {
    this.items = [...data.items];
    this.selectedItem = data.selectedItem;
    this.events.emit('changed', undefined);
  }
}
