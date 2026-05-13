import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../api/client';
import type { IProductVariant } from '@nivo/types';
import { useAuthStore } from '../stores/auth.store';

interface ScanResult {
  variant: IProductVariant & { product_name: string; stock_available: number };
}

interface AuditListItem {
  id: string;
  folio_number: number;
  type: 'full' | 'partial';
  status: 'draft' | 'counting' | 'review' | 'completed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface SubmitCountPayload {
  audit_id: string;
  variant_id: string;
  counted_quantity: number;
}

export interface BatchScanEntry {
  sku: string;
  barcode: string;
  variant_id: string;
  product_name: string;
  color: string;
  size_mex: number;
  qty: number;
}

export function useActiveAudits() {
  const branchId = useAuthStore((s) => s.employee?.branch_id);

  return useQuery<{ data: AuditListItem[]; total: number }>({
    queryKey: ['audits', 'active', branchId],
    queryFn: async () => {
      const { data } = await api.get('/audits/list', {
        params: { branch_id: branchId, status: 'counting', limit: 20, offset: 0 },
      });
      return data;
    },
    enabled: !!branchId,
  });
}

export function useScanBarcode() {
  return useMutation<ScanResult, Error, { audit_id: string; barcode: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ScanResult>('/audits/scan', payload);
      return data;
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Código no encontrado en el inventario';
      Alert.alert('Código no reconocido', msg);
    },
  });
}

export function useSubmitAudit() {
  return useMutation<void, Error, { audit_id: string; counts: SubmitCountPayload[] }>({
    mutationFn: async ({ audit_id, counts }) => {
      for (const count of counts) {
        await api.post('/audits/submit-count', {
          audit_id,
          variant_id: count.variant_id,
          counted_quantity: count.counted_quantity,
        });
      }
    },
    onSuccess: () => {
      Alert.alert('Auditoría enviada', 'Todos los conteos han sido registrados exitosamente.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'Error al enviar los conteos';
      Alert.alert('Error', msg);
    },
  });
}

export function useFinishCounting() {
  return useMutation<void, Error, string>({
    mutationFn: async (audit_id) => {
      await api.post('/audits/finish-counting', { audit_id });
    },
  });
}
