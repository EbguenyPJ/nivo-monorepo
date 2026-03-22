import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Subscription } from './subscription.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  subdomain: string;

  @Column({ type: 'varchar', length: 255 })
  database_name: string;

  @Column({ type: 'varchar', nullable: true })
  logo_url: string | null;

  @Column({ type: 'jsonb', default: {} })
  theme_settings: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  stripe_customer_id: string | null;

  // --- Fiscal data ---
  @Column({ type: 'varchar', length: 20, nullable: true })
  rfc: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  razon_social: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  regimen_fiscal: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  codigo_postal_fiscal: string | null;

  @Column({ type: 'text', nullable: true })
  direccion_fiscal: string | null;

  // --- Manual overrides (null = use plan defaults) ---
  @Column({ type: 'int', nullable: true })
  override_max_branches: number | null;

  @Column({ type: 'int', nullable: true })
  override_max_users: number | null;

  @Column({ type: 'int', nullable: true })
  override_storage_limit_gb: number | null;

  @Column({ type: 'text', nullable: true })
  override_notes: string | null;

  // --- Module overrides (null = use plan default, true/false = force) ---
  @Column({ type: 'boolean', nullable: true })
  override_mod_transfers: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  override_mod_invoicing: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  override_mod_loyalty: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  override_mod_advanced_reports: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  override_mod_ecommerce: boolean | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Subscription, (sub) => sub.tenant)
  subscriptions: Subscription[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
