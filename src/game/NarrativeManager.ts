import storyData from '../../data/story/bedroom-script.json';
import { EventBus } from '../utils/EventBus';
import type { GameState } from './GameState';

type StoryFile = {
  opening_thought: string;
  thoughts: Record<string, string>;
  journal_entries: Record<string, { title: string; body: string; thought?: string }>;
  examines: Record<string, { title: string; body: string; thought?: string; journal?: string }>;
  on_flag: Record<string, { thought?: string; journal?: string }>;
  ending: { title: string; body: string; journal_id?: string };
};

export type NarrativeEvents = {
  examineShown: { title: string; body: string };
  thoughtShown: string;
  journalUpdated: void;
  winNarrative: { title: string; body: string };
};

export class NarrativeManager {
  readonly events = new EventBus<NarrativeEvents>();

  private data = storyData as StoryFile;
  private journalEntries: Record<string, StoryFile['journal_entries'][string]> = {};
  private triggered = new Set<string>();
  private openingShown = false;
  bindGameState(gs: GameState): void {
    gs.events.on('flagChanged', ({ flag }) => this.onFlag(flag));
  }

  onFirstInput(): void {
    if (this.openingShown) return;
    this.openingShown = true;
    if (this.data.opening_thought) {
      this.showThought(this.data.opening_thought);
    }
  }

  onExamine(hotspotId: string): void {
    const entry = this.data.examines[hotspotId];
    if (!entry) return;
    this.events.emit('examineShown', { title: entry.title, body: entry.body });
    this.fireTrigger(`examine:${hotspotId}`, entry);
  }

  onFlag(flagName: string): void {
    const entry = this.data.on_flag[flagName];
    if (entry) this.fireTrigger(`flag:${flagName}`, entry);
  }

  onWin(): void {
    const ending = this.data.ending;
    this.events.emit('winNarrative', { title: ending.title, body: ending.body });
    if (ending.journal_id) this.addJournalEntry(ending.journal_id);
  }

  showThought(thoughtId: string): void {
    if (!thoughtId) return;
    const text = this.data.thoughts[thoughtId] ?? thoughtId;
    this.events.emit('thoughtShown', text);
  }

  addJournalEntry(entryId: string): void {
    if (this.journalEntries[entryId]) return;
    const entry = this.data.journal_entries[entryId];
    if (!entry) return;
    this.journalEntries[entryId] = entry;
    this.events.emit('journalUpdated', undefined);
    if (entry.thought) this.showThought(entry.thought);
  }

  getJournalList() {
    return Object.entries(this.journalEntries)
      .map(([id, entry]) => ({ id, title: entry.title, body: entry.body }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private fireTrigger(
    key: string,
    entry: { thought?: string; journal?: string },
  ): void {
    if (!this.triggered.has(key)) this.triggered.add(key);
    if (entry.thought) this.showThought(entry.thought);
    if (entry.journal) this.addJournalEntry(entry.journal);
  }

  getSaveData() {
    return {
      journalEntries: { ...this.journalEntries },
      triggered: [...this.triggered],
      openingShown: this.openingShown,
    };
  }

  loadSaveData(data: ReturnType<NarrativeManager['getSaveData']>): void {
    this.journalEntries = { ...data.journalEntries };
    this.triggered = new Set(data.triggered);
    this.openingShown = data.openingShown;
    this.events.emit('journalUpdated', undefined);
  }
}
