import { apiFetch } from '@/lib/api-client';
import type { SyncRun } from './types';

export const startSyncRequest = (storeId: string) =>
  apiFetch<{ run: SyncRun }>(`/stores/${storeId}/sync`, { method: 'POST' });

export const fetchLatestSync = (storeId: string, signal?: AbortSignal) =>
  apiFetch<{ run: SyncRun | null }>(`/stores/${storeId}/sync/latest`, { signal });
