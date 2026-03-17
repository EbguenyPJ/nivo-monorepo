import Dexie, { type Table } from 'dexie';

export interface OfflineProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  variants: {
    id: string;
    sku: string;
    color: string;
    size_mex: number;
    price: number;
    barcode: string | null;
    stock: number;
  }[];
}

export interface OfflineSale {
  id: string;
  items: { variant_id: string; quantity: number; unit_price: number; discount: number }[];
  total_amount: number;
  payment_method: string;
  sale_type: string;
  customer_id?: string;
  branch_id: string;
  employee_id: string;
  pos_session_id: string;
  created_at: string;
  synced: boolean;
}

class NivoOfflineDB extends Dexie {
  products!: Table<OfflineProduct>;
  sales!: Table<OfflineSale>;

  constructor() {
    super('nivo-offline');
    this.version(1).stores({
      products: 'id, name, brand, category',
      sales: 'id, synced, created_at',
    });
  }
}

export const offlineDB = new NivoOfflineDB();
