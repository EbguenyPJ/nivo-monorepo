import { PaymentMethod, SaleType, EmployeeRole } from '../enums';

// Auth
export interface LoginDto {
  email: string;
  password: string;
}

export interface PinLoginDto {
  pin_code: string;
  branch_id: string;
}

// Tenants
export interface CreateTenantDto {
  name: string;
  subdomain: string;
  owner_email: string;
  owner_password: string;
  plan_name: string;
}

export interface UpdateTenantThemeDto {
  logo_url?: string;
  theme_settings?: Record<string, unknown>;
}

// Products
export interface CreateProductDto {
  name: string;
  description?: string;
  brand_id?: string;
  category_id?: string;
  image_url?: string;
  variants: CreateProductVariantDto[];
}

export interface CreateProductVariantDto {
  sku: string;
  color: string;
  size_mex: number;
  price: number;
  cost: number;
  barcode?: string;
}

// Inventory
export interface AdjustInventoryDto {
  variant_id: string;
  branch_id: string;
  quantity_change: number;
  reason: string;
}

export interface TransferInventoryDto {
  variant_id: string;
  from_branch_id: string;
  to_branch_id: string;
  quantity: number;
}

// POS
export interface OpenPosSessionDto {
  branch_id: string;
  opening_amount: number;
}

export interface ClosePosSessionDto {
  closing_amount: number;
}

// Sales
export interface CreateSaleDto {
  id?: string;
  customer_id?: string;
  payment_method: PaymentMethod;
  sale_type: SaleType;
  items: CreateSaleItemDto[];
  discount_amount?: number;
  notes?: string;
}

export interface CreateSaleItemDto {
  variant_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface SyncSalesDto {
  sales: CreateSaleDto[];
}

export interface RefundSaleDto {
  sale_id: string;
  reason: string;
  items?: { sale_item_id: string; quantity: number }[];
}

// Customers
export interface CreateCustomerDto {
  name: string;
  email?: string;
  phone?: string;
}

export interface RedeemPointsDto {
  customer_id: string;
  points: number;
}

// Employees
export interface CreateEmployeeDto {
  name: string;
  email: string;
  password: string;
  pin_code?: string;
  role: EmployeeRole;
  branch_id?: string;
}

// Storefront
export interface CheckoutDto {
  customer_email: string;
  customer_name: string;
  items: CreateSaleItemDto[];
  sale_type: SaleType;
  branch_id?: string;
  shipping_address?: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
  payment_method_id?: string;
}
