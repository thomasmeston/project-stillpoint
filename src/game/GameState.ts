import { EventBus } from '../utils/EventBus';

export type GameStateEvents = {
  flagChanged: { flag: string; value: boolean };
  puzzleSolved: string;
  gameWon: void;
};

export class GameState {
  readonly events = new EventBus<GameStateEvents>();

  flags: Record<string, boolean> = {};
  solvedPuzzles = new Set<string>();
  hasWon = false;

  setFlag(flag: string, value = true): void {
    if (this.flags[flag] === value) return;
    this.flags[flag] = value;
    this.events.emit('flagChanged', { flag, value });
    if (flag === 'door_unlocked' && value) {
      this.win();
    }
  }

  hasFlag(flag: string): boolean {
    return this.flags[flag] === true;
  }

  markPuzzleSolved(puzzleId: string): void {
    if (this.solvedPuzzles.has(puzzleId)) return;
    this.solvedPuzzles.add(puzzleId);
    this.events.emit('puzzleSolved', puzzleId);
  }

  isPuzzleSolved(puzzleId: string): boolean {
    return this.solvedPuzzles.has(puzzleId);
  }

  private win(): void {
    if (this.hasWon) return;
    this.hasWon = true;
    this.events.emit('gameWon', undefined);
  }

  getSaveData() {
    return {
      flags: { ...this.flags },
      solvedPuzzles: [...this.solvedPuzzles],
      hasWon: this.hasWon,
    };
  }

  loadSaveData(data: ReturnType<GameState['getSaveData']>): void {
    this.flags = { ...data.flags };
    this.solvedPuzzles = new Set(data.solvedPuzzles);
    this.hasWon = data.hasWon;
  }
}
