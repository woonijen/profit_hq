import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { type Store, updateStoreSettings } from './stores-api';

/**
 * Saves the monthly holding cost rate. The new settings go straight into the stores cache, and
 * the inventory queries are refetched because every holding cost in them depends on the rate.
 */
export function useUpdateHoldingCostRate(storeId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holdingCostRate: number) => {
      if (!storeId) throw new Error('No store to update');
      return updateStoreSettings(storeId, { holdingCostRate });
    },
    onSuccess: ({ settings }) => {
      if (!storeId) return;
      queryClient.setQueryData<{ stores: Store[] }>(
        queryKeys.stores,
        (data) =>
          data && {
            stores: data.stores.map((store) =>
              store.id === storeId ? { ...store, settings } : store,
            ),
          },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeInventory(storeId) });
    },
  });
}
