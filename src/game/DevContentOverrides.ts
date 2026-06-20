import storyData from '../../data/story/bedroom-script.json';
import itemsData from '../../data/items.json';

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
  items: Record<string, ItemOverride>;
  examines: Record<string, ExamineOverride>;
};

const STORAGE_KEY = 'dev_content_overrides_bedroom';

const story = storyData as {
  examines: Record<string, { title: string; body: string; thought?: string; journal?: string }>;
  thoughts: Record<string, string>;
};

const baseItems = itemsData.items as Record<string, { label: string; description?: string }>;

let overrides: ContentOverrides = { items: {}, examines: {} };

function loadFromStorage(): ContentOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: {}, examines: {} };
    const parsed = JSON.parse(raw) as ContentOverrides;
    return {
      items: parsed.items ?? {},
      examines: parsed.examines ?? {},
    };
  } catch {
    return { items: {}, examines: {} };
  }
}

overrides = loadFromStorage();

export function getContentOverrides(): ContentOverrides {
  return overrides;
}

export function saveContentOverrides(data: ContentOverrides): void {
  overrides = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearContentOverrides(): void {
  overrides = { items: {}, examines: {} };
  localStorage.removeItem(STORAGE_KEY);
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

export function resolveThoughtText(thoughtRef: string): string {
  if (!thoughtRef) return '';
  return story.thoughts[thoughtRef] ?? thoughtRef;
}

export function mergeExamineEntry(
  hotspotId: string,
  base?: { title: string; body: string; thought?: string; journal?: string },
): { title: string; body: string; thought?: string; journal?: string } | null {
  const ov = overrides.examines[hotspotId];
  if (!base && !ov) return null;

  const thoughtKey = base?.thought;
  const baseThoughtText = thoughtKey ? (story.thoughts[thoughtKey] ?? thoughtKey) : undefined;

  return {
    title: ov?.title ?? base?.title ?? hotspotId,
    body: ov?.body ?? base?.body ?? '',
    thought: ov?.thought !== undefined ? ov.thought : baseThoughtText,
    journal: base?.journal,
  };
}

export function getEffectiveItemLabel(itemId: string): string {
  return overrides.items[itemId]?.label ?? baseItems[itemId]?.label ?? itemId;
}

export function getEffectiveItemDescription(itemId: string): string {
  return overrides.items[itemId]?.description ?? baseItems[itemId]?.description ?? '';
}

export function buildMergedStoryJson(): Record<string, unknown> {
  const merged = JSON.parse(JSON.stringify(storyData)) as {
    examines: Record<string, { title: string; body: string; thought?: string; journal?: string }>;
    thoughts: Record<string, string>;
  };

  for (const [hotspotId, ov] of Object.entries(overrides.examines)) {
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

export function getBaseExamine(hotspotId: string) {
  return story.examines[hotspotId];
}

export function getBaseThoughtForExamine(hotspotId: string): string {
  const base = story.examines[hotspotId];
  if (!base?.thought) return '';
  return story.thoughts[base.thought] ?? base.thought;
}

export function getBaseItem(itemId: string) {
  return baseItems[itemId];
}

export function listItemIds(): string[] {
  return Object.keys(baseItems).sort();
}
