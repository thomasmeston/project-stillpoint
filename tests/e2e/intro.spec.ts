import { expect, test } from '@playwright/test';

test('intro overlay appears on new game with correct styles', async ({ page }) => {
  await page.goto('/');
  await page.locator('.new-game-btn[data-slot="3"]').click();
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const overlay = document.getElementById('intro-words-overlay');
    const hud = document.getElementById('hud');
    const game = (window as unknown as {
      game: {
        introActive: boolean;
        gameState: { hasFlag: (flag: string) => boolean };
      };
    }).game;
    const overlayStyle = overlay ? getComputedStyle(overlay) : null;
    const firstWord = overlay?.querySelector('.intro-word') as HTMLElement | null;

    return {
      introActive: game.introActive,
      introWordsCleared: game.gameState.hasFlag('intro_words_cleared'),
      overlayClasses: overlay?.className ?? null,
      wordCount: overlay?.querySelectorAll('.intro-word').length ?? 0,
      hudHidden: hud?.classList.contains('hidden') ?? false,
      overlayPosition: overlayStyle?.position ?? null,
      overlayZIndex: overlayStyle?.zIndex ?? null,
      overlayBackground: overlayStyle?.backgroundColor ?? null,
      wordColor: firstWord ? getComputedStyle(firstWord).color : null,
    };
  });

  expect(state.introActive).toBe(true);
  expect(state.introWordsCleared).toBe(false);
  expect(state.overlayClasses).not.toContain('hidden');
  expect(state.wordCount).toBe(65);
  expect(state.hudHidden).toBe(true);
  expect(state.overlayPosition).toBe('fixed');
  expect(state.overlayZIndex).toBe('110');
  expect(state.overlayBackground).toBe('rgba(10, 12, 16, 0.88)');
  expect(state.wordColor).toBe('rgba(255, 255, 255, 0.7)');
});
