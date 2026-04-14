import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tenant-wide loyalty program configuration.
 * Only one active config per tenant.
 * Rule example: "Por cada $100 de compra → 1 punto. 1 punto = $1 de descuento."
 */
@Entity('loyalty_configs')
export class LoyaltyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Is the loyalty program enabled? */
  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  /** Amount spent to earn 1 point (e.g. 100 = "por cada $100") */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 100 })
  spend_per_point: number;

  /** Monetary value of 1 point (e.g. 1 = "$1 de descuento") */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  point_value: number;

  /** Minimum points that can be redeemed at once */
  @Column({ type: 'int', default: 1 })
  min_redemption_points: number;

  /** Days until points expire (0 = never expire) */
  @Column({ type: 'int', default: 0 })
  expiration_days: number;

  /** Whether points can be earned on layaway final payment */
  @Column({ type: 'boolean', default: true })
  earn_on_layaway: boolean;

  /** Whether points can be earned on credit account purchases */
  @Column({ type: 'boolean', default: false })
  earn_on_credit: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
