'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';

interface PosSessionData {
  id: string;
  branch_id: string;
  employee_id: string;
  cash_register_id: string | null;
  opening_amount: number;
  status: string;
  branch?: { id: string; name: string };
  cash_register?: { id: string; name: string };
}

interface PosEmployee {
  id: string;
  name: string;
  role: string;
}

interface CashRegisterInfo {
  id: string;
  name: string;
}

interface RegisterSessionInfo {
  cash_register_id: string;
  cash_register_name: string;
  employee_id: string;
  employee_name: string;
  session_id: string;
  opened_at: string;
  opening_amount: number;
}

interface VerifyPinResult {
  employee: PosEmployee;
  has_active_session: boolean;
  session: PosSessionData | null;
  cash_registers: CashRegisterInfo[];
  register_sessions: RegisterSessionInfo[];
}

interface PosSessionState {
  session: PosSessionData | null;
  posEmployee: PosEmployee | null;
  cashRegister: CashRegisterInfo | null;
  loading: boolean;
  loadActiveSession: () => Promise<PosSessionData | null>;
  verifyPin: (pinCode: string, branchId: string) => Promise<VerifyPinResult>;
  openSession: (branchId: string, openingAmount: number, employeeId: string, cashRegisterId: string) => Promise<PosSessionData>;
  switchCashier: (sessionId: string, newEmployeeId: string) => Promise<PosSessionData>;
  closeSession: (closingAmount: number) => Promise<void>;
  clearSession: () => void;
}

export const usePosSessionStore = create<PosSessionState>()(
  persist(
    (set, get) => ({
      session: null,
      posEmployee: null,
      cashRegister: null,
      loading: false,

      loadActiveSession: async () => {
        set({ loading: true });
        try {
          // Search by cash_register first (most specific), then by employee, then JWT fallback
          const { cashRegister, posEmployee } = get();
          const params: Record<string, string> = {};
          if (cashRegister) {
            params.cash_register_id = cashRegister.id;
          } else if (posEmployee) {
            params.employee_id = posEmployee.id;
          }
          const response = await apiClient.get('/pos/sessions/active', { params });
          const session = response.data;
          if (session) {
            set({
              session,
              cashRegister: session.cash_register || null,
              loading: false,
            });
          } else {
            set({ session: null, loading: false });
          }
          return session;
        } catch {
          set({ session: null, loading: false });
          return null;
        }
      },

      verifyPin: async (pinCode: string, branchId: string) => {
        const response = await apiClient.post<VerifyPinResult>('/pos/verify-pin', {
          pin_code: pinCode,
          branch_id: branchId,
        });
        const result = response.data;
        set({ posEmployee: result.employee });
        if (result.has_active_session && result.session) {
          set({
            session: result.session,
            cashRegister: result.session.cash_register || null,
          });
        }
        return result;
      },

      openSession: async (branchId: string, openingAmount: number, employeeId: string, cashRegisterId: string) => {
        const response = await apiClient.post('/pos/sessions/open', {
          branch_id: branchId,
          opening_amount: openingAmount,
          employee_id: employeeId,
          cash_register_id: cashRegisterId,
        });
        const session = response.data;
        set({
          session,
          cashRegister: session.cash_register || null,
        });
        return session;
      },

      switchCashier: async (sessionId: string, newEmployeeId: string) => {
        const response = await apiClient.post('/pos/sessions/switch', {
          session_id: sessionId,
          new_employee_id: newEmployeeId,
        });
        const session = response.data;
        set({
          session,
          cashRegister: session.cash_register || null,
        });
        return session;
      },

      closeSession: async (closingAmount: number) => {
        const { session } = get();
        if (!session) return;
        await apiClient.post('/pos/sessions/close', {
          session_id: session.id,
          closing_amount: closingAmount,
        });
        set({ session: null, posEmployee: null, cashRegister: null });
      },

      clearSession: () => set({ session: null, posEmployee: null, cashRegister: null }),
    }),
    { name: 'nivo-pos-session' },
  ),
);
