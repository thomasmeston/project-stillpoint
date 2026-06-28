import bedroomRoom from '../../data/rooms/bedroom.json';
import shipRoom from '../../data/rooms/pirate-ship.json';
import level2Room from '../../data/rooms/level_2.json';
import level3Room from '../../data/rooms/level_3.json';
import level4Room from '../../data/rooms/level_4.json';

import bedroomStory from '../../data/story/bedroom-script.json';
import shipStory from '../../data/story/pirate-ship-script.json';
import level2Story from '../../data/story/level_2-script.json';
import level3Story from '../../data/story/level_3-script.json';
import level4Story from '../../data/story/level_4-script.json';

import bedroomPuzzles from '../../data/puzzles/bedroom.json';
import shipPuzzles from '../../data/puzzles/pirate-ship.json';
import level2Puzzles from '../../data/puzzles/level_2.json';
import level3Puzzles from '../../data/puzzles/level_3.json';
import level4Puzzles from '../../data/puzzles/level_4.json';

export type DevLevelId = 'bedroom' | 'pirate_ship' | 'level_2' | 'level_3' | 'level_4';

export type StoryData = {
  examines: Record<string, { title: string; body: string; thought?: string; journal?: string }>;
  thoughts: Record<string, string>;
};

export type PuzzleHotspot = {
  id?: string;
  item?: string;
};

type DevLevelDef = {
  title: string;
  roomPath: string;
  storyPath: string;
  roomData: Record<string, unknown>;
  storyData: StoryData;
  puzzleHotspots: PuzzleHotspot[];
  supportsItems: boolean;
  itemsPath?: string;
  /** Key in story `thoughts` shown after intro words (bedroom only) */
  afterIntroThoughtKey?: string;
};

export const DEV_LEVELS: Record<DevLevelId, DevLevelDef> = {
  bedroom: {
    title: 'Bedroom',
    roomPath: 'data/rooms/bedroom.json',
    storyPath: 'data/story/bedroom-script.json',
    itemsPath: 'data/items.json',
    roomData: bedroomRoom as Record<string, unknown>,
    storyData: bedroomStory as StoryData,
    puzzleHotspots: bedroomPuzzles.hotspots as PuzzleHotspot[],
    supportsItems: true,
    afterIntroThoughtKey: 'wake_beside_bed',
  },
  pirate_ship: {
    title: 'Ship Deck',
    roomPath: 'data/rooms/pirate-ship.json',
    storyPath: 'data/story/pirate-ship-script.json',
    roomData: shipRoom as Record<string, unknown>,
    storyData: shipStory as StoryData,
    puzzleHotspots: shipPuzzles.hotspots as PuzzleHotspot[],
    supportsItems: false,
  },
  level_2: {
    title: 'Garden',
    roomPath: 'data/rooms/level_2.json',
    storyPath: 'data/story/level_2-script.json',
    roomData: level2Room as Record<string, unknown>,
    storyData: level2Story as StoryData,
    puzzleHotspots: level2Puzzles.hotspots as PuzzleHotspot[],
    supportsItems: false,
  },
  level_3: {
    title: 'Cavern',
    roomPath: 'data/rooms/level_3.json',
    storyPath: 'data/story/level_3-script.json',
    roomData: level3Room as Record<string, unknown>,
    storyData: level3Story as StoryData,
    puzzleHotspots: level3Puzzles.hotspots as PuzzleHotspot[],
    supportsItems: false,
  },
  level_4: {
    title: 'Observatory',
    roomPath: 'data/rooms/level_4.json',
    storyPath: 'data/story/level_4-script.json',
    roomData: level4Room as Record<string, unknown>,
    storyData: level4Story as StoryData,
    puzzleHotspots: level4Puzzles.hotspots as PuzzleHotspot[],
    supportsItems: false,
  },
};

export function isDevLevelId(roomId: string): roomId is DevLevelId {
  return roomId in DEV_LEVELS;
}

export function getDevLevel(roomId: string): DevLevelDef | null {
  if (!isDevLevelId(roomId)) return null;
  return DEV_LEVELS[roomId];
}

export function layoutStorageKey(roomId: DevLevelId): string {
  return `dev_room_layout_${roomId}`;
}

export function contentStorageKey(roomId: DevLevelId): string {
  return `dev_content_overrides_${roomId}`;
}
