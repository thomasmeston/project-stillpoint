import { expect, test } from '@playwright/test';

type TestGame = {
  currentRoomId: string;
  gameState: { hasFlag: (flag: string) => boolean; setFlag: (flag: string, value?: boolean) => void };
  narrative: { showThought: (id: string) => void; getHeardThoughtCount: () => number };
  puzzleManager: { getHotspotDef: (id: string) => { disabled?: boolean } };
  room: { floorPortal: { visible: boolean } | null; hotspots: Array<{ id: string }> };
  exitMeditate: () => void;
  startFallToShip: () => void;
};

const getGame = () => (window as unknown as { game: TestGame }).game;

async function startFreshGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.locator('.new-game-btn[data-slot="3"]').click();
  await page.waitForTimeout(800);
  // Clear the intro words so the HUD/game is interactive.
  await page.evaluate(() => {
    const overlay = document.getElementById('intro-words-overlay');
    overlay?.querySelectorAll<HTMLElement>('.intro-word').forEach((word, i) => {
      if (i < 5) word.click();
    });
  });
  await page.waitForTimeout(1200);
}

test('floor portal stays hidden until the meditation gate is cleared', async ({ page }) => {
  await startFreshGame(page);

  const state = await page.evaluate(() => {
    const g = (window as unknown as { game: any }).game;
    return {
      roomId: g.currentRoomId,
      portalFlag: g.gameState.hasFlag('meditation_portal_opened'),
      portalDisabled: g.puzzleManager.getHotspotDef('floor_portal').disabled,
      portalVisible: g.room.floorPortal ? g.room.floorPortal.visible : null,
    };
  });

  expect(state.roomId).toBe('bedroom');
  expect(state.portalFlag).toBe(false);
  expect(state.portalDisabled).toBe(true);
  expect(state.portalVisible).toBe(false);
});

test('portal reveals after gate is met, and the fall lands on the ship deck', async ({ page }) => {
  await startFreshGame(page);

  // Seed four distinct heard thoughts to satisfy the >=4 gate, set the unlock
  // flag, then run the real exit-meditation reveal path.
  const afterReveal = await page.evaluate(() => {
    const g = (window as unknown as { game: any }).game;
    for (let i = 0; i < 4; i++) g.narrative.showThought(`smoke_thought_${i}`);
    g.gameState.setFlag('meditation_portal_opened', true);
    g.exitMeditate();
    return {
      heardCount: g.narrative.getHeardThoughtCount(),
      portalFlag: g.gameState.hasFlag('meditation_portal_opened'),
      portalDisabled: g.puzzleManager.getHotspotDef('floor_portal').disabled,
      portalVisible: g.room.floorPortal ? g.room.floorPortal.visible : null,
    };
  });

  expect(afterReveal.heardCount).toBeGreaterThanOrEqual(4);
  expect(afterReveal.portalFlag).toBe(true);
  expect(afterReveal.portalDisabled).toBe(false);
  expect(afterReveal.portalVisible).toBe(true);

  // Trigger the fall and wait for the ~3s transition to complete.
  await page.evaluate(() => (window as unknown as { game: any }).game.startFallToShip());
  await page.waitForTimeout(3400);

  const onShip = await page.evaluate(() => {
    const g = (window as unknown as { game: any }).game;
    return {
      roomId: g.currentRoomId,
      hotspotIds: g.room.hotspots.map((h: { id: string }) => h.id),
      roomTitle: document.getElementById('room-title')?.textContent ?? null,
    };
  });

  expect(onShip.roomId).toBe('pirate_ship');
  expect(onShip.hotspotIds).toContain('treasure_chest');
  expect(onShip.roomTitle).toBe('Ship Deck');
});

test('return to room button returns player to the bedroom', async ({ page }) => {
  await startFreshGame(page);
  await page.evaluate(() => (window as unknown as { game: any }).game.startFallToShip());
  await page.waitForTimeout(3400);

  const beforeReturn = await page.evaluate(() => ({
    returnBtnVisible: !document.getElementById('return-room-btn')?.classList.contains('hidden'),
    roomId: (window as unknown as { game: any }).game.currentRoomId,
  }));
  expect(beforeReturn.returnBtnVisible).toBe(true);
  expect(beforeReturn.roomId).toBe('pirate_ship');

  await page.locator('#return-room-btn').click();
  await page.waitForTimeout(300);

  const afterReturn = await page.evaluate(() => ({
    roomId: (window as unknown as { game: any }).game.currentRoomId,
    roomTitle: document.getElementById('room-title')?.textContent ?? null,
    returnBtnHidden: document.getElementById('return-room-btn')?.classList.contains('hidden'),
  }));
  expect(afterReturn.roomId).toBe('bedroom');
  expect(afterReturn.roomTitle).toBe('Bedroom');
  expect(afterReturn.returnBtnHidden).toBe(true);
});
