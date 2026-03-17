import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.subscriptions)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', nullable: true })
  stripe_subscription_id: string | null;

  @Column({ type: 'varchar', length: 50 })
  plan_name: string;

  @Column({ type: 'enum', enum: ['active', 'past_due', 'canceled', 'paused'], default: 'active' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  current_period_end: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
