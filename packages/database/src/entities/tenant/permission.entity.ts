import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Dot-notation key: e.g. "pos.vender", "inventario.traspasar", "reportes.ver" */
  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  /** Human-readable name: e.g. "Vender en Punto de Venta" */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Top-level grouping for UI: e.g. "Punto de Venta", "Inventario", "Reportes" */
  @Column({ type: 'varchar', length: 100 })
  module: string;

  /** Optional sub-grouping for UI: e.g. "Ventas", "Traspasos" */
  @Column({ type: 'varchar', length: 100, nullable: true })
  submodule: string | null;

  /** Display order within module */
  @Column({ type: 'int', default: 0 })
  sort_order: number;
}
