import { create } from 'zustand';
import { apiClient } from '@/lib/api';

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface BranchState {
  branches: BranchInfo[];
  selectedBranchId: string | null;
  selectedBranchName: string;
  loading: boolean;
  fetchBranches: () => Promise<void>;
  selectBranch: (id: string) => void;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  branches: [],
  selectedBranchId: null,
  selectedBranchName: 'Sucursal',
  loading: false,

  fetchBranches: async () => {
    set({ loading: true });
    try {
      const res = await apiClient.get('/branches?includeInactive=true');
      const list: BranchInfo[] = res.data || [];
      const current = get().selectedBranchId;
      const stillExists = list.find((b) => b.id === current);

      if (stillExists) {
        // Keep current selection, just update name in case it changed
        set({ branches: list, selectedBranchName: stillExists.name, loading: false });
      } else if (list.length > 0) {
        // Select first active, or first overall
        const first = list.find((b) => b.is_active) || list[0];
        set({ branches: list, selectedBranchId: first.id, selectedBranchName: first.name, loading: false });
      } else {
        set({ branches: [], selectedBranchId: null, selectedBranchName: 'Sucursal', loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  selectBranch: (id: string) => {
    const branch = get().branches.find((b) => b.id === id);
    if (branch) {
      set({ selectedBranchId: id, selectedBranchName: branch.name });
    }
  },
}));
