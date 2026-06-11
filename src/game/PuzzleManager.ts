import puzzleData from '../../data/puzzles/bedroom.json';
import { EventBus } from '../utils/EventBus';
import type { GameState } from './GameState';
import type { Inventory } from './Inventory';
import type { NarrativeManager } from './NarrativeManager';

type PuzzleDef = {
  id: string;
  type: string;
  solution: unknown;
  on_success?: string[];
};

type HotspotDef = {
  id?: string;
  action?: string;
  item?: string;
  puzzle?: string;
  disabled?: boolean;
  requires_flag?: string;
  requires_puzzle?: string;
};

type PuzzlesFile = {
  puzzles: PuzzleDef[];
  gates: Array<{ hotspot: string; requires: string[] }>;
  hotspots: HotspotDef[];
  item_uses: Array<{
    item: string;
    hotspot: string;
    requires?: string[];
    on_success?: string[];
    consume_item?: boolean;
  }>;
};

export type PuzzleEvents = {
  puzzleOpenRequested: { puzzleId: string; puzzleType: string };
  hotspotStateChanged: string;
};

export class PuzzleManager {
  readonly events = new EventBus<PuzzleEvents>();

  private data = puzzleData as PuzzlesFile;
  private puzzles = new Map(this.data.puzzles.map((p) => [p.id, p]));
  private gates = new Map(this.data.gates.map((g) => [g.hotspot, g]));
  private hotspots = new Map(
    this.data.hotspots
      .filter((h): h is HotspotDef & { id: string } => Boolean(h.id))
      .map((h) => [h.id, { ...h }]),
  );

  private gameState!: GameState;
  private inventory!: Inventory;
  private narrative!: NarrativeManager;

  bind(gs: GameState, inv: Inventory, nar: NarrativeManager): void {
    this.gameState = gs;
    this.inventory = inv;
    this.narrative = nar;
    gs.events.on('flagChanged', () => this.onFlagChanged());
  }

  getHotspotDef(id: string): HotspotDef {
    return this.hotspots.get(id) ?? { id };
  }

  isHotspotAvailable(id: string): boolean {
    const def = this.getHotspotDef(id);
    if (!def.id) return true;
    if (def.disabled) return false;
    if (def.requires_flag && !this.gameState.hasFlag(def.requires_flag)) return false;
    if (def.requires_puzzle && !this.gameState.isPuzzleSolved(def.requires_puzzle)) return false;
    const gate = this.gates.get(id);
    return this.checkRequirements(gate?.requires ?? []);
  }

  getHotspotAction(id: string): string {
    if (!this.isHotspotAvailable(id)) return 'locked';
    return this.getHotspotDef(id).action ?? 'examine';
  }

  requestPuzzle(puzzleId: string): void {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle || this.gameState.isPuzzleSolved(puzzleId)) return;
    this.events.emit('puzzleOpenRequested', {
      puzzleId,
      puzzleType: puzzle.type,
    });
  }

  submitPuzzle(puzzleId: string, answer: unknown): boolean {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) return false;
    if (this.gameState.isPuzzleSolved(puzzleId)) return true;
    if (!this.validateAnswer(puzzle, answer)) return false;
    this.gameState.markPuzzleSolved(puzzleId);
    for (const c of puzzle.on_success ?? []) {
      this.applyConsequence(c);
    }
    this.onFlagChanged();
    return true;
  }

  applyConsequence(consequence: string): void {
    if (consequence.startsWith('set_flag:')) {
      this.gameState.setFlag(consequence.slice(9));
    } else if (consequence.startsWith('clear_flag:')) {
      this.gameState.setFlag(consequence.slice(11), false);
    } else if (consequence.startsWith('give_item:')) {
      this.inventory.addItem(consequence.slice(10));
    } else if (consequence.startsWith('remove_item:')) {
      this.inventory.removeItem(consequence.slice(12));
    } else if (consequence.startsWith('journal:')) {
      this.narrative.addJournalEntry(consequence.slice(8));
    } else if (consequence.startsWith('thought:')) {
      this.narrative.showThought(consequence.slice(8));
    } else if (consequence.startsWith('disable_hotspot:')) {
      this.setHotspotDisabled(consequence.slice(16), true);
    } else if (consequence.startsWith('enable_hotspot:')) {
      this.setHotspotDisabled(consequence.slice(15), false);
    }
  }

  tryUseItemOnHotspot(itemId: string, hotspotId: string): boolean {
    for (const use of this.data.item_uses) {
      if (use.item !== itemId || use.hotspot !== hotspotId) continue;
      if (!this.checkRequirements(use.requires ?? [])) return false;
      for (const c of use.on_success ?? []) this.applyConsequence(c);
      if (use.consume_item) this.inventory.removeItem(itemId);
      this.inventory.selectItem('');
      return true;
    }
    return false;
  }

  private validateAnswer(puzzle: PuzzleDef, answer: unknown): boolean {
    switch (puzzle.type) {
      case 'clock': {
        const sol = puzzle.solution as { hour: number; minute: number };
        const ans = answer as { hour: number; minute: number };
        return ans.hour === sol.hour && ans.minute === sol.minute;
      }
      case 'photo_cipher':
        return String(answer).toUpperCase() === String(puzzle.solution).toUpperCase();
      case 'padlock': {
        const norm = (s: string) => s.toUpperCase().replace(/-/g, '');
        return norm(String(answer)) === norm(String(puzzle.solution));
      }
      default:
        return false;
    }
  }

  private checkRequirements(requirements: string[]): boolean {
    return requirements.every((req) => this.evaluateRequirement(req));
  }

  private evaluateRequirement(req: string): boolean {
    if (req.startsWith('flag:')) return this.gameState.hasFlag(req.slice(5));
    if (req.startsWith('not_flag:')) return !this.gameState.hasFlag(req.slice(9));
    if (req.startsWith('item:')) return this.inventory.hasItem(req.slice(5));
    if (req.startsWith('puzzle:')) return this.gameState.isPuzzleSolved(req.slice(7));
    if (req.startsWith('not_puzzle:')) return !this.gameState.isPuzzleSolved(req.slice(11));
    return true;
  }

  private setHotspotDisabled(id: string, disabled: boolean): void {
    const def = this.hotspots.get(id);
    if (!def) return;
    def.disabled = disabled;
    this.events.emit('hotspotStateChanged', id);
  }

  private onFlagChanged(): void {
    for (const id of this.hotspots.keys()) {
      this.events.emit('hotspotStateChanged', id);
    }
  }
}
