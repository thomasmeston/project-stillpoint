import { expect, test } from '@playwright/test';

async function startNewGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.locator('.new-game-btn[data-slot="1"]').click();
  await page.waitForTimeout(600);

  // Skip floating intro — words animate and are unstable for automated clicks
  await page.evaluate(() => {
    const game = (window as unknown as {
      game: {
        introActive: boolean;
        gameState: { setFlag: (flag: string, value: boolean) => void };
      };
    }).game;
    game.introActive = false;
    game.gameState.setFlag('intro_words_cleared', true);
    const overlay = document.getElementById('intro-words-overlay');
    overlay?.classList.add('hidden', 'fade-out');
    if (overlay) overlay.innerHTML = '';
    document.getElementById('hud')?.classList.remove('hidden');
  });

  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
}

test('desk examine walks player over and shows top-down zoom controls', async ({ page }) => {
  await startNewGame(page);

  await page.evaluate(() => {
    const game = (window as unknown as { game: { handleDeskExamine: () => void } }).game;
    game.handleDeskExamine();
  });

  await expect.poll(async () => {
    return page.evaluate(() => {
      const game = window as unknown as { game: { isDeskZoomed: boolean } };
      return game.game.isDeskZoomed;
    });
  }).toBe(true);

  await expect(page.locator('#zoom-back-btn')).toBeVisible();
});

test('desk hotspot handler triggers zoom flow', async ({ page }) => {
  await startNewGame(page);

  await page.evaluate(() => {
    const game = (window as unknown as { game: { handleHotspot: (id: string) => void } }).game;
    game.handleHotspot('desk');
  });

  await expect.poll(async () => {
    return page.evaluate(() => {
      const game = window as unknown as { game: { isDeskZoomed: boolean } };
      return game.game.isDeskZoomed;
    });
  }, { timeout: 10_000 }).toBe(true);

  await expect(page.locator('#zoom-back-btn')).toBeVisible();
});

test('desk zoom only exits via back button', async ({ page }) => {
  await startNewGame(page);

  await page.evaluate(() => {
    (window as unknown as { game: { handleDeskExamine: () => void } }).game.handleDeskExamine();
  });

  await expect.poll(async () => {
    return page.evaluate(() => (window as unknown as { game: { isDeskZoomed: boolean } }).game.isDeskZoomed);
  }).toBe(true);

  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

  expect(await page.evaluate(() => (window as unknown as { game: { isDeskZoomed: boolean } }).game.isDeskZoomed)).toBe(true);

  await page.locator('#zoom-back-btn').click();

  await expect.poll(async () => {
    return page.evaluate(() => (window as unknown as { game: { isDeskZoomed: boolean } }).game.isDeskZoomed);
  }).toBe(false);
});
