import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CfdiStatus = 'pending' | 'stamped' | 'failed' | 'canceled';

@Entity('billing_invoices')
export class BillingInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  /** Stripe subscription ID */
  @Column({ type: 'varchar', nullable: true })
  stripe_subscription_id: string | null;

  /** Stripe invoice ID (from invoice.payment_succeeded event) */
  @Column({ type: 'varchar', nullable: true, unique: true })
  stripe_invoice_id: string | null;

  /** Total amount charged in MXN (IVA included) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_total: number;

  /** Subtotal before IVA (amount_total / 1.16) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_subtotal: number;

  /** IVA trasladado 16% */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_tax: number;

  /** Human-readable description, e.g. "Suscripción Nivo Plan Pro — Mayo 2026" */
  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  /** Billing period start */
  @Column({ type: 'timestamptz', nullable: true })
  period_start: Date | null;

  /** Billing period end */
  @Column({ type: 'timestamptz', nullable: true })
  period_end: Date | null;

  /** CFDI timbrado status */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  cfdi_status: CfdiStatus;

  /** SAT UUID (folio fiscal) returned after successful stamping */
  @Column({ type: 'varchar', nullable: true })
  sat_uuid: string | null;

  /** URL to the timbrado XML stored in S3 / local storage */
  @Column({ type: 'text', nullable: true })
  xml_url: string | null;

  /** URL to the generated PDF stored in S3 / local storage */
  @Column({ type: 'text', nullable: true })
  pdf_url: string | null;

  /** Raw error message from PAC when cfdi_status = 'failed' */
  @Column({ type: 'text', nullable: true })
  pac_error: string | null;

  /** PAC internal CFDI ID (used to fetch XML/PDF later) */
  @Column({ type: 'varchar', nullable: true })
  pac_cfdi_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
