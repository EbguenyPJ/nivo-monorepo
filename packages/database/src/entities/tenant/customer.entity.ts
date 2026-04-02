import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CustomerAddress } from './customer-address.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Structured first name for invoicing (CFDI) — optional */
  @Column({ type: 'varchar', length: 150, nullable: true })
  first_name: string | null;

  /** Structured last name for invoicing (CFDI) — optional */
  @Column({ type: 'varchar', length: 150, nullable: true })
  last_name: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  /** Mexican tax ID (RFC) for invoicing */
  @Index()
  @Column({ type: 'varchar', length: 13, nullable: true })
  rfc: string | null;

  @Column({ type: 'date', nullable: true })
  date_of_birth: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', default: 0 })
  loyalty_points: number;

  /** Future: membership tier (bronze, silver, gold, wholesale, etc.) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  membership_tier: string | null;

  /** Store credit balance (accounts receivable) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  credit_balance: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Segmentation tags (e.g. ["vip", "wholesale"]) */
  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  tags: string[];

  @OneToMany(() => CustomerAddress, (addr) => addr.customer, { cascade: true })
  addresses: CustomerAddress[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;
}
