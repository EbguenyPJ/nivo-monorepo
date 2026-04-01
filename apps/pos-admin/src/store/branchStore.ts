import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export const GENERAL_BRANCH_ID = '__general__';

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface BranchContext {
  mode: 'general' | 'branch';
  branchId: string | null;
  canSell: boolean;
  canMultiBranchEntry: boolean;
}

interface BranchState {
  branches: BranchInfo[];
  selectedBranchId: string | null;
  selectedBranchName: string;
  isGeneralSelected: boolean;
  loading: boolean;
  fetchBranches: () => Promise<void>;
  selectBranch: (id: string) => void;
  selectGeneral: () => void;
  /** Returns the first active branch ID (for API calls that require a real branch) */
  getEffectiveBranchId: () => string | null;
  /** Returns computed context for UI decisions */
  getBranchContext: () => BranchContext;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  branches: [],
  selectedBranchId: null,
  selectedBranchName: 'Sucursal',
  isGeneralSelected: false,
  loading: false,

  fetchBranches: async () => {
    set({ loading: true });
    try {
      const res = await apiClient.get('/branches?includeInactive=true');
      const list: BranchInfo[] = res.data || [];
      const current = get().selectedBranchId;

      // Auto-assign branch for cashiers
      const authState = useAuthStore.getState();
      if (authState.user?.role === 'cashier' && authState.user?.branch_id) {
        const cashierBranch = list.find((b) => b.id === authState.user.branch_id);
        if (cashierBranch) {
          set({
            branches: list,
            selectedBranchId: cashierBranch.id,
            selectedBranchName: cashierBranch.name,
            isGeneralSelected: false,
            loading: false,
          });
          return;
        }
      }

      if (get().isGeneralSelected) {
        set({ branches: list, loading: false });
      } else {
        const stillExists = list.find((b) => b.id === current);
        if (stillExists) {
          set({ branches: list, selectedBranchName: stillExists.name, loading: false });
        } else if (list.length > 0) {
          const first = list.find((b) => b.is_active) || list[0];
          set({ branches: list, selectedBranchId: first.id, selectedBranchName: first.name, loading: false });
        } else {
          set({ branches: [], selectedBranchId: null, selectedBranchName: 'Sucursal', loading: false });
        }
      }
    } catch {
      set({ loading: false });
    }
  },

  selectBranch: (id: string) => {
    const branch = get().branches.find((b) => b.id === id);
    if (branch) {
      set({ selectedBranchId: id, selectedBranchName: branch.name, isGeneralSelected: false });
    }
  },

  selectGeneral: () => {
    // Cashiers cannot access General mode
    const authState = useAuthStore.getState();
    if (authState.user?.role === 'cashier') return;
    set({ selectedBranchId: GENERAL_BRANCH_ID, selectedBranchName: 'General (Todas)', isGeneralSelected: true });
  },

  getEffectiveBranchId: () => {
    const state = get();
    if (state.isGeneralSelected) {
      const first = state.branches.find((b) => b.is_active);
      return first?.id || null;
    }
    return state.selectedBranchId;
  },

  getBranchContext: (): BranchContext => {
    const state = get();
    if (state.isGeneralSelected) {
      return {
        mode: 'general',
        branchId: null,
        canSell: false,
        canMultiBranchEntry: true,
      };
    }
    return {
      mode: 'branch',
      branchId: state.selectedBranchId,
      canSell: true,
      canMultiBranchEntry: false,
    };
  },
}));
