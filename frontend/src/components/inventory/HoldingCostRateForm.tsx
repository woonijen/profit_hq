import { type SubmitEvent, useState } from 'react';
import { formatRateInput, parseRateInput } from '@/features/inventory/holding-cost-rate';
import { useUpdateHoldingCostRate } from '@/features/stores/use-update-holding-cost-rate';
import { ApiError } from '@/lib/api-client';

interface HoldingCostRateFormProps {
  storeId: string;
  /** The saved rate as a fraction; 0.02 = 2%. */
  rate: number;
}

/** Edits the store's monthly holding cost rate, typed as a percent. */
export function HoldingCostRateForm({ storeId, rate }: HoldingCostRateFormProps) {
  const [text, setText] = useState(() => formatRateInput(rate));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const update = useUpdateHoldingCostRate(storeId);

  const parsed = parseRateInput(text);
  const unchanged = parsed.ok && parsed.rate === rate;
  const message =
    error ??
    (update.error instanceof ApiError ? update.error.message : update.error && 'Could not save.');

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError(null);
    update.mutate(parsed.rate, {
      onSuccess: ({ settings }) => {
        setText(formatRateInput(settings.holdingCostRate));
        setSaved(true);
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-wrap items-start gap-3">
      <div>
        <label htmlFor="holding-cost-rate" className="block text-sm font-medium text-ink-muted">
          Holding cost per month
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="holding-cost-rate"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
              setSaved(false);
              update.reset();
            }}
            aria-invalid={message ? true : undefined}
            aria-describedby={`holding-cost-rate-hint${message ? ' holding-cost-rate-error' : ''}`}
            className="block w-24 rounded-md border border-line-strong px-3 py-1.5 text-right text-sm tabular-nums shadow-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none aria-invalid:border-danger"
          />
          <span aria-hidden="true" className="text-sm text-ink-muted">
            %
          </span>
          <button
            type="submit"
            disabled={update.isPending || unchanged}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p id="holding-cost-rate-hint" className="mt-1 text-xs text-ink-muted">
          Percent of stock value it costs to keep stock for a month.
        </p>
        {message && (
          <p id="holding-cost-rate-error" role="alert" className="mt-1 text-sm text-danger">
            {message}
          </p>
        )}
      </div>
      <p role="status" className="self-center pt-2 text-sm text-good">
        {saved && !message ? 'Saved' : ''}
      </p>
    </form>
  );
}
