import { type Delta, type Direction } from '@/features/metrics/format';
import { Skeleton } from '@/components/ui/Skeleton';

const ARROWS: Record<Direction, string> = { up: '▲', down: '▼', flat: '▬' };
const SPOKEN: Record<Direction, string> = { up: 'up', down: 'down', flat: 'unchanged' };

interface MetricCardProps {
  label: string;
  value: string;
  /** Change against the previous period; null when there is nothing to compare with. */
  delta: Delta | null;
  /** Whether an increase is good news. False for costs, so a rise is shown as bad. */
  upIsGood?: boolean;
  /** e.g. "previous 30 days". */
  comparedTo: string;
  /** Extra line under the value, e.g. the net margin. */
  detail?: string;
}

function deltaTone(direction: Direction, upIsGood: boolean): string {
  if (direction === 'flat') return 'text-ink-muted';
  return (direction === 'up') === upIsGood ? 'text-good' : 'text-bad';
}

export function MetricCard({
  label,
  value,
  delta,
  upIsGood = true,
  comparedTo,
  detail,
}: MetricCardProps) {
  return (
    <article className="rounded-lg border border-line bg-card p-5 shadow-sm">
      <h3 className="text-sm font-medium text-ink-muted">{label}</h3>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-sm text-ink-muted">{detail}</p>}
      <p className="mt-3 text-sm">
        {delta ? (
          <span className={deltaTone(delta.direction, upIsGood)}>
            <span aria-hidden="true" className="mr-1 text-xs">
              {ARROWS[delta.direction]}
            </span>
            <span className="font-medium tabular-nums">{delta.text}</span>
            <span className="sr-only">
              , {SPOKEN[delta.direction]} compared with the {comparedTo}
            </span>
          </span>
        ) : (
          <span className="text-ink-muted">No data for the {comparedTo}</span>
        )}
        {delta && (
          <span aria-hidden="true" className="ml-1.5 text-ink-muted">
            vs {comparedTo}
          </span>
        )}
      </p>
    </article>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-card p-5 shadow-sm">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-4 h-4 w-40" />
    </div>
  );
}
