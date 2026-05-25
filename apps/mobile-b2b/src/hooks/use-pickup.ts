import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../api/client';
import { queryClient } from '../api/query-client';
import type { IOrder } from '@nivo/types';
import { useAuthStore } from '../stores/auth.store';

interface PickupOrderItem {
  variant_name: string;
  size: string;
  quantity: number;
}

export interface PickupOrder extends IOrder {
  customer_name?: string;
  items_count?: number;
  items?: PickupOrderItem[];
  pickup_location?: string;
  can_pickup?: boolean;
  pickup_note?: string;
}

interface ScanPickupResult {
  order: PickupOrder;
  can_pickup: boolean;
  message?: string;
}

interface ConfirmPickupPayload {
  orderId: string;
  signature_url?: string;
  recipient_name?: string;
}

export function usePickupOrders() {
  const branchId = useAuthStore((s) => s.employee?.branch_id);

  return useQuery<PickupOrder[]>({
    queryKey: ['pickup-orders', branchId],
    queryFn: async () => {
      const { data } = await api.get<PickupOrder[]>('/mobile/orders/pickup', {
        params: { branch_id: branchId },
      });
      return data;
    },
    enabled: !!branchId,
    refetchInterval: 30_000,
  });
}

export function useScanPickupQR() {
  return useMutation<ScanPickupResult, Error, string>({
    mutationFn: async (orderId: string) => {
      const { data } = await api.get<ScanPickupResult>(
        `/mobile/orders/pickup/${orderId}/scan`,
      );
      return data;
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ?? 'No se encontró el pedido escaneado';
      Alert.alert('Error', msg);
    },
  });
}

export function useConfirmPickup() {
  return useMutation<void, Error, ConfirmPickupPayload>({
    mutationFn: async ({ orderId, signature_url, recipient_name }) => {
      await api.put(`/mobile/orders/pickup/${orderId}/confirm`, {
        signature_url: signature_url || 'confirmed-in-app',
        recipient_name: recipient_name || 'Cliente',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup-orders'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ?? 'Error al confirmar la recolección';
      Alert.alert('Error', msg);
    },
  });
}
