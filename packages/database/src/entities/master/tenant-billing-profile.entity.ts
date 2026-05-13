import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenant_billing_profiles')
export class TenantBillingProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** One-to-one with tenants.id */
  @Column({ type: 'uuid', unique: true })
  tenant_id: string;

  /** RFC — 12 chars (moral) or 13 chars (física) */
  @Column({ type: 'varchar', length: 13 })
  rfc: string;

  /** Razón social EXACTA tal como aparece en el SAT (CFDI 4.0 strict matching) */
  @Column({ type: 'varchar', length: 255 })
  legal_name: string;

  /** Código postal fiscal */
  @Column({ type: 'varchar', length: 5 })
  zip_code: string;

  /** Clave de régimen fiscal SAT (ej. "601" General de Ley, "612" Act. Empresariales) */
  @Column({ type: 'varchar', length: 10 })
  tax_regime: string;

  /** Uso de CFDI (ej. "G03" Gastos en general, "S01" Sin efectos fiscales) */
  @Column({ type: 'varchar', length: 10, default: 'G03' })
  cfdi_use: string;

  /** If true, a CFDI is auto-generated after every successful Stripe payment */
  @Column({ type: 'boolean', default: false })
  requires_invoice: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
