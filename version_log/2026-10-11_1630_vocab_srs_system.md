# Vocab SRS System (Levels 0–6 + Review Queue)

## Context

The existing vocab system used a simple 1–4 knowledge-state model (`state`
column: 'new', 'level1'–'level4', 'known', 'ignored'). This was expanded to a
7-level (0–6) priority-based SRS scheduler with `srsLevel`, `nextReview`, and
`lastReview` columns, mirroring the cloze sentence SRS model but tailored for
vocabulary review.

## Files Affected

- `api/src/db.ts` — vocab table schema + migration rebuilds + index
- `api/src/routes/srs.ts` (new) — `/api/srs/review` GET, `/api/srs/schedule` POST
- `api/src/routes/registry.ts` — mounted SRS route
- `api/src/routes/vocab.ts` — POST/PUT accept SRS fields
- `api/src/lib/auth.ts` — `SCOPE_MAP` entry for `srs`
- `api/src/lib/openapi/annotations.ts` — OpenAPI docs for new fields + endpoints
- `api/openapi.json` — regenerated
- `src/types/index.ts` — `SrsLevel` type + `VocabEntry` fields
- `src/lib/data-layer.ts` — `getDueVocabForReview`, `scheduleVocabReviews`, `mapVocabRow`
- `src/app/practice/page.tsx` — Vocab tab UI, round flow, feedback
- `src/app/practice/use-vocab-round.ts` (new) — vocab round reducer
- `src/app/practice/constants.ts` — `SRS_INTERVALS`, `SRS_LEVEL_MAX`
- `src/app/practice/utils.ts` — `buildVocabMultipleChoice`, level helpers
- `src/app/practice/components/VocabFeedback/index.tsx` (new) — feedback card
- `src/app/vocab/page.tsx`, `src/components/VocabList/*` — SRS display in vocab table
- `api/src/db.migration.test.ts` — old-schema + seed updated for SRS columns
- `e2e/vocab-srs.spec.ts` (new) — E2E tests

## Before vs After

### DB schema

**Before:** vocab table had no `srsLevel`, `nextReview`, `lastReview` columns.
**After:** all three columns added to `CREATE TABLE`, migration rebuilds, and
the `ensurePartitionIndexes` index set.

### API

**Before:** no `/api/srs/*` endpoints.
**After:** `GET /api/srs/review?limit=N&bookId=...` returns due vocab entries;
`POST /api/srs/schedule` accepts `[{id, correct}]` and updates levels per
interval map (0→1d, 1→3d, 2→7d, 3→14d, 4→30d, 5→60d, 6→90d).

### Frontend

**Before:** practice page had Cloze and Dictation modes only.
**After:** a third "Vocab" tab renders multiple-choice recall cards for
due words, with correct/incorrect feedback and level progression.

## Reasoning

The SRS model is independent from the existing `state` column (which tracks
reader word knowledge during reading). SRS levels track active recall mastery
and schedule future reviews. The vocab system now matches the cloze sentence SRS
pattern used throughout the app.

## Risks / Side Effects

- Migration rebuilds (`migrateCompositeTenantKeys`, `migrateVocabForeignKey`)
  must include the new columns; otherwise old DBs lose them during rebuild.
  Test schema + seed updated accordingly.
- The `VocabEntry` type now has optional `srsLevel`, `nextReview`, `lastReview`
  so existing object literals (Feedback, read page, vocab page) remain valid.
- E2E tests seed via `POST /api/vocab` with `nextReview` set to a past ISO
  timestamp to make entries due for review.
