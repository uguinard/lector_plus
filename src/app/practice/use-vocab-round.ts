import { useCallback, useReducer } from 'react';
import { VocabEntry } from '@/types';
import { getDueVocabForReview, scheduleVocabReviews } from '@/lib/data-layer';
import { PracticeState } from './types';
import { advanceVocabLevel, calculateVocabNextReview, resetVocabLevel } from './utils';

export interface VocabRoundState {
  phase: PracticeState;
  queue: VocabEntry[];
  current: VocabEntry | null;
  roundSize: number;
  roundProgress: number;
  roundCorrect: number;
  points: number;
  retryQueue: VocabEntry[];
  isRetryPhase: boolean;
}

function currentFrom(queue: VocabEntry[]): VocabEntry | null {
  return queue[0] ?? null;
}

export function createInitialVocabState(points = 0): VocabRoundState {
  return {
    phase: 'setup',
    queue: [],
    current: null,
    roundSize: 20,
    roundProgress: 0,
    roundCorrect: 0,
    points,
    retryQueue: [],
    isRetryPhase: false,
  };
}

type VocabAction =
  | { type: 'set-phase'; phase: PracticeState }
  | { type: 'begin'; size: number }
  | { type: 'start'; entries: VocabEntry[] }
  | { type: 'review-committed'; isCorrect: boolean }
  | { type: 'show-feedback' }
  | { type: 'advance' }
  | { type: 'set-points'; points: number };

function advanceRound(state: VocabRoundState): VocabRoundState {
  const remaining = state.queue.slice(1);
  if (remaining.length > 0) {
    return {
      ...state,
      phase: 'practicing',
      queue: remaining,
      current: currentFrom(remaining),
    };
  }
  if (state.retryQueue.length > 0) {
    const retries = [...state.retryQueue];
    return {
      ...state,
      phase: 'practicing',
      queue: retries,
      current: currentFrom(retries),
      retryQueue: [],
      isRetryPhase: true,
    };
  }
  return { ...state, phase: 'complete', queue: [], current: null };
}

function vocabRoundReducer(state: VocabRoundState, action: VocabAction): VocabRoundState {
  switch (action.type) {
    case 'set-phase':
      return { ...state, phase: action.phase };
    case 'begin':
      return {
        ...state,
        phase: 'loading',
        queue: [],
        current: null,
        roundSize: action.size,
        roundProgress: 0,
        roundCorrect: 0,
        retryQueue: [],
        isRetryPhase: false,
      };
    case 'start':
      return {
        ...state,
        phase: action.entries.length > 0 ? 'practicing' : 'empty',
        queue: action.entries,
        current: currentFrom(action.entries),
      };
    case 'review-committed': {
      if (!state.current) return state;
      const firstPass = !state.isRetryPhase;
      const retryQueue = action.isCorrect
        ? state.retryQueue
        : [...state.retryQueue, { ...state.current, srsLevel: 0 } as VocabEntry];
      return {
        ...state,
        roundProgress: state.roundProgress + (firstPass ? 1 : 0),
        roundCorrect: state.roundCorrect + (firstPass && action.isCorrect ? 1 : 0),
        points: state.points + (action.isCorrect ? 5 : 0),
        retryQueue,
      };
    }
    case 'show-feedback':
      return { ...state, phase: 'feedback' };
    case 'set-points':
      return { ...state, points: action.points };
    case 'advance': {
      const next = advanceRound(state);
      return next;
    }
  }
}

export async function commitVocabReview(
  entry: VocabEntry,
  isCorrect: boolean,
  currentLevel: number,
): Promise<boolean> {
  const newLevel = isCorrect ? advanceVocabLevel(currentLevel) : resetVocabLevel();
  const nextReview = isCorrect ? calculateVocabNextReview(newLevel) : new Date();
  const updated = await scheduleVocabReviews([{ id: entry.id, correct: isCorrect }]);
  return updated === 1;
}

export function useVocabRound() {
  const [round, dispatch] = useReducer(vocabRoundReducer, undefined, () =>
    createInitialVocabState(),
  );

  const setPhase = useCallback((phase: PracticeState) => {
    dispatch({ type: 'set-phase', phase });
  }, []);

  const beginRound = useCallback((size: number) => {
    dispatch({ type: 'begin', size });
  }, []);

  const startRound = useCallback(async (size: number, bookId?: string) => {
    const entries = await getDueVocabForReview(size, bookId);
    dispatch({ type: 'start', entries });
    return entries;
  }, []);

  const commitReview = useCallback(async (entry: VocabEntry, isCorrect: boolean) => {
    const ok = await commitVocabReview(entry, isCorrect, entry.srsLevel ?? 0);
    if (ok) {
      dispatch({ type: 'review-committed', isCorrect });
    }
    return ok;
  }, []);

  const showFeedback = useCallback(() => {
    dispatch({ type: 'show-feedback' });
  }, []);

  const advance = useCallback(() => {
    dispatch({ type: 'advance' });
  }, []);

  const setPoints = useCallback((points: number) => {
    dispatch({ type: 'set-points', points });
  }, []);

  return {
    state: round.phase,
    queue: round.queue,
    current: round.current,
    roundSize: round.roundSize,
    roundProgress: round.roundProgress,
    roundCorrect: round.roundCorrect,
    points: round.points,
    setPoints,
    retryQueue: round.retryQueue,
    isRetryPhase: round.isRetryPhase,
    setPhase,
    beginRound,
    startRound,
    commitReview,
    showFeedback,
    advance,
  };
}
