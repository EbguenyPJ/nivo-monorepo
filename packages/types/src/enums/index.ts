export enum EmployeeRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
}

export enum SuperAdminRole {
  SUPER_ADMIN = 'super-admin',
  SUPPORT = 'soporte',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  PAUSED = 'paused',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MIXED = 'mixed',
  ONLINE = 'online',
}

export enum SaleType {
  IN_STORE = 'in_store',
  CLICK_AND_COLLECT = 'click_and_collect',
  DELIVERY = 'delivery',
}

export enum SaleStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  REFUNDED = 'refunded',
}

export enum PosSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum TransferStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum StorageLocationType {
  ZONE = 'zone',
  AISLE = 'aisle',
  SHELF = 'shelf',
  BIN = 'bin',
}

export enum MembershipTier {
  NONE = 'none',
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  WHOLESALE = 'wholesale',
}
