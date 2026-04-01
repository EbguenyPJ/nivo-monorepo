import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Branch } from './branch.entity';

/**
 * Per-branch override for tenant settings.
 *
 * Cascade logic: BranchSettingOverride.value ?? TenantSetting.value
 *
 * If a branch has an override for a given key, that value is used.
 * Otherwise, the tenant-wide default from tenant_settings is used.
 */
@Entity('branch_setting_overrides')
@Unique(['branch_id', 'key'])
export class BranchSettingOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branch_id: string;

  /** Same key as tenant_settings (dot-notation, e.g. "operacion.default_landed_cost_percentage") */
  @Column({ type: 'varchar', length: 100 })
  key: string;

  /** Override value (stored as string, same as TenantSetting.value) */
  @Column({ type: 'text' })
  value: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
