import { apiFetch } from '@/lib/api-client';

export interface Store {
  id: string;
  shopDomain: string;
  currency: string;
  timezone: string;
}

export const fetchStores = () => apiFetch<{ stores: Store[] }>('/stores');
