import type { CustomerSegment } from './types';

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  VIP: 'VIP',
  AT_RISK: 'At-Risk',
  CHURNED: 'Churned',
  ACTIVE: 'Active',
};
