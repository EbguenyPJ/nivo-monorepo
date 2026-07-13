import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../api/client';
import { queryClient } from '../api/query-client';
import type { IOrder } from '@nivo/types';
import { useAuthStore } from '../stores/auth.store';

interface DeliveryOrder extends IOrder {
  customer_name?: string;
  items_count?: number;
}

interface TrackLocationPayload {
  orderId: string;
  lat: number;
  lng: number;
}

interface DeliverOrderPayload {
  orderId: string;
  latitude: number;
  longitude: number;
  recipient_name?: string;
  notes?: string;
  pin_code?: string;
  signature_data?: string;
  qr_payload?: string;
}

export type VerificationMethod = 'pin' | 'signature' | 'qr';

export interface DeliveryRequirements {
  order_id: string;
  required_methods: VerificationMethod[];
  pin_generated: boolean;
}

export function useDeliveryOrders() {
  const branchId = useAuthStore((s) => s.employee?.branch_id);

  return useQuery<DeliveryOrder[]>({
    queryKey: ['delivery-orders', branchId],
    queryFn: async () => {
      const { data } = await api.get<DeliveryOrder[]>('/mobile/orders/delivery', {
        params: { branch_id: branchId },
      });
      return data;
    },
    enabled: !!branchId,
    refetchInterval: 30_000,
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery<DeliveryOrder>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data } = await api.get<DeliveryOrder>(`/mobile/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
  });
}

export function useDeliveryRequirements(orderId: string) {
  return useQuery<DeliveryRequirements>({
    queryKey: ['delivery-requirements', orderId],
    queryFn: async () => {
      const { data } = await api.get<DeliveryRequirements>(`/mobile/delivery/${orderId}/requirements`);
      return data;
    },
    enabled: !!orderId,
  });
}

export function useTrackLocation() {
  return useMutation<void, Error, TrackLocationPayload>({
    mutationFn: async (payload) => {
      await api.post('/logistics/track-location', payload);
    },
  });
}

export function useDeliverOrder() {
  return useMutation<void, Error, DeliverOrderPayload>({
    mutationFn: async ({ orderId, latitude, longitude, recipient_name, notes, pin_code, signature_data, qr_payload }) => {
      await api.post('/logistics/track-location', {
        orderId,
        lat: latitude,
        lng: longitude,
      });

      await api.post(`/mobile/delivery/${orderId}/proof`, {
        latitude,
        longitude,
        recipient_name,
        notes,
        pin_code,
        signature_data,
        qr_payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      Alert.alert('Pedido entregado', 'La entrega ha sido confirmada con ubicación GPS.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Error al confirmar la entrega';
      Alert.alert('Error', msg);
    },
  });
}
