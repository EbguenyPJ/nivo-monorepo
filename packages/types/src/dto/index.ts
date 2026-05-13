import { PaymentMethod, SaleType, EmployeeRole, StorageLocationType } from '../enums';

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
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  rfc?: string;
  date_of_birth?: string;
  notes?: string;
  tags?: string[];
  address?: CreateCustomerAddressDto;
}

export interface UpdateCustomerDto {
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  rfc?: string | null;
  date_of_birth?: string | null;
  notes?: string | null;
  membership_tier?: string | null;
  tags?: string[];
  is_active?: boolean;
}

export interface CreateCustomerAddressDto {
  label?: string;
  street: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  reference?: string;
  is_default?: boolean;
}

export interface UpdateCustomerAddressDto {
  label?: string | null;
  street?: string;
  neighborhood?: string | null;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  reference?: string | null;
  is_default?: boolean;
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

// Storage Locations
export interface CreateStorageLocationDto {
  branch_id: string;
  parent_id?: string;
  name: string;
  code: string;
  type: StorageLocationType;
  description?: string;
}

export interface UpdateStorageLocationDto {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

// Inventory Location
export interface AssignInventoryLocationDto {
  variant_id: string;
  branch_id: string;
  location_id: string;
  quantity: number;
}

export interface MoveInventoryLocationDto {
  variant_id: string;
  branch_id: string;
  from_location_id: string;
  to_location_id: string;
  quantity: number;
}

// ==========================================
// Mobile B2C DTOs
// ==========================================

export interface CustomerRegisterDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface CustomerLoginDto {
  email: string;
  password: string;
}

export interface CreateOrderDto {
  customer_id: string;
  fulfillment_type: 'bopis' | 'delivery' | 'ship_to_home';
  items: { variant_id: string; quantity: number; unit_price: number }[];
  pickup_branch_id?: string;
  shipping_address?: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
  stripe_payment_method_id?: string;
  notes?: string;
}

export interface LayawayStripePaymentDto {
  layaway_id: string;
  amount: number;
  stripe_payment_method_id: string;
}

export interface UpdatePushTokenDto {
  push_token: string;
}

// ==========================================
// Mobile B2B DTOs
// ==========================================

export interface ScanBarcodeDto {
  audit_id: string;
  barcode: string;
}

export interface PickingVerifyDto {
  order_id: string;
  barcode: string;
}

export interface MarkPackedDto {
  order_id: string;
}

export interface CreatePreSaleDto {
  customer_id?: string;
  items: { variant_id: string; quantity: number; unit_price: number }[];
}

export interface CreateExpenseWithReceiptDto {
  branch_id: string;
  category_id: string;
  amount: number;
  description: string;
}

export interface DeliveryProofDto {
  order_id: string;
  latitude: number;
  longitude: number;
  recipient_name?: string;
  notes?: string;
}
