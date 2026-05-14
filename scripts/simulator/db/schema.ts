import pg from 'pg';
import { query } from './connection.js';

/**
 * Creates all master DB tables (if not exist).
 * Uses the same schema as TypeORM entities with synchronize:true would produce.
 */
export async function createMasterSchema(pool: pg.Pool): Promise<void> {
  await query(pool, `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "super_admins" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "email" varchar(255) UNIQUE NOT NULL,
      "password_hash" varchar NOT NULL,
      "role" varchar NOT NULL DEFAULT 'super-admin',
      "created_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "tenants" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL,
      "subdomain" varchar(100) UNIQUE NOT NULL,
      "database_name" varchar(255) NOT NULL,
      "logo_url" varchar,
      "theme_settings" jsonb DEFAULT '{}',
      "stripe_customer_id" varchar,
      "rfc" varchar(20),
      "razon_social" varchar(255),
      "regimen_fiscal" varchar(100),
      "codigo_postal_fiscal" varchar(10),
      "direccion_fiscal" text,
      "override_max_branches" int,
      "override_max_users" int,
      "override_storage_limit_gb" int,
      "override_notes" text,
      "override_mod_transfers" boolean,
      "override_mod_invoicing" boolean,
      "override_mod_loyalty" boolean,
      "override_mod_advanced_reports" boolean,
      "override_mod_ecommerce" boolean,
      "override_mod_custom_branding" boolean,
      "override_support_type" varchar(20),
      "override_support_hours" varchar(255),
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid REFERENCES "tenants"("id"),
      "stripe_subscription_id" varchar,
      "plan_name" varchar(50) NOT NULL,
      "status" varchar NOT NULL DEFAULT 'active',
      "current_period_end" timestamptz,
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "plan_configs" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "plan_name" varchar(50) UNIQUE NOT NULL,
      "display_name" varchar(100) NOT NULL,
      "description" text,
      "monthly_price" decimal(10,2) NOT NULL,
      "annual_price" decimal(10,2) NOT NULL,
      "stripe_price_id_monthly" varchar(255),
      "stripe_price_id_annual" varchar(255),
      "is_active" boolean DEFAULT true,
      "sort_order" int DEFAULT 0,
      "max_branches" int DEFAULT 1,
      "max_users" int DEFAULT 2,
      "storage_limit_gb" int DEFAULT 0,
      "mod_transfers" boolean DEFAULT false,
      "mod_invoicing" boolean DEFAULT false,
      "mod_loyalty" boolean DEFAULT false,
      "mod_advanced_reports" boolean DEFAULT false,
      "mod_ecommerce" boolean DEFAULT false,
      "mod_custom_branding" boolean DEFAULT false,
      "support_level" varchar(50),
      "support_type" varchar(20),
      "support_hours" varchar(255),
      "support_description" varchar(255),
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "tenant_billing_profiles" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid UNIQUE NOT NULL,
      "rfc" varchar(13) NOT NULL,
      "legal_name" varchar(255) NOT NULL,
      "zip_code" varchar(5) NOT NULL,
      "tax_regime" varchar(10) NOT NULL,
      "cfdi_use" varchar(10) DEFAULT 'G03',
      "requires_invoice" boolean DEFAULT false,
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "billing_invoices" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid NOT NULL,
      "stripe_subscription_id" varchar,
      "stripe_invoice_id" varchar UNIQUE,
      "amount_total" decimal(10,2) NOT NULL,
      "amount_subtotal" decimal(10,2) NOT NULL,
      "amount_tax" decimal(10,2) NOT NULL,
      "description" varchar,
      "period_start" timestamptz,
      "period_end" timestamptz,
      "status" varchar DEFAULT 'paid',
      "cfdi_status" varchar DEFAULT 'pending',
      "sat_uuid" varchar,
      "xml_url" text,
      "pdf_url" text,
      "pac_error" text,
      "pac_cfdi_id" varchar,
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'paid'`);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "integrations" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "type" varchar(50) UNIQUE NOT NULL,
      "display_name" varchar(100) NOT NULL,
      "is_enabled" boolean DEFAULT false,
      "config" text,
      "status" varchar(50) DEFAULT 'inactive',
      "last_tested_at" timestamptz,
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "type" varchar(50) NOT NULL,
      "title" varchar(255) NOT NULL,
      "message" text NOT NULL,
      "tenant_id" uuid,
      "tenant_name" varchar(255),
      "is_read" boolean DEFAULT false,
      "created_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "system_settings" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "key" varchar(100) UNIQUE NOT NULL,
      "value" text NOT NULL,
      "value_type" varchar(50) NOT NULL,
      "category" varchar(100),
      "description" varchar(255),
      "is_secret" boolean DEFAULT false,
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "support_tickets" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant_id" uuid NOT NULL,
      "tenant_name" varchar(255) NOT NULL,
      "subject" varchar(255) NOT NULL,
      "status" varchar(50) DEFAULT 'open',
      "priority" varchar(50) DEFAULT 'medium',
      "category" varchar(100),
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "ticket_messages" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "ticket_id" uuid REFERENCES "support_tickets"("id"),
      "sender_type" varchar(20) NOT NULL,
      "sender_name" varchar(255),
      "message" text NOT NULL,
      "created_at" timestamptz DEFAULT now()
    )
  `);

  await query(pool, `
    CREATE TABLE IF NOT EXISTS "ticket_attachments" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "ticket_id" uuid REFERENCES "support_tickets"("id"),
      "message_id" uuid,
      "original_name" varchar(255) NOT NULL,
      "stored_name" varchar(255) NOT NULL,
      "mime_type" varchar(100) NOT NULL,
      "size" int NOT NULL,
      "path" varchar(500) NOT NULL,
      "created_at" timestamptz DEFAULT now()
    )
  `);

  console.log('  Master schema created');
}

/**
 * Creates all tenant DB tables using raw SQL.
 * Mirrors TypeORM entity definitions.
 */
export async function createTenantSchema(pool: pg.Pool): Promise<void> {
  await query(pool, `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  // Core reference tables
  const ddl = `
    CREATE TABLE IF NOT EXISTS "branches" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL,
      "code" varchar(20) UNIQUE NOT NULL,
      "address" varchar, "city" varchar(100), "zip_code" varchar(10), "phone" varchar(20),
      "ticket_footer" text, "custom_landed_cost_percentage" decimal(8,2),
      "latitude" decimal(10,7), "longitude" decimal(10,7),
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "brands" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "logo_url" varchar, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "categories" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "collections" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "parent_id" uuid REFERENCES "collections"("id"),
      "color" varchar(9), "image_url" varchar, "sort_order" int DEFAULT 0,
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "colors" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(100) NOT NULL, "hex_code" varchar(9) NOT NULL,
      "branch_id" uuid REFERENCES "branches"("id"),
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "size_groups" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(100) NOT NULL, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "size_systems" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(50) NOT NULL, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "sizes" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "size_group_id" uuid REFERENCES "size_groups"("id"),
      "order_index" int NOT NULL,
      "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "size_equivalencies" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "size_id" uuid REFERENCES "sizes"("id"),
      "size_system_id" uuid REFERENCES "size_systems"("id"),
      "value" varchar(20) NOT NULL,
      UNIQUE("size_id", "size_system_id")
    );

    CREATE TABLE IF NOT EXISTS "taxes" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(100) NOT NULL, "percentage" decimal(5,2) NOT NULL,
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "units_of_measure" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(100) NOT NULL, "abbreviation" varchar(10),
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "payment_methods" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(100) NOT NULL, "requires_reference" boolean DEFAULT false,
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "cancellation_reasons" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "affects_inventory" boolean DEFAULT true,
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "price_lists" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(100) NOT NULL, "default_margin_percentage" decimal(8,2) NOT NULL,
      "is_default" boolean DEFAULT false, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "expense_categories" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(100) NOT NULL, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now()
    );

    -- RBAC
    CREATE TABLE IF NOT EXISTS "permissions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "key" varchar(100) UNIQUE NOT NULL, "name" varchar(255) NOT NULL,
      "module" varchar(100) NOT NULL, "submodule" varchar(100),
      "sort_order" int DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "roles" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "slug" varchar(50) UNIQUE NOT NULL, "name" varchar(100) NOT NULL,
      "description" varchar(255), "is_system" boolean DEFAULT false,
      "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "role_has_permissions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "role_id" uuid REFERENCES "roles"("id"), "permission_id" uuid REFERENCES "permissions"("id"),
      UNIQUE("role_id", "permission_id")
    );

    CREATE TABLE IF NOT EXISTS "employees" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "email" varchar(255) UNIQUE NOT NULL,
      "password_hash" varchar NOT NULL, "phone" varchar(20), "pin_hash" varchar,
      "role" varchar NOT NULL DEFAULT 'cashier',
      "role_id" uuid REFERENCES "roles"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "is_owner" boolean DEFAULT false, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "employee_has_permissions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "employee_id" uuid REFERENCES "employees"("id"),
      "permission_id" uuid REFERENCES "permissions"("id"),
      "granted" boolean DEFAULT true,
      UNIQUE("employee_id", "permission_id")
    );

    CREATE TABLE IF NOT EXISTS "branch_role_employees" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "employee_id" uuid REFERENCES "employees"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "role_id" uuid REFERENCES "roles"("id"),
      "created_at" timestamptz DEFAULT now(),
      UNIQUE("employee_id", "branch_id")
    );

    -- Products
    CREATE TABLE IF NOT EXISTS "products" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "description" varchar,
      "brand_id" uuid REFERENCES "brands"("id"),
      "category_id" uuid REFERENCES "categories"("id"),
      "base_price" decimal(10,2) NOT NULL, "images" jsonb DEFAULT '[]',
      "image_url" varchar, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now(),
      "deleted_at" timestamptz
    );

    CREATE TABLE IF NOT EXISTS "product_variants" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "product_id" uuid REFERENCES "products"("id"),
      "sku" varchar(100) UNIQUE NOT NULL,
      "attributes" jsonb DEFAULT '{}',
      "price_override" decimal(10,2), "cost" decimal(10,2) NOT NULL,
      "barcode" varchar, "images" jsonb DEFAULT '[]',
      "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "collection_products" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "collection_id" uuid REFERENCES "collections"("id"),
      "product_id" uuid REFERENCES "products"("id"),
      UNIQUE("collection_id", "product_id")
    );

    CREATE TABLE IF NOT EXISTS "variant_price_margins" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "price_list_id" uuid REFERENCES "price_lists"("id"),
      "custom_margin_percentage" decimal(8,2) NOT NULL,
      UNIQUE("variant_id", "price_list_id")
    );

    CREATE TABLE IF NOT EXISTS "branch_variant_overrides" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "purchase_price_override" decimal(10,2) NOT NULL,
      UNIQUE("variant_id", "branch_id")
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS "suppliers" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "tax_id" varchar(50), "contact_name" varchar(255),
      "email" varchar(255), "phone" varchar(30), "credit_days" int DEFAULT 30,
      "notes" text, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "variant_suppliers" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "supplier_id" uuid REFERENCES "suppliers"("id"),
      "supplier_sku" varchar(100), "last_cost" decimal(10,2) NOT NULL,
      "is_default" boolean DEFAULT false,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now(),
      UNIQUE("variant_id", "supplier_id")
    );

    -- Inventory
    CREATE TABLE IF NOT EXISTS "inventory" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "stock_available" int DEFAULT 0, "stock_minimum" int DEFAULT 5, "stock_maximum" int DEFAULT 50,
      "updated_at" timestamptz DEFAULT now(),
      UNIQUE("variant_id", "branch_id")
    );

    CREATE TABLE IF NOT EXISTS "storage_locations" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "branch_id" uuid REFERENCES "branches"("id"),
      "parent_id" uuid REFERENCES "storage_locations"("id"),
      "name" varchar(100) NOT NULL, "code" varchar(50) NOT NULL,
      "type" varchar(20) NOT NULL, "description" text, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now(),
      UNIQUE("branch_id", "code")
    );

    CREATE TABLE IF NOT EXISTS "inventory_locations" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "location_id" uuid REFERENCES "storage_locations"("id"),
      "quantity" int DEFAULT 0, "updated_at" timestamptz DEFAULT now(),
      UNIQUE("variant_id", "branch_id", "location_id")
    );

    CREATE TABLE IF NOT EXISTS "inventory_adjustments" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "audit_id" uuid, "variant_id" uuid REFERENCES "product_variants"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "reason" varchar(50) NOT NULL, "quantity" int NOT NULL,
      "financial_impact" decimal(12,2) NOT NULL,
      "approved_by_id" uuid REFERENCES "employees"("id"),
      "notes" text, "created_at" timestamptz DEFAULT now()
    );

    -- Transfers
    CREATE TABLE IF NOT EXISTS "inventory_transfers" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "folio_number" serial,
      "origin_branch_id" uuid REFERENCES "branches"("id"),
      "destination_branch_id" uuid REFERENCES "branches"("id"),
      "status" varchar NOT NULL DEFAULT 'draft',
      "created_by_id" uuid REFERENCES "employees"("id"),
      "received_by_id" uuid REFERENCES "employees"("id"),
      "shipped_at" timestamptz, "received_at" timestamptz,
      "notes" text, "discrepancy_notes" text,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "inventory_transfer_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "transfer_id" uuid REFERENCES "inventory_transfers"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "sent_quantity" int NOT NULL, "received_quantity" int
    );

    -- Audits
    CREATE TABLE IF NOT EXISTS "inventory_audits" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "folio_number" serial,
      "branch_id" uuid REFERENCES "branches"("id"),
      "type" varchar NOT NULL DEFAULT 'full',
      "status" varchar NOT NULL DEFAULT 'draft',
      "filter_criteria" jsonb,
      "branch_locked" boolean DEFAULT false,
      "created_by_id" uuid REFERENCES "employees"("id"),
      "closed_by_id" uuid REFERENCES "employees"("id"),
      "started_at" timestamptz, "completed_at" timestamptz,
      "notes" text,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "inventory_audit_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "audit_id" uuid REFERENCES "inventory_audits"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "location_id" uuid REFERENCES "storage_locations"("id"),
      "expected_quantity" int NOT NULL, "counted_quantity" int,
      "difference" int, "item_status" varchar DEFAULT 'pending',
      "adjustment_reason" varchar(100), "unit_cost" decimal(10,2) NOT NULL
    );

    -- Purchasing
    CREATE TABLE IF NOT EXISTS "purchase_requisitions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "folio_number" serial,
      "branch_id" uuid REFERENCES "branches"("id"),
      "status" varchar NOT NULL DEFAULT 'draft',
      "total_estimated_cost" decimal(12,2) DEFAULT 0,
      "total_items" int DEFAULT 0,
      "locked_by_id" uuid REFERENCES "employees"("id"),
      "locked_at" timestamptz,
      "approved_by_id" uuid REFERENCES "employees"("id"),
      "approved_at" timestamptz,
      "notes" text,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "requisition_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "requisition_id" uuid REFERENCES "purchase_requisitions"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "suggested_quantity" int NOT NULL, "override_quantity" int,
      "current_stock" int NOT NULL, "max_stock" int NOT NULL,
      "estimated_cost" decimal(10,2) NOT NULL,
      "supplier_id" uuid REFERENCES "suppliers"("id"),
      "supplier_sku" varchar(100)
    );

    CREATE TABLE IF NOT EXISTS "purchase_orders" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "folio_number" serial,
      "supplier_id" uuid REFERENCES "suppliers"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "status" varchar NOT NULL DEFAULT 'draft',
      "total_cost" decimal(12,2) NOT NULL,
      "invoice_number" varchar(100),
      "created_by_id" uuid REFERENCES "employees"("id"),
      "received_by_id" uuid REFERENCES "employees"("id"),
      "expected_date" date, "received_at" timestamptz,
      "notes" text, "discrepancy_notes" text,
      "requisition_id" uuid REFERENCES "purchase_requisitions"("id"),
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "purchase_order_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "purchase_order_id" uuid REFERENCES "purchase_orders"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "ordered_quantity" int NOT NULL, "received_quantity" int,
      "unit_cost" decimal(10,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "accounts_payable" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "supplier_id" uuid REFERENCES "suppliers"("id"),
      "purchase_order_id" uuid REFERENCES "purchase_orders"("id"),
      "amount" decimal(12,2) NOT NULL, "paid_amount" decimal(12,2) DEFAULT 0,
      "due_date" date NOT NULL, "status" varchar DEFAULT 'pending',
      "notes" text,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS "customers" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "name" varchar(255) NOT NULL, "first_name" varchar(150), "last_name" varchar(150),
      "email" varchar, "phone" varchar, "rfc" varchar(13),
      "date_of_birth" date, "notes" text, "internal_notes" text,
      "price_list_id" uuid REFERENCES "price_lists"("id"),
      "loyalty_points" int DEFAULT 0, "membership_tier" varchar(50),
      "credit_balance" decimal(10,2) DEFAULT 0,
      "is_active" boolean DEFAULT true, "tags" text DEFAULT '[]',
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now(),
      "deleted_at" timestamptz
    );

    CREATE TABLE IF NOT EXISTS "customer_addresses" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "customer_id" uuid REFERENCES "customers"("id"),
      "label" varchar(100), "street" varchar(500) NOT NULL,
      "neighborhood" varchar(200), "city" varchar(200) NOT NULL,
      "state" varchar(100) NOT NULL, "zip_code" varchar(10) NOT NULL,
      "country" varchar(100) DEFAULT 'México', "reference" text,
      "is_default" boolean DEFAULT false,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "customer_auth" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "customer_id" uuid REFERENCES "customers"("id"),
      "email" varchar(255) UNIQUE NOT NULL, "password_hash" varchar(255) NOT NULL,
      "phone" varchar(20), "is_verified" boolean DEFAULT false,
      "push_token" varchar(500),
      "verification_code" varchar(6), "verification_code_expires_at" timestamptz,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    -- POS
    CREATE TABLE IF NOT EXISTS "cash_registers" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "branch_id" uuid REFERENCES "branches"("id"),
      "name" varchar(100) NOT NULL, "is_active" boolean DEFAULT true,
      "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "pos_sessions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "employee_id" uuid REFERENCES "employees"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "cash_register_id" uuid REFERENCES "cash_registers"("id"),
      "opening_amount" decimal(10,2) NOT NULL,
      "closing_amount" decimal(10,2), "expected_amount" decimal(10,2),
      "difference" decimal(10,2),
      "status" varchar DEFAULT 'open',
      "opened_at" timestamptz NOT NULL, "closed_at" timestamptz,
      "closed_by" uuid REFERENCES "employees"("id")
    );

    CREATE TABLE IF NOT EXISTS "cash_transactions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "session_id" uuid REFERENCES "pos_sessions"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "type" varchar NOT NULL,
      "amount" decimal(10,2) NOT NULL, "description" text,
      "declared_amount" decimal(10,2), "expected_amount" decimal(10,2),
      "difference" decimal(10,2),
      "created_at" timestamptz DEFAULT now()
    );

    -- Sales
    CREATE TABLE IF NOT EXISTS "sales" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "pos_session_id" uuid REFERENCES "pos_sessions"("id"),
      "customer_id" uuid REFERENCES "customers"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "total_amount" decimal(10,2) NOT NULL, "discount_amount" decimal(10,2) DEFAULT 0,
      "tax_amount" decimal(10,2) DEFAULT 0,
      "payment_method" varchar DEFAULT 'cash',
      "sale_type" varchar DEFAULT 'in_store',
      "status" varchar DEFAULT 'completed',
      "notes" text, "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "sale_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "sale_id" uuid REFERENCES "sales"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "quantity" int NOT NULL, "unit_price" decimal(10,2) NOT NULL,
      "discount" decimal(10,2) DEFAULT 0, "subtotal" decimal(10,2) NOT NULL,
      "unit_cost_at_sale" decimal(10,2)
    );

    CREATE TABLE IF NOT EXISTS "sale_payments" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "sale_id" uuid REFERENCES "sales"("id"),
      "payment_method_id" uuid REFERENCES "payment_methods"("id"),
      "payment_method_name" varchar(100) NOT NULL,
      "amount" decimal(10,2) NOT NULL, "reference" varchar(255),
      "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "sale_returns" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "sale_id" uuid REFERENCES "sales"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "pos_session_id" uuid REFERENCES "pos_sessions"("id"),
      "refund_amount" decimal(10,2) NOT NULL,
      "refund_method" varchar DEFAULT 'cash',
      "cancellation_reason_id" uuid REFERENCES "cancellation_reasons"("id"),
      "reason" text, "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "sale_return_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "sale_return_id" uuid REFERENCES "sale_returns"("id"),
      "sale_item_id" uuid REFERENCES "sale_items"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "quantity" int NOT NULL, "unit_price" decimal(10,2) NOT NULL,
      "subtotal" decimal(10,2) NOT NULL,
      "disposition" varchar DEFAULT 'floor'
    );

    -- Layaways
    CREATE TABLE IF NOT EXISTS "layaways" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "folio_number" serial,
      "customer_id" uuid REFERENCES "customers"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "total_amount" decimal(12,2) NOT NULL, "down_payment" decimal(12,2) NOT NULL,
      "balance_due" decimal(12,2) NOT NULL,
      "status" varchar DEFAULT 'active',
      "due_date" date NOT NULL, "pos_session_id" uuid, "final_sale_id" uuid,
      "notes" text,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "layaway_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "layaway_id" uuid REFERENCES "layaways"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "quantity" int NOT NULL, "unit_price" decimal(10,2) NOT NULL,
      "discount" decimal(10,2) DEFAULT 0, "subtotal" decimal(10,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "layaway_payments" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "layaway_id" uuid REFERENCES "layaways"("id"),
      "amount" decimal(12,2) NOT NULL, "payment_method" varchar(50) NOT NULL,
      "reference" varchar(255),
      "employee_id" uuid REFERENCES "employees"("id"),
      "pos_session_id" uuid REFERENCES "pos_sessions"("id"),
      "created_at" timestamptz DEFAULT now()
    );

    -- Credit
    CREATE TABLE IF NOT EXISTS "credit_accounts" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "customer_id" uuid UNIQUE REFERENCES "customers"("id"),
      "credit_limit" decimal(12,2) NOT NULL, "current_balance" decimal(12,2) DEFAULT 0,
      "payment_terms" int DEFAULT 30, "is_active" boolean DEFAULT true,
      "notes" text,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "credit_transactions" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "credit_account_id" uuid REFERENCES "credit_accounts"("id"),
      "type" varchar NOT NULL, "amount" decimal(12,2) NOT NULL,
      "balance_after" decimal(12,2) NOT NULL,
      "sale_id" uuid REFERENCES "sales"("id"),
      "payment_method" varchar(50), "reference" varchar(500),
      "due_date" date,
      "employee_id" uuid REFERENCES "employees"("id"),
      "pos_session_id" uuid,
      "created_at" timestamptz DEFAULT now()
    );

    -- Loyalty
    CREATE TABLE IF NOT EXISTS "loyalty_configs" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "is_active" boolean DEFAULT false,
      "spend_per_point" decimal(10,2) DEFAULT 10,
      "point_value" decimal(10,2) DEFAULT 0.10,
      "min_redemption_points" int DEFAULT 100,
      "expiration_days" int DEFAULT 365,
      "earn_on_layaway" boolean DEFAULT false,
      "earn_on_credit" boolean DEFAULT false,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "loyalty_ledgers" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "customer_id" uuid REFERENCES "customers"("id"),
      "sale_id" uuid REFERENCES "sales"("id"),
      "type" varchar NOT NULL,
      "points_earned" int DEFAULT 0, "points_spent" int DEFAULT 0,
      "balance_after" int NOT NULL, "description" varchar(500),
      "employee_id" uuid REFERENCES "employees"("id"),
      "created_at" timestamptz DEFAULT now()
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS "expenses" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "branch_id" uuid REFERENCES "branches"("id"),
      "category_id" uuid REFERENCES "expense_categories"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "pos_session_id" uuid REFERENCES "pos_sessions"("id"),
      "amount" decimal(12,2) NOT NULL, "description" text NOT NULL,
      "payment_source" varchar(20) NOT NULL,
      "receipt_url" varchar(500), "date" date NOT NULL,
      "is_cancelled" boolean DEFAULT false, "cancellation_note" text,
      "created_at" timestamptz DEFAULT now()
    );

    -- Orders (e-commerce / mobile)
    CREATE TABLE IF NOT EXISTS "orders" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "order_number" serial,
      "customer_id" uuid REFERENCES "customers"("id"),
      "branch_id" uuid REFERENCES "branches"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "fulfillment_type" varchar NOT NULL DEFAULT 'bopis',
      "status" varchar NOT NULL DEFAULT 'pending_payment',
      "total_amount" decimal(12,2) NOT NULL, "discount_amount" decimal(12,2) DEFAULT 0,
      "tax_amount" decimal(12,2) DEFAULT 0,
      "stripe_payment_intent_id" varchar(255),
      "shipping_address" jsonb, "pickup_branch_id" uuid REFERENCES "branches"("id"),
      "notes" text, "paid_at" timestamptz, "packed_at" timestamptz,
      "completed_at" timestamptz,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "order_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "order_id" uuid REFERENCES "orders"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "quantity" int NOT NULL, "unit_price" decimal(10,2) NOT NULL,
      "discount" decimal(10,2) DEFAULT 0, "subtotal" decimal(10,2) NOT NULL,
      "is_picked" boolean DEFAULT false, "picked_barcode" varchar
    );

    CREATE TABLE IF NOT EXISTS "order_tracking" (
      "id" serial PRIMARY KEY,
      "order_id" uuid REFERENCES "orders"("id"),
      "latitude" decimal(10,8) NOT NULL, "longitude" decimal(11,8) NOT NULL,
      "timestamp" timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "idx_order_tracking_order_id" ON "order_tracking"("order_id");

    CREATE TABLE IF NOT EXISTS "delivery_proofs" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "order_id" uuid REFERENCES "orders"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "latitude" decimal(10,7) NOT NULL, "longitude" decimal(10,7) NOT NULL,
      "photo_url" varchar(500), "recipient_name" varchar(255),
      "notes" text, "status" varchar DEFAULT 'pending',
      "delivered_at" timestamptz, "created_at" timestamptz DEFAULT now()
    );

    -- Pre-sales (QR)
    CREATE TABLE IF NOT EXISTS "pre_sales" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "branch_id" uuid REFERENCES "branches"("id"),
      "employee_id" uuid REFERENCES "employees"("id"),
      "customer_id" uuid REFERENCES "customers"("id"),
      "status" varchar DEFAULT 'open',
      "total_amount" decimal(12,2) NOT NULL,
      "qr_code" varchar(255) UNIQUE NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "pre_sale_items" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "pre_sale_id" uuid REFERENCES "pre_sales"("id"),
      "variant_id" uuid REFERENCES "product_variants"("id"),
      "quantity" int NOT NULL, "unit_price" decimal(10,2) NOT NULL,
      "subtotal" decimal(10,2) NOT NULL
    );

    -- Settings & Integrations
    CREATE TABLE IF NOT EXISTS "tenant_settings" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "key" varchar(100) UNIQUE NOT NULL, "value" text NOT NULL,
      "label" varchar(255), "group" varchar(50),
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "branch_setting_overrides" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "branch_id" uuid REFERENCES "branches"("id"),
      "key" varchar(100) NOT NULL, "value" text NOT NULL,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now(),
      UNIQUE("branch_id", "key")
    );

    CREATE TABLE IF NOT EXISTS "tenant_integrations" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "integration_type" varchar(50) UNIQUE NOT NULL,
      "display_name" varchar(100) NOT NULL,
      "credentials_encrypted" text NOT NULL,
      "is_active" boolean DEFAULT false, "status" varchar(30) DEFAULT 'inactive',
      "last_tested_at" timestamptz, "last_error" text,
      "created_at" timestamptz DEFAULT now(), "updated_at" timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "integration_logs" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "integration_id" uuid REFERENCES "tenant_integrations"("id"),
      "action" varchar(50) NOT NULL, "status" varchar(20) NOT NULL,
      "request_payload" jsonb, "response_payload" jsonb,
      "error_message" text, "duration_ms" int,
      "triggered_by" uuid,
      "created_at" timestamptz DEFAULT now()
    );
  `;

  await query(pool, ddl);
  console.log('  Tenant schema created');
}
