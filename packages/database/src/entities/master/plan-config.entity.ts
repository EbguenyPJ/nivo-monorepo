import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plan_configs')
export class PlanConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Commercial data ---
  @Column({ type: 'varchar', length: 50, unique: true })
  plan_name: string; // slug: prueba, basico, profesional, corporativo

  @Column({ type: 'varchar', length: 100 })
  display_name: string; // "Plan Básico"

  @Column({ type: 'text', nullable: true })
  description: string; // "Ideal para una sola sucursal que va empezando"

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monthly_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  annual_price: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_price_id_monthly: string | null; // Stripe Price ID for monthly billing

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_price_id_annual: string | null; // Stripe Price ID for annual billing

  @Column({ type: 'boolean', default: true })
  is_active: boolean; // visible for purchase

  @Column({ type: 'int', default: 0 })
  sort_order: number; // display order

  // --- Quantitative limits ---
  @Column({ type: 'int', default: 1 })
  max_branches: number; // Max branches/sucursales (0 = unlimited)

  @Column({ type: 'int', default: 2 })
  max_users: number; // Max POS users/cashiers (0 = unlimited)

  @Column({ type: 'int', default: 0 })
  storage_limit_gb: number; // Max storage in GB (0 = unlimited)

  // --- Feature modules (booleans) ---
  @Column({ type: 'boolean', default: false })
  mod_transfers: boolean; // Inventory transfers between branches

  @Column({ type: 'boolean', default: false })
  mod_invoicing: boolean; // Electronic invoicing (facturación electrónica)

  @Column({ type: 'boolean', default: false })
  mod_loyalty: boolean; // Loyalty program / electronic wallet

  @Column({ type: 'boolean', default: false })
  mod_advanced_reports: boolean; // Advanced reports (forecasts, dead stock, etc.)

  @Column({ type: 'boolean', default: false })
  mod_ecommerce: boolean; // E-commerce integration (Shopify, WooCommerce)

  @Column({ type: 'boolean', default: false })
  mod_custom_branding: boolean; // Custom logo, brand color and theme per tenant

  @Column({ type: 'boolean', default: false })
  mod_mobile: boolean; // Mobile apps (B2B staff + B2C client)

  @Column({ type: 'boolean', default: false })
  mod_nibbit: boolean; // Nibbit AI assistant

  // --- Support ---
  @Column({ type: 'varchar', length: 50, default: 'email' })
  support_level: string; // 'email' | 'chat' | 'dedicated' (legacy / tier label)

  /** Support channel: 'email' | 'chat' | 'phone' */
  @Column({ type: 'varchar', length: 20, default: 'email' })
  support_type: string;

  /** Human-readable schedule, e.g. "Lunes a Viernes 9am–6pm" */
  @Column({ type: 'varchar', length: 255, nullable: true })
  support_hours: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  support_description: string; // "Correo 24-48hrs" | "Chat en vivo" | "Gerente de cuenta asignado"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
