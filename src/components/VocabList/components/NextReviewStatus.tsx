import { VocabEntry } from '@/types';

export type ReviewStatus = 'overdue' | 'due-today' | 'scheduled' | 'unscheduled';

export function getReviewStatus(entry: VocabEntry | null): ReviewStatus {
  if (!entry?.nextReview) return 'unscheduled';
  const now = new Date();
  const next = new Date(entry.nextReview);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const nextStart = new Date(next);
  nextStart.setHours(0, 0, 0, 0);

  if (nextStart < todayStart) return 'overdue';
  if (nextStart.getTime() === todayStart.getTime()) return 'due-today';
  return 'scheduled';
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  scheduled: 'Scheduled',
  unscheduled: 'Not scheduled',
};

const STATUS_COLOR: Record<ReviewStatus, string> = {
  overdue: 'text-destructive',
  'due-today': 'text-warning',
  scheduled: 'text-muted-foreground',
  unscheduled: 'text-muted-foreground',
};

export default function NextReviewStatus({ entry }: { entry: VocabEntry }) {
  const status = getReviewStatus(entry);
  return (
    <span className={`text-xs font-medium ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
  );
}
