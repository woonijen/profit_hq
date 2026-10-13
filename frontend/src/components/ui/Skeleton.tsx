/** A pulsing placeholder block. Hidden from assistive tech; the container announces loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-skeleton ${className}`} />;
}
