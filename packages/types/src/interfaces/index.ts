import {
  EmployeeRole,
  SuperAdminRole,
  SubscriptionStatus,
  PaymentMethod,
  SaleType,
  SaleStatus,
  PosSessionStatus,
  StorageLocationType,
} from '../enums';

// ==========================================
// Master DB Interfaces
// ==========================================

export interface ITenant {
  id: string;
  name: string;
  subdomain: string;
  database_name: string;
  logo_url: string | null;
  theme_settings: Record<string, unknown>;
  stripe_customer_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ISubscription {
  id: string;
  tenant_id: string;
  stripe_subscription_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  current_period_end: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ISuperAdmin {
  id: string;
  email: string;
  password_hash: string;
  role: SuperAdminRole;
  created_at: Date;
}

// ==========================================
// Tenant DB Interfaces
// ==========================================

export interface IBrand {
  id: string;
  name: string;
  created_at: Date;
}

export interface ICategory {
  id: string;
  name: string;
  created_at: Date;
}

export interface IBranch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: Date;
}

export interface IProduct {
  id: string;
  name: string;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  image_url: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface IProductVariant {
  id: string;
  product_id: string;
  sku: string;
  color: string;
  size_mex: number;
  price: number;
  cost: number;
  barcode: string | null;
  created_at: Date;
}

export interface IInventory {
  id: string;
  variant_id: string;
  branch_id: string;
  stock_available: number;
  stock_minimum: number;
  updated_at: Date;
}

export interface IEmployee {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  pin_code: string | null;
  role: EmployeeRole;
  branch_id: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface IPosSession {
  id: string;
  employee_id: string;
  branch_id: string;
  opening_amount: number;
  closing_amount: number | null;
  status: PosSessionStatus;
  opened_at: Date;
  closed_at: Date | null;
}

export interface ISale {
  id: string;
  pos_session_id: string | null;
  customer_id: string | null;
  employee_id: string;
  branch_id: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payment_method: PaymentMethod;
  sale_type: SaleType;
  status: SaleStatus;
  notes: string | null;
  created_at: Date;
}

export interface ISaleItem {
  id: string;
  sale_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export interface ICustomer {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
  date_of_birth: Date | null;
  notes: string | null;
  loyalty_points: number;
  membership_tier: string | null;
  credit_balance: number;
  is_active: boolean;
  tags: string[];
  addresses?: ICustomerAddress[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ICustomerAddress {
  id: string;
  customer_id: string;
  label: string | null;
  street: string;
  neighborhood: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  reference: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==========================================
// Storage Locations & Inventory Location
// ==========================================

export interface IStorageLocation {
  id: string;
  branch_id: string;
  parent_id: string | null;
  name: string;
  code: string;
  type: StorageLocationType;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  children?: IStorageLocation[];
}

export interface IInventoryLocation {
  id: string;
  variant_id: string;
  branch_id: string;
  location_id: string;
  quantity: number;
  updated_at: Date;
}

// ==========================================
// Mobile B2C Interfaces
// ==========================================

export interface ICustomerAuth {
  id: string;
  customer_id: string;
  email: string;
  password_hash: string;
  phone: string | null;
  is_verified: boolean;
  push_token: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IOrder {
  id: string;
  order_number: number;
  customer_id: string;
  branch_id: string | null;
  employee_id: string | null;
  fulfillment_type: string;
  status: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  stripe_payment_intent_id: string | null;
  shipping_address: Record<string, string> | null;
  pickup_branch_id: string | null;
  notes: string | null;
  paid_at: Date | null;
  packed_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface IOrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

export interface IDeliveryProof {
  id: string;
  order_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  recipient_name: string | null;
  notes: string | null;
  status: string;
  delivered_at: Date;
  created_at: Date;
}

export interface IPreSale {
  id: string;
  branch_id: string;
  employee_id: string;
  customer_id: string | null;
  status: string;
  items: IPreSaleItem[];
  total_amount: number;
  qr_code: string;
  expires_at: Date;
  created_at: Date;
}

export interface IPreSaleItem {
  id: string;
  pre_sale_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// ==========================================
// Branch with geo coordinates (for BOPIS)
// ==========================================

export interface IBranchWithGeo extends IBranch {
  latitude: number | null;
  longitude: number | null;
  distance_km?: number;
}
