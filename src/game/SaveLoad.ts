import type { GameState } from './GameState';
import type { Inventory } from './Inventory';
import type { NarrativeManager } from './NarrativeManager';
import type { PuzzleManager } from './PuzzleManager';

const getSaveKey = (slot: number) => `stillpoint_save_slot_${slot}`;

export class SaveLoad {
  save(
    gameState: GameState,
    inventory: Inventory,
    narrative: NarrativeManager,
    puzzleManager: PuzzleManager,
    playerPosition: { x: number; y: number; z: number },
    slot: number,
  ): void {
    const data = {
      version: 1,
      gameState: gameState.getSaveData(),
      inventory: inventory.getSaveData(),
      narrative: narrative.getSaveData(),
      puzzleManager: puzzleManager.getSaveData(),
      playerPosition,
      timestamp: Date.now()
    };
    localStorage.setItem(getSaveKey(slot), JSON.stringify(data));
  }

  load(slot: number): Record<string, unknown> | null {
    const raw = localStorage.getItem(getSaveKey(slot));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  delete(slot: number): void {
    localStorage.removeItem(getSaveKey(slot));
  }

  hasSave(slot: number): boolean {
    return localStorage.getItem(getSaveKey(slot)) !== null;
  }
}
