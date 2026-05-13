import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';
import type { CreateOrderDto, LayawayStripePaymentDto } from '@nivo/types';

// ─── Catalog ──────────────────────────────────────────────────────

export function useCatalog(filters?: { category_id?: string; brand_id?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.category_id) params.set('category_id', filters.category_id);
  if (filters?.brand_id) params.set('brand_id', filters.brand_id);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => api.get<{ data: CatalogProduct[]; total: number }>(
      `/mobile/catalog${qs ? `?${qs}` : ''}`,
    ),
  });
}

export function useProductDetail(productId: string) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.get<ProductDetail>(`/mobile/catalog/${productId}`),
    enabled: !!productId,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/mobile/catalog/categories'),
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/mobile/catalog/brands'),
  });
}

// ─── Branches (BOPIS) ────────────────────────────────────────────

export function useBranches(variantIds?: string[]) {
  const params = new URLSearchParams();
  if (variantIds?.length) params.set('variant_ids', variantIds.join(','));

  return useQuery({
    queryKey: ['branches', variantIds],
    queryFn: () => api.get<BranchWithStock[]>(
      `/mobile/branches${params.toString() ? `?${params}` : ''}`,
    ),
  });
}

// ─── Orders ───────────────────────────────────────────────────────

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateOrderDto) =>
      api.post<{ id: string; client_secret: string }>('/mobile/orders', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<{ items: OrderSummary[]; total: number }>('/mobile/orders'),
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.get<OrderDetail>(`/mobile/orders/${orderId}`),
    enabled: !!orderId,
  });
}

// ─── Layaways ─────────────────────────────────────────────────────

export function useMyLayaways() {
  return useQuery({
    queryKey: ['layaways'],
    queryFn: () => api.get<{ items: LayawaySummary[]; total: number }>('/mobile/layaways'),
  });
}

export function useLayawayDetail(layawayId: string) {
  return useQuery({
    queryKey: ['layaway', layawayId],
    queryFn: () => api.get<LayawayDetail>(`/mobile/layaways/${layawayId}`),
    enabled: !!layawayId,
  });
}

export function useLayawayPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: LayawayStripePaymentDto) =>
      api.post<{ client_secret: string }>('/mobile/layaways/pay', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['layaways'] });
    },
  });
}

// ─── Loyalty ──────────────────────────────────────────────────────

export function useLoyaltyProfile() {
  return useQuery({
    queryKey: ['loyalty'],
    queryFn: () => api.get<LoyaltyProfile>('/mobile/loyalty'),
  });
}

// ─── Types ────────────────────────────────────────────────────────

export interface CatalogProduct {
  id: string;
  name: string;
  brand_name: string | null;
  category_name: string | null;
  base_price: number;
  image_url: string | null;
  variant_count: number;
  min_price: number;
  max_price: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  brand_name: string | null;
  category_name: string | null;
  base_price: number;
  images: string[];
  variants: VariantWithStock[];
}

export interface VariantWithStock {
  id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  price: number;
  images: string[];
  stock_by_branch: { branch_id: string; branch_name: string; stock: number }[];
  total_stock: number;
}

export interface BranchWithStock {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  has_stock: boolean;
}

export interface OrderSummary {
  id: string;
  order_number: number;
  folio: string;
  status: string;
  fulfillment_type: string;
  total_amount: number;
  item_count: number;
  created_at: string;
}

export interface OrderDetail extends OrderSummary {
  items: {
    variant_id: string;
    product_name: string;
    sku: string;
    attributes: Record<string, string>;
    image_url: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
  pickup_branch_name: string | null;
  shipping_address: Record<string, string> | null;
  paid_at: string | null;
  completed_at: string | null;
}

export interface LayawaySummary {
  id: string;
  folio: string;
  total_amount: number;
  balance_due: number;
  status: string;
  due_date: string;
  item_count: number;
  branch_name: string;
  created_at: string;
}

export interface LayawayDetail extends LayawaySummary {
  items: {
    variant_id: string;
    product_name: string;
    sku: string;
    attributes: Record<string, string>;
    image_url: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
  payments: {
    id: string;
    amount: number;
    payment_method: string;
    created_at: string;
  }[];
  down_payment: number;
}

export interface LoyaltyProfile {
  customer_id: string;
  name: string;
  points: number;
  tier: string | null;
  qr_data: string;
  total_purchases: number;
  member_since: string;
}
