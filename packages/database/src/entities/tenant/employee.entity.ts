import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Role } from './role.entity';
import { BranchRoleEmployee } from './branch-role-employee.entity';

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

  @Column({ type: 'varchar', nullable: true })
  avatar_url: string | null;

  /** Hashed PIN for fast POS unlock (4-6 digits, unique per tenant) */
  @Column({ type: 'varchar', nullable: true })
  pin_hash: string | null;

  // ─── Legacy role column (kept for backwards compat) ─────────────
  @Column({ type: 'enum', enum: ['admin', 'manager', 'cashier'], default: 'cashier' })
  role: string;

  // ─── Default role (used when not in a specific branch context) ──
  @Column({ type: 'uuid', nullable: true })
  role_id: string | null;

  @ManyToOne(() => Role, { nullable: true, eager: true })
  @JoinColumn({ name: 'role_id' })
  roleEntity: Role | null;

  // ─── Default branch (home branch for this employee) ────────────
  @Column({ type: 'uuid', nullable: true })
  branch_id: string | null;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  /** Owner/Super-Admin of the tenant — cannot be modified or deleted */
  @Column({ type: 'boolean', default: false })
  is_owner: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Multi-branch role assignments */
  @OneToMany(() => BranchRoleEmployee, (bre) => bre.employee, { cascade: true })
  branch_roles: BranchRoleEmployee[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
