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

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Subscription, (sub) => sub.tenant)
  subscriptions: Subscription[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
