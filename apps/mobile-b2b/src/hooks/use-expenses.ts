import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../api/client';
import { queryClient } from '../api/query-client';
import { useAuthStore } from '../stores/auth.store';

interface ExpenseCategory {
  id: string;
  name: string;
  is_active: boolean;
}

interface UploadExpensePayload {
  branch_id: string;
  category_id: string;
  amount: number;
  description: string;
  payment_source: 'cash' | 'bank';
  receipt_uri?: string;
  receipt_filename?: string;
}

export function useExpenseCategories() {
  return useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data } = await api.get<ExpenseCategory[]>('/expenses/categories');
      return data;
    },
  });
}

export function useUploadExpense() {
  const employeeId = useAuthStore((s) => s.employee?.id);

  return useMutation<any, Error, UploadExpensePayload>({
    mutationFn: async (payload) => {
      if (payload.receipt_uri) {
        const formData = new FormData();
        formData.append('branch_id', payload.branch_id);
        formData.append('category_id', payload.category_id);
        formData.append('amount', String(payload.amount));
        formData.append('description', payload.description);
        formData.append('payment_source', payload.payment_source);
        if (employeeId) formData.append('employee_id', employeeId);

        const ext = payload.receipt_uri.split('.').pop() ?? 'jpg';
        formData.append('receipt', {
          uri: payload.receipt_uri,
          name: payload.receipt_filename ?? `ticket_${Date.now()}.${ext}`,
          type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        } as any);

        const { data } = await api.post('/expenses/pos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30_000,
        });
        return data;
      }

      const { data } = await api.post('/expenses/pos', {
        branch_id: payload.branch_id,
        category_id: payload.category_id,
        amount: payload.amount,
        description: payload.description,
        payment_source: payload.payment_source,
        employee_id: employeeId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      Alert.alert('Gasto registrado', 'El gasto de caja chica fue registrado correctamente.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? 'No se pudo registrar el gasto';
      Alert.alert('Error', msg);
    },
  });
}
