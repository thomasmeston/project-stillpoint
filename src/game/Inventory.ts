import { EventBus } from '../utils/EventBus';
import { getEffectiveItemDescription, getEffectiveItemLabel } from './DevContentOverrides';

export type InventoryEvents = {
  changed: void;
  itemSelected: string;
};

export class Inventory {
  readonly events = new EventBus<InventoryEvents>();

  items: string[] = [];
  selectedItem = '';

  getLabel(itemId: string): string {
    return getEffectiveItemLabel(itemId);
  }

  getDescription(itemId: string): string {
    return getEffectiveItemDescription(itemId);
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

  getSaveData() {
    return { items: [...this.items], selectedItem: this.selectedItem };
  }

  loadSaveData(data: ReturnType<Inventory['getSaveData']>): void {
    this.items = [...data.items];
    // Migrate old saves that had the removed combine result.
    if (this.items.includes('assembled_key')) {
      this.items = this.items.filter((id) => id !== 'assembled_key');
      if (!this.items.includes('key_blade')) this.items.push('key_blade');
      if (data.selectedItem === 'assembled_key') data.selectedItem = 'key_blade';
    }
    this.selectedItem = this.items.includes(data.selectedItem) ? data.selectedItem : '';
    this.events.emit('changed', undefined);
  }

  resetForNewGame(): void {
    this.items = [];
    this.selectedItem = '';
    this.events.emit('changed', undefined);
  }
}
