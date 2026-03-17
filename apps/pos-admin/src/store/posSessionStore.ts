'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';

interface PosSessionData {
  id: string;
  branch_id: string;
  opening_amount: number;
  status: string;
  branch?: { id: string; name: string };
}

interface PosSessionState {
  session: PosSessionData | null;
  loading: boolean;
  loadActiveSession: () => Promise<PosSessionData | null>;
  openSession: (branch_id: string, opening_amount: number) => Promise<PosSessionData>;
  closeSession: (closing_amount: number) => Promise<void>;
  clearSession: () => void;
}

export const usePosSessionStore = create<PosSessionState>()(
  persist(
    (set, get) => ({
      session: null,
      loading: false,

      loadActiveSession: async () => {
        set({ loading: true });
        try {
          const response = await apiClient.get('/pos/sessions/active');
          const session = response.data;
          set({ session, loading: false });
          return session;
        } catch {
          set({ session: null, loading: false });
          return null;
        }
      },

      openSession: async (branch_id: string, opening_amount: number) => {
        const response = await apiClient.post('/pos/sessions/open', { branch_id, opening_amount });
        const session = response.data;
        set({ session });
        return session;
      },

      closeSession: async (closing_amount: number) => {
        const { session } = get();
        if (!session) return;
        await apiClient.post('/pos/sessions/close', {
          session_id: session.id,
          closing_amount,
        });
        set({ session: null });
      },

      clearSession: () => set({ session: null }),
    }),
    { name: 'nivo-pos-session' },
  ),
);
