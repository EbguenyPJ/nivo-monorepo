import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Key-value store for tenant-level operational preferences.
 *
 * Examples:
 *   key: "default_landed_cost_percentage"  → value: "5.00"
 *   key: "auto_generate_sku"              → value: "true"
 *   key: "default_tax_id"                 → value: "uuid-here"
 *   key: "ticket_show_logo"               → value: "true"
 */
@Entity('tenant_settings')
@Unique(['key'])
export class TenantSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique setting key (dot-notation suggested for grouping) */
  @Column({ type: 'varchar', length: 100 })
  key: string;

  /** Setting value (stored as string — parsed by frontend/service) */
  @Column({ type: 'text', default: '' })
  value: string;

  /** Human-readable label (optional, for admin UI) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  /** Grouping key for the UI (ej. "operacion", "ticket", "inventario") */
  @Column({ type: 'varchar', length: 50, nullable: true })
  group: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
