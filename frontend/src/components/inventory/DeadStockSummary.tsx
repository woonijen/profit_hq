import { Skeleton } from '@/components/ui/Skeleton';
import { formatInteger, formatMoney } from '@/features/metrics/format';
import type { DeadStockReport } from '@/features/inventory/types';

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
}

function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="rounded-lg border border-line bg-card p-5 shadow-sm">
      <h3 className="text-sm font-medium text-ink-muted">{label}</h3>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-sm text-ink-muted">{detail}</p>}
    </article>
  );
}

interface DeadStockSummaryProps {
  totals: DeadStockReport['totals'];
  currency: string;
}

/** The four headline numbers of the dead-stock report, over all pages. */
export function DeadStockSummary({ totals, currency }: DeadStockSummaryProps) {
  const money = (cents: number) => formatMoney(cents, currency);
  const missing = totals.variantsMissingCost;
  const notCounted =
    missing > 0 ? `${formatInteger(missing)} without a cost not counted` : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Dead SKUs" value={formatInteger(totals.variants)} />
      <StatCard label="Units stuck" value={formatInteger(totals.units)} />
      <StatCard label="Capital tied up" value={money(totals.stockValueCents)} detail={notCounted} />
      <StatCard
        label="Holding cost per month"
        value={money(totals.monthlyHoldingCostCents)}
        detail={notCounted}
      />
    </div>
  );
}

export function DeadStockSummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-lg border border-line bg-card p-5 shadow-sm">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
        </div>
      ))}
    </div>
  );
}
