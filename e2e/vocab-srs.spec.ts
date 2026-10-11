import { test, expect, type Page } from '@playwright/test';
import { apiUrl } from './api';

async function seedVocabEntry(page: Page, overrides: Record<string, unknown> = {}) {
  const id = `e2e-vocab-srs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const entry = {
    id,
    text: `srsword${id.slice(-8)}`,
    type: 'word',
    sentence: `This word ${id.slice(-8)} is in a sentence.`,
    translation: `Meaning of ${id.slice(-8)}`,
    state: 'level1',
    stateUpdatedAt: now,
    reviewCount: 0,
    language: 'af',
    srsLevel: 0,
    nextReview: now, // due now
    lastReview: null,
    pushedToAnki: false,
  };

  const response = await page.request.post(apiUrl('/api/vocab'), {
    data: { ...entry, ...overrides },
  });
  expect(response.ok()).toBeTruthy();
  return entry;
}

async function waitForSetup(page: Page) {
  await page.goto('/practice');
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe.serial('Vocab SRS - Setup', () => {
  test('shows Vocab tab alongside Cloze and Dictation', async ({ page }) => {
    await waitForSetup(page);

    await expect(page.getByRole('button', { name: 'Cloze' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vocab' })).toBeVisible();
  });

  test('shows Vocab Review setup screen with round size and Start Review', async ({ page }) => {
    await waitForSetup(page);

    await page.getByRole('button', { name: 'Vocab' }).click();

    await expect(page.getByText('Vocab Review')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: '10' })).toBeVisible();
    await expect(page.getByRole('button', { name: '20' })).toBeVisible();
  });

  test('shows empty state when no words are due', async ({ page }) => {
    await waitForSetup(page);

    await page.getByRole('button', { name: 'Vocab' }).click();
    await page.getByRole('button', { name: 'Start Review' }).click();

    await expect(page.getByText('No words due for review')).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe.serial('Vocab SRS - Review Flow', () => {
  test('reviews due words and advances levels on correct answers', async ({ page }) => {
    // Seed a due vocab entry (nextReview = now)
    const entry = await seedVocabEntry(page, { srsLevel: 0, nextReview: new Date().toISOString() });

    try {
      await waitForSetup(page);
      await page.getByRole('button', { name: 'Vocab' }).click();
      await page.getByRole('button', { name: 'Start Review' }).click();

      // Should show the word being reviewed
      await expect(page.getByRole('heading', { level: 3 })).toBeVisible({
        timeout: 10000,
      });

      // Should show 4 MC options
      const mcOptions = page.locator('[data-testid="vocab-mc-option"]');
      await expect(mcOptions).toHaveCount(4);

      // Find the correct option — it's the one matching the translation
      const correctOption = mcOptions.filter({ hasText: entry.translation });
      await expect(correctOption).toBeVisible();

      // Click the correct option
      await correctOption.click();

      // Should show "Correct!" feedback
      await expect(page.getByText('Correct!')).toBeVisible({ timeout: 5000 });

      // Click Next
      await page.getByRole('button', { name: 'Next' }).click();

      // Verify the SRS level was updated on the server (level 0 → 1 on first correct)
      const fetched = await page.request.get(apiUrl(`/api/vocab/${entry.id}`));
      const updated = await fetched.json();
      expect(updated.srsLevel).toBe(1);
      expect(updated.lastReview).toBeTruthy();
    } finally {
      await page.request.delete(apiUrl(`/api/vocab/${entry.id}`));
    }
  });

  test('resets level to 0 on incorrect answer', async ({ page }) => {
    // Seed a vocab entry at level 3
    const entry = await seedVocabEntry(page, { srsLevel: 3, nextReview: new Date().toISOString() });

    try {
      await waitForSetup(page);
      await page.getByRole('button', { name: 'Vocab' }).click();
      await page.getByRole('button', { name: 'Start Review' }).click();

      // Should show MC options
      const mcOptions = page.locator('[data-testid="vocab-mc-option"]');
      await expect(mcOptions).toHaveCount(4);

      // Click a wrong option (find one that doesn't match the translation)
      for (let i = 0; i < 4; i++) {
        const option = mcOptions.nth(i);
        const text = await option.textContent();
        if (text && !text.includes(entry.translation)) {
          await option.click();
          break;
        }
      }

      // Should show "Incorrect" feedback
      await expect(page.getByText(/Incorrect/i)).toBeVisible({ timeout: 5000 });

      // Click Next
      await page.getByRole('button', { name: 'Next' }).click();

      // Verify SRS level was reset to 0
      const fetched = await page.request.get(apiUrl(`/api/vocab/${entry.id}`));
      const updated = await fetched.json();
      expect(updated.srsLevel).toBe(0);
    } finally {
      await page.request.delete(apiUrl(`/api/vocab/${entry.id}`));
    }
  });

  test('completes a full round and shows summary', async ({ page }) => {
    // Seed 3 due vocab entries
    const entries = await Promise.all(
      Array.from({ length: 3 }).map((_, i) =>
        seedVocabEntry(page, { srsLevel: 0, nextReview: new Date().toISOString() }),
      ),
    );

    try {
      await waitForSetup(page);
      await page.getByRole('button', { name: 'Vocab' }).click();

      // Set round size to 10
      await page.getByRole('button', { name: '10' }).click();
      await page.getByRole('button', { name: 'Start Review' }).click();

      // Answer all 3 (use first option for each — might not always be correct, but we just need to complete)
      for (let i = 0; i < entries.length; i++) {
        const mcOptions = page.locator('[data-testid="vocab-mc-option"]');
        await expect(mcOptions.first()).toBeVisible({ timeout: 5000 });
        await mcOptions.first().click();

        // Wait for feedback, then click Next
        await page.getByRole('button', { name: 'Next' }).click();
      }

      // Should show round complete
      await expect(page.getByText('Round Complete!')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Start Review').first()).toBeVisible();
    } finally {
      for (const e of entries) {
        await page.request.delete(apiUrl(`/api/vocab/${e.id}`));
      }
    }
  });
});

test.describe.serial('Vocab SRS - Review Queue', () => {
  test('GET /api/srs/review returns only due entries', async ({ page }) => {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Seed a due entry (past nextReview)
    const dueEntry = await seedVocabEntry(page, {
      srsLevel: 2,
      nextReview: past,
    });
    // Seed a future entry (not due)
    const futureEntry = await seedVocabEntry(page, {
      srsLevel: 5,
      nextReview: future,
    });

    try {
      // GET /api/srs/review should return only the due entry
      const res = await page.request.get(apiUrl(`/api/srs/review?limit=50`));
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      const ids = data.map((v: { id: string }) => v.id);
      expect(ids).toContain(dueEntry.id);
      expect(ids).not.toContain(futureEntry.id);
    } finally {
      await page.request.delete(apiUrl(`/api/vocab/${dueEntry.id}`));
      await page.request.delete(apiUrl(`/api/vocab/${futureEntry.id}`));
    }
  });
});
