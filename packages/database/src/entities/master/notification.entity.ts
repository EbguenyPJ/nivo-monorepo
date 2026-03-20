import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;
  // Types: 'tenant_registered', 'payment_failed', 'subscription_canceled',
  //        'subscription_upgraded', 'system_alert', 'tenant_suspended'

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tenant_name: string | null;

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}
