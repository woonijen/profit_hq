/** Mirrors the backend's public sync run (`GET/POST /stores/:id/sync`). */

export type SyncRunStatus = 'running' | 'succeeded' | 'partial' | 'failed';

export interface SyncCounts {
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export interface SyncRun {
  id: string;
  storeId: string;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt: string | null;
  resumed: boolean;
  products: SyncCounts;
  orders: SyncCounts;
  error: { message: string; entity?: 'products' | 'orders' } | null;
}
