import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Employee } from './employee.entity';
import { Permission } from './permission.entity';

@Entity('employee_has_permissions')
@Unique(['employee_id', 'permission_id'])
export class EmployeePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'uuid' })
  permission_id: string;

  /** true = grant extra, false = revoke (override role default) */
  @Column({ type: 'boolean', default: true })
  granted: boolean;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
