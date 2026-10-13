import { createContext, use } from 'react';
import type { SyncController } from './use-sync';

export const SyncContext = createContext<SyncController | null>(null);

export function useSyncController(): SyncController {
  const value = use(SyncContext);
  if (!value) throw new Error('useSyncController must be used inside <SyncProvider>');
  return value;
}
