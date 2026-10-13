import {
  formatChange,
  formatMoney,
  formatPercent,
  formatPointsChange,
} from '@/features/metrics/format';
import type { MetricsSummary } from '@/features/metrics/types';
import { MetricCard, MetricCardSkeleton } from './MetricCard';

export function SummaryCards({ summary }: { summary: MetricsSummary }) {
  const { metrics, range, costCoverage } = summary;
  const money = (cents: number) => formatMoney(cents, range.currency);
  const comparedTo = `previous ${range.key.replace('d', '')} days`;

  const margin = metrics.netMargin;
  const marginChange = formatPointsChange(margin.deltaPoints);
  const marginDetail = `Net margin ${formatPercent(margin.current)}${
    marginChange ? ` (${marginChange.text})` : ''
  }`;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross revenue"
          value={money(metrics.grossRevenueCents.current)}
          delta={formatChange(metrics.grossRevenueCents.changeRatio)}
          comparedTo={comparedTo}
        />
        <MetricCard
          label="Cost of goods sold"
          value={money(metrics.cogsCents.current)}
          delta={formatChange(metrics.cogsCents.changeRatio)}
          upIsGood={false}
          comparedTo={comparedTo}
        />
        <MetricCard
          label="Net profit"
          value={money(metrics.netProfitCents.current)}
          delta={formatChange(metrics.netProfitCents.changeRatio)}
          detail={marginDetail}
          comparedTo={comparedTo}
        />
        <MetricCard
          label="Average order value"
          value={money(metrics.aovCents.current)}
          delta={formatChange(metrics.aovCents.changeRatio)}
          comparedTo={comparedTo}
        />
      </div>
      {costCoverage.current < 1 && (
        <p role="note" className="mt-3 text-sm text-ink-muted">
          Product cost is unknown for {formatPercent(1 - costCoverage.current)} of gross revenue in
          this period, so net profit is probably overstated.
        </p>
      )}
    </>
  );
}

export function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}
