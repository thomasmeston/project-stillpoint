import itemsData from '../../data/items.json';
import {
  contentStorageKey,
  getDevLevel,
  isDevLevelId,
  type DevLevelId,
} from './DevLevelConfig';

export type ExamineOverride = {
  title?: string;
  body?: string;
  /** Literal inner-voice text shown on first examine */
  thought?: string;
};

export type ItemOverride = {
  label?: string;
  description?: string;
};

export type ContentOverrides = {
  /** First click anywhere in the level */
  openingThought?: string;
  /** Shown after intro word minigame (bedroom only) */
  wakeThought?: string;
  items: Record<string, ItemOverride>;
  examines: Record<string, ExamineOverride>;
};

export type MergedExamineEntry = {
  title: string;
  body: string;
  thought?: string;
  journal?: string;
};

const baseItems = itemsData.items as Record<string, { label: string; description?: string }>;

let activeRoomId: DevLevelId = 'bedroom';
let overrides: ContentOverrides = { items: {}, examines: {} };

function loadFromStorage(roomId: DevLevelId): ContentOverrides {
  try {
    const raw = localStorage.getItem(contentStorageKey(roomId));
    if (!raw) return { items: {}, examines: {} };
    const parsed = JSON.parse(raw) as ContentOverrides;
    return {
      openingThought: parsed.openingThought,
      wakeThought: parsed.wakeThought,
      items: parsed.items ?? {},
      examines: parsed.examines ?? {},
    };
  } catch {
    return { items: {}, examines: {} };
  }
}

overrides = loadFromStorage(activeRoomId);

export function setDevContentRoom(roomId: string): void {
  if (!isDevLevelId(roomId)) return;
  activeRoomId = roomId;
  overrides = loadFromStorage(roomId);
}

export function getDevContentRoomId(): DevLevelId {
  return activeRoomId;
}

export function getContentOverrides(): ContentOverrides {
  return overrides;
}

export function saveContentOverrides(data: ContentOverrides): void {
  overrides = data;
  localStorage.setItem(contentStorageKey(activeRoomId), JSON.stringify(data));
}

export function clearContentOverrides(roomId?: DevLevelId): void {
  const target = roomId ?? activeRoomId;
  overrides = { items: {}, examines: {} };
  localStorage.removeItem(contentStorageKey(target));
}

export function getOpeningThoughtOverride(): string | undefined {
  return overrides.openingThought;
}

export function setOpeningThoughtOverride(text: string): void {
  overrides.openingThought = text;
  saveContentOverrides(overrides);
}

export function getWakeThoughtOverride(): string | undefined {
  return overrides.wakeThought;
}

export function setWakeThoughtOverride(text: string): void {
  overrides.wakeThought = text;
  saveContentOverrides(overrides);
}

export function getBaseOpeningThought(roomId?: string): string {
  const level = getDevLevel(roomId ?? activeRoomId);
  const story = level?.storyData as { opening_thought?: string } | undefined;
  return story?.opening_thought ?? '';
}

export function getBaseWakeThought(roomId?: string): string {
  const level = getDevLevel(roomId ?? activeRoomId);
  if (!level?.afterIntroThoughtKey) return '';
  return level.storyData.thoughts[level.afterIntroThoughtKey] ?? '';
}

export function getEffectiveOpeningThought(roomId?: string): string {
  const levelId = isDevLevelId(roomId ?? activeRoomId) ? (roomId ?? activeRoomId) as DevLevelId : activeRoomId;
  const roomOverrides = roomId && roomId !== activeRoomId ? loadFromStorage(levelId) : overrides;
  if (roomOverrides.openingThought !== undefined) return roomOverrides.openingThought;
  return getBaseOpeningThought(levelId);
}

export function getEffectiveThoughtText(thoughtKey: string, roomId?: string): string {
  if (!thoughtKey) return '';
  const levelId = isDevLevelId(roomId ?? activeRoomId) ? (roomId ?? activeRoomId) as DevLevelId : activeRoomId;
  const level = getDevLevel(levelId);
  if (!level) return thoughtKey;

  const roomOverrides = roomId && roomId !== activeRoomId ? loadFromStorage(levelId) : overrides;
  if (level.afterIntroThoughtKey === thoughtKey && roomOverrides.wakeThought !== undefined) {
    return roomOverrides.wakeThought;
  }

  return level.storyData.thoughts[thoughtKey] ?? thoughtKey;
}

export function getExamineOverride(hotspotId: string): ExamineOverride | undefined {
  return overrides.examines[hotspotId];
}

export function setExamineOverride(hotspotId: string, patch: ExamineOverride): void {
  overrides.examines[hotspotId] = { ...overrides.examines[hotspotId], ...patch };
  saveContentOverrides(overrides);
}

export function getItemOverride(itemId: string): ItemOverride | undefined {
  return overrides.items[itemId];
}

export function setItemOverride(itemId: string, patch: ItemOverride): void {
  overrides.items[itemId] = { ...overrides.items[itemId], ...patch };
  saveContentOverrides(overrides);
}

export function resolveThoughtText(thoughtRef: string, roomId?: string): string {
  if (!thoughtRef) return '';
  const level = getDevLevel(roomId ?? activeRoomId);
  if (level?.storyData.thoughts[thoughtRef]) {
    return level.storyData.thoughts[thoughtRef];
  }
  const bedroom = getDevLevel('bedroom');
  return bedroom?.storyData.thoughts[thoughtRef] ?? thoughtRef;
}

function buildMergedEntry(
  hotspotId: string,
  base?: { title: string; body: string; thought?: string; journal?: string },
  ov?: ExamineOverride,
  story?: { examines: Record<string, unknown>; thoughts: Record<string, string> },
): MergedExamineEntry | null {
  const thoughtKey = base?.thought;
  const baseThoughtText = thoughtKey && story
    ? (story.thoughts[thoughtKey] ?? thoughtKey)
    : undefined;

  if (!base && !ov) return null;

  return {
    title: ov?.title ?? base?.title ?? hotspotId,
    body: ov?.body ?? base?.body ?? '',
    thought: ov?.thought !== undefined ? ov.thought : baseThoughtText,
    journal: base?.journal,
  };
}

export function mergeExamineEntry(
  hotspotId: string,
  base?: { title: string; body: string; thought?: string; journal?: string },
  roomId?: string,
): MergedExamineEntry | null {
  const levelId = isDevLevelId(roomId ?? activeRoomId) ? (roomId ?? activeRoomId) as DevLevelId : activeRoomId;
  if (roomId && isDevLevelId(roomId) && roomId !== activeRoomId) {
    const roomOverrides = loadFromStorage(roomId);
    const ov = roomOverrides.examines[hotspotId];
    const story = getDevLevel(roomId)?.storyData;
    return buildMergedEntry(hotspotId, base, ov, story);
  }

  const ov = overrides.examines[hotspotId];
  const story = getDevLevel(levelId)?.storyData;
  return buildMergedEntry(hotspotId, base, ov, story);
}

export function getEffectiveItemLabel(itemId: string): string {
  return overrides.items[itemId]?.label ?? baseItems[itemId]?.label ?? itemId;
}

export function getEffectiveItemDescription(itemId: string): string {
  return overrides.items[itemId]?.description ?? baseItems[itemId]?.description ?? '';
}

export function buildMergedStoryJson(roomId?: DevLevelId): Record<string, unknown> {
  const levelId = roomId ?? activeRoomId;
  const level = getDevLevel(levelId);
  if (!level) return {};

  const roomOverrides = roomId && roomId !== activeRoomId
    ? loadFromStorage(levelId)
    : overrides;

  const merged = JSON.parse(JSON.stringify(level.storyData)) as {
    opening_thought?: string;
    examines: Record<string, { title: string; body: string; thought?: string; journal?: string }>;
    thoughts: Record<string, string>;
  };

  if (roomOverrides.openingThought !== undefined) {
    merged.opening_thought = roomOverrides.openingThought;
  }
  if (roomOverrides.wakeThought !== undefined && level.afterIntroThoughtKey) {
    merged.thoughts[level.afterIntroThoughtKey] = roomOverrides.wakeThought;
  }

  for (const [hotspotId, ov] of Object.entries(roomOverrides.examines)) {
    const entry = merged.examines[hotspotId];
    if (!entry) {
      if (ov.title || ov.body || ov.thought) {
        merged.examines[hotspotId] = {
          title: ov.title ?? hotspotId,
          body: ov.body ?? '',
        };
        if (ov.thought) {
          const thoughtKey = `${hotspotId}_musings`;
          merged.examines[hotspotId].thought = thoughtKey;
          merged.thoughts[thoughtKey] = ov.thought;
        }
      }
      continue;
    }

    if (ov.title !== undefined) entry.title = ov.title;
    if (ov.body !== undefined) entry.body = ov.body;
    if (ov.thought !== undefined) {
      const thoughtKey = entry.thought;
      if (thoughtKey) {
        merged.thoughts[thoughtKey] = ov.thought;
      } else {
        const newKey = `${hotspotId}_musings`;
        entry.thought = newKey;
        merged.thoughts[newKey] = ov.thought;
      }
    }
  }

  return merged;
}

export function buildMergedItemsJson(): Record<string, unknown> {
  const merged = JSON.parse(JSON.stringify(itemsData)) as {
    items: Record<string, { label: string; description?: string }>;
    combine_rules: unknown[];
  };

  for (const [itemId, ov] of Object.entries(overrides.items)) {
    if (!merged.items[itemId]) continue;
    if (ov.label !== undefined) merged.items[itemId].label = ov.label;
    if (ov.description !== undefined) merged.items[itemId].description = ov.description;
  }

  return merged;
}

export function getBaseExamine(hotspotId: string, roomId?: DevLevelId): {
  title: string;
  body: string;
  thought?: string;
  journal?: string;
} | undefined {
  const level = getDevLevel(roomId ?? activeRoomId);
  return level?.storyData.examines[hotspotId];
}

export function getExamineThoughtKey(hotspotId: string, roomId?: DevLevelId): string {
  return getBaseExamine(hotspotId, roomId)?.thought ?? '';
}

export function getBaseThoughtForExamine(hotspotId: string, roomId?: DevLevelId): string {
  const level = getDevLevel(roomId ?? activeRoomId);
  const base = level?.storyData.examines[hotspotId];
  if (!base?.thought || !level) return '';
  return level.storyData.thoughts[base.thought] ?? base.thought;
}

export function getBaseItem(itemId: string) {
  return baseItems[itemId];
}

export function listItemIds(): string[] {
  return Object.keys(baseItems).sort();
}
