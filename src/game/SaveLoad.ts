import type { GameState } from './GameState';
import type { Inventory } from './Inventory';
import type { NarrativeManager } from './NarrativeManager';

const SAVE_KEY = 'lonniecrow_save_v1';

export class SaveLoad {
  save(
    gameState: GameState,
    inventory: Inventory,
    narrative: NarrativeManager,
    playerPosition: { x: number; y: number; z: number },
  ): void {
    const data = {
      version: 1,
      gameState: gameState.getSaveData(),
      inventory: inventory.getSaveData(),
      narrative: narrative.getSaveData(),
      playerPosition,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  load(): Record<string, unknown> | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  delete(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }
}
