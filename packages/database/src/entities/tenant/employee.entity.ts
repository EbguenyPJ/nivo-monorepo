import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Role } from './role.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar' })
  password_hash: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  /** Hashed PIN for fast POS unlock (4-6 digits) */
  @Column({ type: 'varchar', nullable: true })
  pin_hash: string | null;

  // ─── Legacy role column (kept for backwards compat during migration) ───
  @Column({ type: 'enum', enum: ['admin', 'manager', 'cashier'], default: 'cashier' })
  role: string;

  // ─── New RBAC role relation ───
  @Column({ type: 'uuid', nullable: true })
  role_id: string | null;

  @ManyToOne(() => Role, { nullable: true, eager: true })
  @JoinColumn({ name: 'role_id' })
  roleEntity: Role | null;

  // ─── Branch assignment ───
  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
