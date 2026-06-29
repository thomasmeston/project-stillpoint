import { createCalendarScrapInspectElement, createCalendarScrapRailThumb } from './calendarScrapInspect';
import { getItemPreviewRenderer } from './ItemPreviewRenderer';

export function mountItemRailVisual(itemId: string, container: HTMLElement): void {
  container.innerHTML = '';
  if (itemId === 'calendar_scrap') {
    container.appendChild(createCalendarScrapRailThumb());
    return;
  }

  const img = document.createElement('img');
  img.className = 'item-rail-preview';
  img.alt = '';
  img.draggable = false;
  img.src = getItemPreviewRenderer().getPreviewDataUrl(itemId, 72);
  container.appendChild(img);
}

export function mountItemInspectVisual(
  itemId: string,
  container: HTMLElement,
): { hideDescription: boolean } {
  container.innerHTML = '';
  if (itemId === 'calendar_scrap') {
    container.appendChild(createCalendarScrapInspectElement());
    return { hideDescription: true };
  }

  const img = document.createElement('img');
  img.className = 'item-inspect-preview';
  img.alt = '';
  img.draggable = false;
  img.src = getItemPreviewRenderer().getPreviewDataUrl(itemId, 220);
  container.appendChild(img);
  return { hideDescription: false };
}

export function invalidateItemPreviews(): void {
  getItemPreviewRenderer().clearCache();
}
