import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Supplier } from './supplier.entity';
import { PurchaseRequisition } from './purchase-requisition.entity';

@Entity('email_drafts')
export class EmailDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  purchase_order_id: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: PurchaseOrder;

  @Column({ type: 'uuid' })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'uuid' })
  requisition_id: string;

  @ManyToOne(() => PurchaseRequisition)
  @JoinColumn({ name: 'requisition_id' })
  requisition: PurchaseRequisition;

  @Column({ type: 'varchar', length: 255 })
  to_email: string;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'text' })
  body_html: string;

  @Column({ type: 'text', nullable: true })
  pdf_url: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: 'pending' | 'sent' | 'failed';

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
