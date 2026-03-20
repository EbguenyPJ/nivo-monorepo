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

  @Column({ type: 'varchar', length: 50, unique: true })
  plan_name: string;

  @Column({ type: 'varchar', length: 100 })
  display_name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 0 })
  max_products: number;

  @Column({ type: 'int', default: 0 })
  max_employees: number;

  @Column({ type: 'int', default: 0 })
  max_branches: number;

  @Column({ type: 'int', default: 0 })
  max_support_tickets: number;

  @Column({ type: 'simple-json', nullable: true })
  features: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
