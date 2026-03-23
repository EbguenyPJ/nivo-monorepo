import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Slug-key: "admin", "manager", "cashier" */
  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  /** Display name: "Administrador", "Gerente de Sucursal", "Cajero" */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Short description of what the role does */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /** Whether this is a system-created role (cannot be deleted) */
  @Column({ type: 'boolean', default: false })
  is_system: boolean;

  @CreateDateColumn()
  created_at: Date;
}
