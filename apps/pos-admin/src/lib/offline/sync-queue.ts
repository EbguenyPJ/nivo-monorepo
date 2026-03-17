import { offlineDB } from './indexedDB';
import { apiClient } from '../api';

export async function syncOfflineSales(): Promise<{ synced: number; failed: number }> {
  const pendingSales = await offlineDB.sales.where('synced').equals(0).toArray();

  if (pendingSales.length === 0) return { synced: 0, failed: 0 };

  try {
    const response = await apiClient.post('/sales/sync', { sales: pendingSales });
    const { results } = response.data;

    let synced = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === 'synced') {
        await offlineDB.sales.update(result.id, { synced: true });
        synced++;
      } else {
        failed++;
      }
    }

    return { synced, failed };
  } catch {
    return { synced: 0, failed: pendingSales.length };
  }
}

export function startSyncListener() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    console.log('[Nivo Sync] Connection restored. Syncing offline sales...');
    syncOfflineSales().then((result) => {
      console.log(`[Nivo Sync] Result: ${result.synced} synced, ${result.failed} failed`);
    });
  });
}
