export function FullPageSpinner() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
