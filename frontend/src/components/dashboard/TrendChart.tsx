import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBucketDate, formatMoney, formatPercent } from '@/features/metrics/format';
import type { MetricsTrend, TrendPoint } from '@/features/metrics/types';

const AXIS_TICK = { fill: 'var(--ink-muted)', fontSize: 12 };
const AXIS_LINE = { stroke: 'var(--line-strong)' };
/** Past this many buckets a marker per point only adds clutter. */
const MAX_POINTS_WITH_MARKERS = 31;

function ChartTooltip({
  active,
  payload,
  trend,
}: Partial<TooltipContentProps> & { trend: MetricsTrend }) {
  const point = payload?.[0]?.payload as TrendPoint | undefined;
  if (!active || !point) return null;
  const { currency } = trend.range;

  return (
    <div className="rounded-md border border-line-strong bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">
        {formatBucketDate(point.date, trend.granularity, true)}
        {point.partial && <span className="font-normal text-ink-muted"> (part of the month)</span>}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 text-ink-muted">
        <dt>Net revenue</dt>
        <dd className="text-right text-ink tabular-nums">
          {formatMoney(point.netRevenueCents, currency)}
        </dd>
        <dt>Net margin</dt>
        <dd className="text-right text-ink tabular-nums">{formatPercent(point.netMargin)}</dd>
        <dt>Net profit</dt>
        <dd className="text-right text-ink tabular-nums">
          {formatMoney(point.netProfitCents, currency)}
        </dd>
        <dt>Orders</dt>
        <dd className="text-right text-ink tabular-nums">{point.orders}</dd>
      </dl>
    </div>
  );
}

/** The same numbers as the chart, as a table: for screen readers and for exact values. */
function TrendTable({ trend }: { trend: MetricsTrend }) {
  const { currency } = trend.range;
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-medium text-accent-ink">Show data as a table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-line">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">Net revenue, net profit and net margin per period</caption>
          <thead className="sticky top-0 bg-card text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Date
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Orders
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Net revenue
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Net profit
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Net margin
              </th>
            </tr>
          </thead>
          <tbody>
            {trend.points.map((p) => (
              <tr key={p.date} className="border-t border-line">
                <th scope="row" className="px-3 py-1.5 font-normal">
                  {formatBucketDate(p.date, trend.granularity, true)}
                </th>
                <td className="px-3 py-1.5 text-right">{p.orders}</td>
                <td className="px-3 py-1.5 text-right">
                  {formatMoney(p.netRevenueCents, currency)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {formatMoney(p.netProfitCents, currency)}
                </td>
                <td className="px-3 py-1.5 text-right">{formatPercent(p.netMargin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function TrendChart({ trend }: { trend: MetricsTrend }) {
  const { points, granularity } = trend;
  const { currency } = trend.range;
  const hasOrders = points.some((p) => p.orders > 0);

  if (!hasOrders) {
    return (
      <p className="flex h-72 items-center justify-center text-center text-ink-muted">
        No orders in this period. Try a longer date range.
      </p>
    );
  }

  return (
    <>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => formatBucketDate(date, granularity)}
              tick={AXIS_TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              yAxisId="revenue"
              tickFormatter={(cents: number) => formatMoney(cents, currency, true)}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <YAxis
              yAxisId="margin"
              orientation="right"
              tickFormatter={(ratio: number) => `${Math.round(ratio * 100)}%`}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={(props: TooltipContentProps) => <ChartTooltip {...props} trend={trend} />}
              cursor={{ fill: 'var(--hover)', opacity: 0.6 }}
            />
            <Legend
              verticalAlign="top"
              height={32}
              formatter={(value: string) => <span className="text-ink-muted">{value}</span>}
            />
            <Bar
              yAxisId="revenue"
              dataKey="netRevenueCents"
              name="Net revenue (left axis)"
              fill="var(--series-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Line
              yAxisId="margin"
              dataKey="netMargin"
              name="Net margin (right axis)"
              stroke="var(--series-2)"
              strokeWidth={2}
              dot={points.length <= MAX_POINTS_WITH_MARKERS ? { r: 3, strokeWidth: 0 } : false}
              activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <TrendTable trend={trend} />
    </>
  );
}
