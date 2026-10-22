import { apiFetch } from '@/lib/api-client';

export interface Store {
  id: string;
  shopDomain: string;
  currency: string;
  timezone: string;
  settings: StoreSettings;
}

export interface StoreSettings {
  /** Monthly cost of holding stock as a fraction of its value; 0.02 = 2%. */
  holdingCostRate: number;
}

export const fetchStores = () => apiFetch<{ stores: Store[] }>('/stores');

export const updateStoreSettings = (storeId: string, settings: StoreSettings) =>
  apiFetch<{ settings: StoreSettings }>(`/stores/${storeId}/settings`, {
    method: 'PATCH',
    body: settings,
  });
