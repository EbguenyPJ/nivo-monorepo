import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('cancellation_reasons')
export class CancellationReason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /**
   * Whether this reason should restore stock to available inventory.
   * - true  → returned item goes back to sellable stock (e.g. "Cliente cambió de opinión")
   * - false → item goes to shrinkage/waste, NOT back to stock (e.g. "Defecto de fábrica")
   */
  @Column({ type: 'boolean', default: true })
  affects_inventory: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
