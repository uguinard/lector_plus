'use client';

import { VocabEntry } from '@/types';
import { getActivePack } from '@/lib/data-layer';

interface VocabFeedbackProps {
  current: VocabEntry;
  correct: boolean;
  correctMeaning: string;
  onNext: () => void;
}

export function VocabFeedback({ current, correct, correctMeaning, onNext }: VocabFeedbackProps) {
  const pack = getActivePack();

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* The word and its translation */}
      <div className="text-center">
        <div
          className="text-3xl font-extrabold text-foreground"
          dir={pack.script.direction}
          lang={pack.script.bcp47}
        >
          {current.text}
        </div>
        <div className="mt-2 text-lg text-muted-foreground italic">{current.translation}</div>
      </div>

      {/* Result message */}
      <div
        className={`rounded-lg border px-6 py-4 text-center text-lg ${
          correct
            ? 'border-[color-mix(in_srgb,var(--primary)_14%,var(--card))] bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] text-primary'
            : 'border-[color-mix(in_srgb,var(--destructive)_14%,var(--card))] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] text-destructive'
        }`}
      >
        {correct ? 'Correct!' : `Incorrect. The correct answer was: ${correctMeaning}`}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
      >
        Next
      </button>
    </div>
  );
}
