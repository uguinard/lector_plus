import type { SQLQueryBindings } from 'bun:sqlite';
import { Hono } from 'hono';
import { db, VocabRow, SrsLevel, WordState } from '../db';
import { resolveLanguage } from '../lib/active-language';
import { getCurrentUserId } from '../lib/user';
import { getLanguageConfig } from '../lib/languages';
import { foldWord } from '../lib/languages';
import { validateSafeInteger, validateTimestamp } from '../lib/persisted-input';

const app = new Hono();

export const SRS_INTERVALS: Record<number, number> = {
  0: 1,
  1: 3,
  2: 7,
  3: 14,
  4: 30,
  5: 60,
  6: 90,
};

export const SRS_LEVEL_COLORS: Record<number, string> = {
  0: 'gray',
  1: 'orange',
  2: 'yellow',
  3: 'green',
  4: 'blue',
  5: 'indigo',
  6: 'purple',
};

function srsLevelToWordState(level: SrsLevel): WordState {
  const map: Record<SrsLevel, WordState> = {
    0: 'level1',
    1: 'level1',
    2: 'level2',
    3: 'level3',
    4: 'level4',
    5: 'known',
    6: 'known',
  };
  return map[level];
}

function computeNextReview(level: SrsLevel): string {
  const days = SRS_INTERVALS[level] ?? 1;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function toIsoDate(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function vocabReviewResponse(v: VocabRow) {
  return {
    id: v.id,
    text: v.text,
    type: v.type,
    sentence: v.sentence,
    translation: v.translation,
    state: v.state,
    reviewCount: v.reviewCount,
    bookId: v.bookId,
    chapter: v.chapter,
    srsLevel: v.srsLevel,
    nextReview: toIsoDate(v.nextReview),
    lastReview: toIsoDate(v.lastReview),
  };
}

// GET /api/srs/review
// Returns up to `limit` vocab entries whose nextReview is due (or null),
// sorted by nextReview ascending. Supports optional bookId and language.
app.get('/review', (c) => {
  const userId = getCurrentUserId(c);
  const lang = resolveLanguage(c.req.query('language'), userId);
  const bookId = c.req.query('bookId');
  const limit = parseInt(c.req.query('limit') || '100', 10);

  const safeLimit = Math.max(1, Math.min(limit, 500));

  const params: SQLQueryBindings[] = [userId, lang];
  let query =
    'SELECT * FROM vocab WHERE userId = ? AND language = ? AND (nextReview IS NULL OR nextReview <= ?)';
  params.push(new Date().toISOString());

  if (bookId) {
    query += ' AND bookId = ?';
    params.push(bookId);
  }

  query += ' ORDER BY nextReview ASC NULLS FIRST LIMIT ?';
  params.push(safeLimit);

  const rows = db.prepare(query).all(...params) as VocabRow[];
  return c.json(rows.map(vocabReviewResponse));
});

// POST /api/srs/schedule
// Batch-process SRS review results. Each item has `id` and `correct` (boolean).
// Correct: increment srsLevel (max 6), update nextReview/lastReview.
// Incorrect: hard-reset srsLevel to 0, nextReview to now (due immediately).
app.post('/schedule', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();

  if (!Array.isArray(body)) {
    return c.json({ error: 'Request body must be an array of review results' }, 400);
  }

  if (body.length === 0) {
    return c.json({ success: true, updated: 0 });
  }

  if (body.length > 500) {
    return c.json({ error: 'Batch limited to 500 items' }, 400);
  }

  const validated: Array<{ id: string; correct: boolean }> = [];

  for (const [index, item] of body.entries()) {
    if (typeof item !== 'object' || item === null) {
      return c.json({ error: `items[${index}] must be an object` }, 400);
    }
    const { id, correct } = item as { id?: unknown; correct?: unknown };
    if (typeof id !== 'string' || id.trim() === '') {
      return c.json({ error: `items[${index}].id must be a non-empty string` }, 400);
    }
    if (typeof correct !== 'boolean') {
      return c.json({ error: `items[${index}].correct must be a boolean` }, 400);
    }
    validated.push({ id, correct });
  }

  const updateStmt = db.prepare(
    `UPDATE vocab SET
       srsLevel = ?,
       nextReview = ?,
       lastReview = ?,
       state = ?,
       stateUpdatedAt = ?
     WHERE id = ? AND userId = ?`,
  );
  const knownStmt = db.prepare(
    `INSERT INTO knownWords (userId, word, language, state)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, word, language) DO UPDATE SET state = excluded.state`,
  );

  const now = new Date().toISOString();
  const lang = resolveLanguage(c.req.query('language'), userId);

  let updated = 0;
  const tx = db.transaction((items: typeof validated) => {
    for (const { id, correct } of items) {
      const row = db
        .prepare('SELECT id, text, language, srsLevel FROM vocab WHERE id = ? AND userId = ?')
        .get(id, userId) as
        | { id: string; text: string; language: string; srsLevel: number }
        | undefined;

      if (!row) continue;

      const currentLevel = Math.max(0, Math.min(6, row.srsLevel ?? 0)) as SrsLevel;
      let newLevel: SrsLevel;
      let nextReview: string;

      if (correct) {
        newLevel = Math.min(6, currentLevel + 1) as SrsLevel;
        nextReview = computeNextReview(newLevel);
      } else {
        newLevel = 0;
        nextReview = now;
      }

      const newState = srsLevelToWordState(newLevel);
      const pack = getLanguageConfig(lang);
      const foldedText = foldWord(row.text, pack);

      updateStmt.run(newLevel, nextReview, now, newState, now, id, userId);
      knownStmt.run(userId, foldedText, lang, newState);

      updated++;
    }
  });

  tx(validated);

  return c.json({ success: true, updated });
});

export default app;
