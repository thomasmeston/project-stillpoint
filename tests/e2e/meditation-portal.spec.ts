import { expect, test } from '@playwright/test';

const PORTAL_IDS = ['portal_ship', 'portal_garden', 'portal_cavern', 'portal_observatory'] as const;

type TestGame = {
  currentRoomId: string;
  gameState: { hasFlag: (flag: string) => boolean; setFlag: (flag: string, value?: boolean) => void };
  inventory: { addItem: (id: string) => void };
  puzzleManager: {
    getHotspotDef: (id: string) => { disabled?: boolean };
    isHotspotAvailable: (id: string) => boolean;
  };
  room: {
    portals: Map<string, { group: { visible: boolean } }>;
    hotspots: Array<{ id: string }>;
  };
  exitMeditate: () => void;
  enterPortal: (target: string) => void;
};


async function startFreshGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.locator('.new-game-btn[data-slot="3"]').click();
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const overlay = document.getElementById('intro-words-overlay');
    overlay?.querySelectorAll<HTMLElement>('.intro-word').forEach((word, i) => {
      if (i < 5) word.click();
    });
  });
  await page.waitForTimeout(1200);
}

function portalVisibility(g: TestGame): Record<string, boolean | null> {
  const out: Record<string, boolean | null> = {};
  for (const id of PORTAL_IDS) {
    out[id] = g.room.portals.get(id)?.group.visible ?? null;
  }
  return out;
}

test('portals stay hidden until first meditation opens the ship portal', async ({ page }) => {
  await startFreshGame(page);

  const state = await page.evaluate((ids) => {
    const g = (window as unknown as { game: TestGame }).game;
    const disabled: Record<string, boolean> = {};
    const visible: Record<string, boolean | null> = {};
    for (const id of ids) {
      disabled[id] = g.puzzleManager.getHotspotDef(id).disabled ?? true;
      visible[id] = g.room.portals.get(id)?.group.visible ?? null;
    }
    return {
      roomId: g.currentRoomId,
      portalFlag: g.gameState.hasFlag('meditation_portal_opened'),
      clockInspected: g.gameState.hasFlag('clock_inspected'),
      disabled,
      visible,
    };
  }, PORTAL_IDS);

  expect(state.roomId).toBe('bedroom');
  expect(state.portalFlag).toBe(false);
  expect(state.clockInspected).toBe(false);
  for (const id of PORTAL_IDS) {
    expect(state.disabled[id]).toBe(true);
    expect(state.visible[id]).toBe(false);
  }
});

test('first meditation reveals only the ship portal and it lands on the deck', async ({ page }) => {
  await startFreshGame(page);

  const afterReveal = await page.evaluate((ids) => {
    const g = (window as unknown as { game: TestGame }).game;
    g.gameState.setFlag('clock_inspected');
    g.gameState.setFlag('meditation_portal_opened', true);
    g.exitMeditate();
    const disabled: Record<string, boolean> = {};
    const visible: Record<string, boolean | null> = {};
    for (const id of ids) {
      disabled[id] = g.puzzleManager.getHotspotDef(id).disabled ?? true;
      visible[id] = g.room.portals.get(id)?.group.visible ?? null;
    }
    return {
      portalFlag: g.gameState.hasFlag('meditation_portal_opened'),
      disabled,
      visible,
    };
  }, PORTAL_IDS);

  expect(afterReveal.portalFlag).toBe(true);
  expect(afterReveal.disabled.portal_ship).toBe(false);
  expect(afterReveal.visible.portal_ship).toBe(true);
  for (const id of ['portal_garden', 'portal_cavern', 'portal_observatory'] as const) {
    expect(afterReveal.disabled[id]).toBe(true);
    expect(afterReveal.visible[id]).toBe(false);
  }

  await page.evaluate(() => (window as unknown as { game: TestGame }).game.enterPortal('pirate_ship'));
  await page.waitForTimeout(4200);

  const onShip = await page.evaluate(() => {
    const g = (window as unknown as { game: TestGame }).game;
    return {
      roomId: g.currentRoomId,
      hotspotIds: g.room.hotspots.map((h) => h.id),
      roomTitle: document.getElementById('room-title')?.textContent ?? null,
    };
  });

  expect(onShip.roomId).toBe('pirate_ship');
  expect(onShip.hotspotIds).toContain('treasure_chest');
  expect(onShip.roomTitle).toBe('Ship Deck');
});

test('return to room keeps the ship portal visible and re-enterable', async ({ page }) => {
  await startFreshGame(page);
  await page.evaluate(() => {
    const g = (window as unknown as { game: TestGame }).game;
    g.gameState.setFlag('clock_inspected');
    g.gameState.setFlag('meditation_portal_opened', true);
    g.exitMeditate();
  });
  await page.evaluate(() => (window as unknown as { game: TestGame }).game.enterPortal('pirate_ship'));
  await page.waitForTimeout(4200);

  const beforeReturn = await page.evaluate(() => ({
    returnBtnVisible: !document.getElementById('return-room-btn')?.classList.contains('hidden'),
    roomId: (window as unknown as { game: TestGame }).game.currentRoomId,
  }));
  expect(beforeReturn.returnBtnVisible).toBe(true);
  expect(beforeReturn.roomId).toBe('pirate_ship');

  await page.locator('#return-room-btn').click();
  await page.waitForTimeout(4200);

  const afterReturn = await page.evaluate((ids) => {
    const g = (window as unknown as { game: TestGame }).game;
    const disabled: Record<string, boolean> = {};
    const visible: Record<string, boolean | null> = {};
    for (const id of ids) {
      disabled[id] = g.puzzleManager.getHotspotDef(id).disabled ?? true;
      visible[id] = g.room.portals.get(id)?.group.visible ?? null;
    }
    return {
      roomId: g.currentRoomId,
      roomTitle: document.getElementById('room-title')?.textContent ?? null,
      returnBtnHidden: document.getElementById('return-room-btn')?.classList.contains('hidden'),
      disabled,
      visible,
    };
  }, PORTAL_IDS);

  expect(afterReturn.roomId).toBe('bedroom');
  expect(afterReturn.roomTitle).toBe('Bedroom');
  expect(afterReturn.returnBtnHidden).toBe(true);
  expect(afterReturn.disabled.portal_ship).toBe(false);
  expect(afterReturn.visible.portal_ship).toBe(true);
  for (const id of ['portal_garden', 'portal_cavern', 'portal_observatory'] as const) {
    expect(afterReturn.disabled[id]).toBe(true);
    expect(afterReturn.visible[id]).toBe(false);
  }
});

test('lesson flags unlock matching bedroom puzzle beats', async ({ page }) => {
  await startFreshGame(page);

  const gates = await page.evaluate(() => {
    const g = (window as unknown as { game: TestGame }).game;
    return {
      clockBefore: g.puzzleManager.isHotspotAvailable('wall_clock'),
      paintingBefore: g.puzzleManager.isHotspotAvailable('painting'),
      doorBefore: g.puzzleManager.isHotspotAvailable('door'),
    };
  });

  expect(gates.clockBefore).toBe(true);
  expect(gates.paintingBefore).toBe(false);
  expect(gates.doorBefore).toBe(false);

  const afterLessons = await page.evaluate(() => {
    const g = (window as unknown as { game: TestGame }).game;
    g.gameState.setFlag('lesson_1', true);
    g.gameState.setFlag('lesson_2', true);
    g.gameState.setFlag('desk_drawer_unlocked', true);
    g.gameState.setFlag('lesson_3', true);
    return {
      clock: g.puzzleManager.isHotspotAvailable('wall_clock'),
      painting: g.puzzleManager.isHotspotAvailable('painting'),
      doorWithoutLesson4: g.puzzleManager.isHotspotAvailable('door'),
    };
  });

  expect(afterLessons.clock).toBe(true);
  expect(afterLessons.painting).toBe(true);
  expect(afterLessons.doorWithoutLesson4).toBe(false);

  const doorReady = await page.evaluate(() => {
    const g = (window as unknown as { game: TestGame }).game;
    g.gameState.setFlag('lesson_4', true);
    g.inventory.addItem('cipher_disk');
    return g.puzzleManager.isHotspotAvailable('door');
  });

  expect(doorReady).toBe(true);
});

test('lesson flags reveal additional portals after the ship portal', async ({ page }) => {
  await startFreshGame(page);

  const afterLessons = await page.evaluate((ids) => {
    const g = (window as unknown as { game: TestGame }).game;
    g.gameState.setFlag('clock_inspected');
    g.gameState.setFlag('meditation_portal_opened', true);
    g.gameState.setFlag('lesson_2', true);
    g.gameState.setFlag('lesson_3', true);
    g.gameState.setFlag('lesson_4', true);
    g.exitMeditate();
    const visible: Record<string, boolean | null> = {};
    for (const id of ids) {
      visible[id] = g.room.portals.get(id)?.group.visible ?? null;
    }
    return visible;
  }, PORTAL_IDS);

  expect(afterLessons.portal_ship).toBe(true);
  expect(afterLessons.portal_garden).toBe(true);
  expect(afterLessons.portal_cavern).toBe(true);
  expect(afterLessons.portal_observatory).toBe(true);
});

test('garden portal lands in level 2 with correct title', async ({ page }) => {
  await startFreshGame(page);

  await page.evaluate(() => (window as unknown as { game: TestGame }).game.enterPortal('level_2'));
  await page.waitForTimeout(4200);

  const state = await page.evaluate(() => {
    const g = (window as unknown as { game: TestGame }).game;
    return {
      roomId: g.currentRoomId,
      roomTitle: document.getElementById('room-title')?.textContent ?? null,
      hotspotIds: g.room.hotspots.map((h) => h.id),
    };
  });

  expect(state.roomId).toBe('level_2');
  expect(state.roomTitle).toBe('Garden');
  expect(state.hotspotIds).toContain('garden_chest');
});
