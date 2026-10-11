import { SrsLevel } from '@/types';

const SRS_LEVEL_LABELS: Record<number, string> = {
  0: 'New',
  1: 'Learning',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
  5: 'Level 5',
  6: 'Mastered',
};

const SRS_LEVEL_COLORS: Record<number, string> = {
  0: 'bg-gray-400',
  1: 'bg-orange-400',
  2: 'bg-yellow-400',
  3: 'bg-green-400',
  4: 'bg-blue-400',
  5: 'bg-indigo-400',
  6: 'bg-purple-400',
};

export default function SrsLevelBadge({ level }: { level: number }) {
  const safe = Math.max(0, Math.min(6, level || 0));
  const colorClass = SRS_LEVEL_COLORS[safe];
  const label = SRS_LEVEL_LABELS[safe];

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      <span className="text-foreground">{label}</span>
    </div>
  );
}
