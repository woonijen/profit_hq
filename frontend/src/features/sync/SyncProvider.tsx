import type { ReactNode } from 'react';
import { SyncContext } from './sync-context';
import { useSync } from './use-sync';

/** Shares one sync state between the header (button, status) and the dashboard (skeletons). */
export function SyncProvider({
  storeId,
  children,
}: {
  storeId: string | undefined;
  children: ReactNode;
}) {
  return <SyncContext value={useSync(storeId)}>{children}</SyncContext>;
}
