import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  AccountPayable,
  ProductVariant,
  Product,
  Inventory,
  Branch,
  CashTransaction,
  PosSession,
} from '@nivo/database';

@Injectable()
export class PurchasingService {
  // ═══════════════════════════════════════════════════════════════════
  //  SUPPLIERS — CRUD
  // ═══════════════════════════════════════════════════════════════════

  async findAllSuppliers(connection: DataSource, filters?: { search?: string; active_only?: boolean }) {
    const repo = connection.getRepository(Supplier);
    const qb = repo.createQueryBuilder('s');

    if (filters?.active_only) {
      qb.andWhere('s.is_active = true');
    }
    if (filters?.search) {
      qb.andWhere('(s.name ILIKE :q OR s.tax_id ILIKE :q OR s.contact_name ILIKE :q)', { q: `%${filters.search}%` });
    }

    qb.orderBy('s.name', 'ASC');
    return qb.getMany();
  }

  async findSupplierById(connection: DataSource, id: string) {
    const supplier = await connection.getRepository(Supplier).findOne({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }

  async createSupplier(connection: DataSource, data: Partial<Supplier>) {
    const repo = connection.getRepository(Supplier);
    const supplier = repo.create(data);
    return repo.save(supplier);
  }

  async updateSupplier(connection: DataSource, id: string, data: Partial<Supplier>) {
    const repo = connection.getRepository(Supplier);
    const supplier = await repo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    Object.assign(supplier, data);
    return repo.save(supplier);
  }

  async toggleSupplierStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Supplier);
    const supplier = await repo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    supplier.is_active = !supplier.is_active;
    return repo.save(supplier);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PURCHASE ORDERS — List / Detail
  // ═══════════════════════════════════════════════════════════════════

  async listPurchaseOrders(
    connection: DataSource,
    filters: {
      branch_id?: string;
      supplier_id?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const repo = connection.getRepository(PurchaseOrder);
    const qb = repo.createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.branch', 'branch')
      .leftJoinAndSelect('po.created_by', 'created_by')
      .leftJoinAndSelect('po.items', 'items');

    if (filters.branch_id) qb.andWhere('po.branch_id = :bid', { bid: filters.branch_id });
    if (filters.supplier_id) qb.andWhere('po.supplier_id = :sid', { sid: filters.supplier_id });
    if (filters.status) qb.andWhere('po.status = :status', { status: filters.status });

    qb.orderBy('po.created_at', 'DESC');

    const total = await qb.getCount();
    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    const orders = await qb.getMany();

    return {
      data: orders.map((po) => ({
        id: po.id,
        folio: `OC-${String(po.folio_number).padStart(4, '0')}`,
        supplier_name: po.supplier?.name || '',
        supplier_id: po.supplier_id,
        branch_name: po.branch?.name || '',
        branch_id: po.branch_id,
        status: po.status,
        total_cost: po.total_cost,
        invoice_number: po.invoice_number,
        expected_date: po.expected_date,
        received_at: po.received_at,
        created_by_name: po.created_by?.name || '',
        created_at: po.created_at,
        item_count: po.items?.length || 0,
        total_ordered: po.items?.reduce((sum, i) => sum + i.ordered_quantity, 0) || 0,
      })),
      total,
    };
  }

  async getOrderDetail(connection: DataSource, orderId: string) {
    const po = await connection.getRepository(PurchaseOrder).findOne({
      where: { id: orderId },
      relations: ['supplier', 'branch', 'created_by', 'received_by', 'items'],
    });
    if (!po) throw new NotFoundException('Orden de compra no encontrada');

    const itemsWithDetails = await Promise.all(
      (po.items || []).map(async (item) => {
        const variant = await connection.getRepository(ProductVariant)
          .createQueryBuilder('v')
          .leftJoinAndSelect('v.product', 'product')
          .where('v.id = :id', { id: item.variant_id })
          .getOne();

        const variantImages: string[] = variant?.images || [];
        const productImages: string[] = (variant?.product as any)?.images || [];
        const legacyImage: string | null = (variant?.product as any)?.image_url || null;
        const image_url = variantImages[0] || productImages[0] || legacyImage || null;

        return {
          id: item.id,
          variant_id: item.variant_id,
          ordered_quantity: item.ordered_quantity,
          received_quantity: item.received_quantity,
          unit_cost: item.unit_cost,
          difference: item.received_quantity !== null ? item.received_quantity - item.ordered_quantity : null,
          product_name: variant?.product?.name || '',
          sku: variant?.sku || '',
          barcode: variant?.barcode || null,
          attributes: variant?.attributes || {},
          image_url,
          current_cost: variant?.cost ?? 0,
        };
      }),
    );

    return {
      id: po.id,
      folio: `OC-${String(po.folio_number).padStart(4, '0')}`,
      status: po.status,
      supplier_id: po.supplier_id,
      supplier_name: po.supplier?.name || '',
      supplier_credit_days: po.supplier?.credit_days ?? 0,
      branch_id: po.branch_id,
      branch_name: po.branch?.name || '',
      total_cost: po.total_cost,
      invoice_number: po.invoice_number,
      expected_date: po.expected_date,
      received_at: po.received_at,
      notes: po.notes,
      discrepancy_notes: po.discrepancy_notes,
      created_by_name: po.created_by?.name || '',
      received_by_name: po.received_by?.name || null,
      created_at: po.created_at,
      items: itemsWithDetails,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PURCHASE ORDERS — Create / Confirm / Receive / Cancel
  // ═══════════════════════════════════════════════════════════════════

  async createPurchaseOrder(
    connection: DataSource,
    data: {
      supplier_id: string;
      branch_id: string;
      created_by_id: string;
      invoice_number?: string;
      expected_date?: string;
      notes?: string;
      items: { variant_id: string; ordered_quantity: number; unit_cost: number }[];
    },
  ) {
    if (!data.items?.length) {
      throw new BadRequestException('Debe incluir al menos un artículo');
    }

    const supplier = await connection.getRepository(Supplier).findOne({ where: { id: data.supplier_id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');

    for (const item of data.items) {
      if (item.ordered_quantity <= 0) throw new BadRequestException('La cantidad debe ser mayor a 0');
      if (item.unit_cost < 0) throw new BadRequestException('El costo no puede ser negativo');
    }

    const total_cost = data.items.reduce((sum, i) => sum + i.ordered_quantity * i.unit_cost, 0);

    const savedId = await connection.transaction(async (manager) => {
      const po = manager.create(PurchaseOrder, {
        supplier_id: data.supplier_id,
        branch_id: data.branch_id,
        created_by_id: data.created_by_id,
        invoice_number: data.invoice_number || null,
        expected_date: data.expected_date || null,
        notes: data.notes || null,
        status: 'draft',
        total_cost,
      });
      const saved = await manager.save(po);

      for (const item of data.items) {
        const poItem = manager.create(PurchaseOrderItem, {
          purchase_order_id: saved.id,
          variant_id: item.variant_id,
          ordered_quantity: item.ordered_quantity,
          unit_cost: item.unit_cost,
        });
        await manager.save(poItem);
      }

      return saved.id;
    });

    return this.getOrderDetail(connection, savedId);
  }

  /** Confirm a draft order → ordered (sent to supplier) */
  async confirmOrder(connection: DataSource, orderId: string) {
    const repo = connection.getRepository(PurchaseOrder);
    const po = await repo.findOne({ where: { id: orderId } });
    if (!po) throw new NotFoundException('Orden de compra no encontrada');
    if (po.status !== 'draft') {
      throw new BadRequestException('Solo se pueden confirmar órdenes en borrador');
    }
    po.status = 'ordered';
    await repo.save(po);
    return { id: po.id, status: 'ordered' };
  }

  /**
   * Receive merchandise: apply received quantities, update inventory,
   * update variant cost with weighted average, create account payable if credit.
   */
  async receiveOrder(
    connection: DataSource,
    data: {
      order_id: string;
      received_by_id: string;
      items: { item_id: string; received_quantity: number }[];
    },
  ) {
    const po = await connection.getRepository(PurchaseOrder).findOne({
      where: { id: data.order_id },
      relations: ['supplier', 'items'],
    });
    if (!po) throw new NotFoundException('Orden de compra no encontrada');
    if (po.status !== 'ordered' && po.status !== 'partial') {
      throw new BadRequestException('Solo se pueden recibir órdenes confirmadas o parciales');
    }

    const receivedMap = new Map(data.items.map((i) => [i.item_id, i.received_quantity]));

    return connection.transaction(async (manager) => {
      const discrepancies: string[] = [];
      let anyPartial = false;
      let allReceived = true;

      for (const item of po.items) {
        const recvQty = receivedMap.get(item.id);
        if (recvQty === undefined || recvQty === null) {
          // Item not included in reception — check if previously received
          if (item.received_quantity === null) allReceived = false;
          continue;
        }

        item.received_quantity = (item.received_quantity || 0) + recvQty;
        await manager.save(item);

        if (item.received_quantity < item.ordered_quantity) {
          anyPartial = true;
          allReceived = false;
        }
        if (item.received_quantity !== item.ordered_quantity) {
          discrepancies.push(
            `${item.variant_id}: pedido ${item.ordered_quantity}, recibido ${item.received_quantity}`,
          );
        }

        if (recvQty > 0) {
          // ─── Add to branch inventory ─────────────────────────────
          let inventory = await manager.findOne(Inventory, {
            where: { variant_id: item.variant_id, branch_id: po.branch_id },
          });
          if (!inventory) {
            inventory = manager.create(Inventory, {
              variant_id: item.variant_id,
              branch_id: po.branch_id,
              stock_available: 0,
            });
          }

          const prevStock = inventory.stock_available;
          inventory.stock_available += recvQty;
          await manager.save(inventory);

          // ─── Weighted average cost update on variant ──────────────
          const variant = await manager.findOne(ProductVariant, { where: { id: item.variant_id } });
          if (variant) {
            const oldCost = Number(variant.cost) || 0;
            const newCost = Number(item.unit_cost);
            // Weighted average: (oldCost × prevStock + newCost × received) / totalStock
            const totalStock = prevStock + recvQty;
            if (totalStock > 0) {
              variant.cost = Math.round(((oldCost * prevStock + newCost * recvQty) / totalStock) * 100) / 100;
            } else {
              variant.cost = newCost;
            }
            await manager.save(variant);
          }
        }
      }

      // Check items not in this batch
      for (const item of po.items) {
        if (item.received_quantity === null || item.received_quantity === undefined) {
          allReceived = false;
        } else if (item.received_quantity < item.ordered_quantity) {
          allReceived = false;
          anyPartial = true;
        }
      }

      // Determine final status
      if (allReceived) {
        po.status = discrepancies.length > 0 ? 'received' : 'received';
      } else {
        po.status = 'partial';
      }

      po.received_by_id = data.received_by_id;
      po.received_at = new Date();
      if (discrepancies.length > 0) {
        po.discrepancy_notes = discrepancies.join('\n');
      }

      // Recalculate total_cost based on actual received amounts
      const actualTotal = po.items.reduce((sum, item) => {
        const qty = item.received_quantity ?? item.ordered_quantity;
        return sum + qty * Number(item.unit_cost);
      }, 0);

      await manager.save(po);

      // ─── Create Account Payable if supplier has credit days ────
      if (po.supplier && po.supplier.credit_days > 0 && allReceived) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + po.supplier.credit_days);

        const existing = await manager.findOne(AccountPayable, {
          where: { purchase_order_id: po.id },
        });

        if (!existing) {
          const ap = manager.create(AccountPayable, {
            supplier_id: po.supplier_id,
            purchase_order_id: po.id,
            amount: actualTotal,
            paid_amount: 0,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
          });
          await manager.save(ap);
        }
      }

      return { id: po.id, status: po.status };
    });
  }

  async cancelOrder(connection: DataSource, orderId: string) {
    const repo = connection.getRepository(PurchaseOrder);
    const po = await repo.findOne({ where: { id: orderId } });
    if (!po) throw new NotFoundException('Orden de compra no encontrada');
    if (po.status !== 'draft' && po.status !== 'ordered') {
      throw new BadRequestException('Solo se pueden cancelar órdenes en borrador o confirmadas');
    }
    po.status = 'cancelled';
    await repo.save(po);
    return { id: po.id, status: 'cancelled' };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  VARIANT SEARCH — for order item picker
  // ═══════════════════════════════════════════════════════════════════

  async searchVariantsForOrder(connection: DataSource, search: string) {
    const qb = connection.getRepository(ProductVariant)
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.product', 'p')
      .where('p.is_active = true')
      .andWhere('v.is_active = true')
      .andWhere('p.deleted_at IS NULL');

    if (search) {
      qb.andWhere(
        '(p.name ILIKE :q OR v.sku ILIKE :q OR v.barcode ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    qb.orderBy('p.name', 'ASC').addOrderBy('v.sku', 'ASC').take(30);
    const variants = await qb.getMany();

    return variants.map((v) => {
      const variantImages: string[] = v.images || [];
      const productImages: string[] = (v.product as any)?.images || [];
      const legacyImage: string | null = (v.product as any)?.image_url || null;
      const image_url = variantImages[0] || productImages[0] || legacyImage || null;

      return {
        variant_id: v.id,
        product_name: v.product?.name || '',
        sku: v.sku,
        barcode: v.barcode,
        attributes: v.attributes || {},
        image_url,
        current_cost: Number(v.cost) || 0,
      };
    });
  }

  /** Search variants grouped by product for batch selection (model → sizes grid) */
  async searchProductsForOrder(connection: DataSource, search: string) {
    const qb = connection.getRepository(Product)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variants', 'v')
      .leftJoinAndSelect('p.brand', 'brand')
      .where('p.is_active = true')
      .andWhere('p.deleted_at IS NULL')
      .andWhere('v.is_active = true');

    if (search) {
      qb.andWhere(
        '(p.name ILIKE :q OR v.sku ILIKE :q OR v.barcode ILIKE :q OR brand.name ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    qb.orderBy('p.name', 'ASC').take(20);
    const products = await qb.getMany();

    return products.map((p) => ({
      product_id: p.id,
      product_name: p.name,
      brand_name: p.brand?.name || '',
      image_url: p.images?.[0] || p.image_url || null,
      variants: (p.variants || []).map((v) => ({
        variant_id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        attributes: v.attributes || {},
        current_cost: Number(v.cost) || 0,
        image_url: v.images?.[0] || null,
      })),
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ACCOUNTS PAYABLE
  // ═══════════════════════════════════════════════════════════════════

  async listAccountsPayable(
    connection: DataSource,
    filters: { supplier_id?: string; branch_id?: string; status?: string; search?: string; limit?: number; offset?: number },
  ) {
    const qb = connection.getRepository(AccountPayable)
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.supplier', 'supplier')
      .leftJoinAndSelect('ap.purchase_order', 'po');

    if (filters.supplier_id) qb.andWhere('ap.supplier_id = :sid', { sid: filters.supplier_id });
    if (filters.branch_id) qb.andWhere('po.branch_id = :bid', { bid: filters.branch_id });

    // Search by supplier name
    if (filters.search) {
      qb.andWhere('LOWER(supplier.name) LIKE LOWER(:search)', { search: `%${filters.search}%` });
    }

    // Filter by computed status (overdue = pending + past due)
    if (filters.status === 'overdue') {
      qb.andWhere("ap.status IN ('pending', 'partial')");
      qb.andWhere('ap.due_date < CURRENT_DATE');
    } else if (filters.status === 'pending') {
      qb.andWhere("ap.status = 'pending'");
      qb.andWhere('ap.due_date >= CURRENT_DATE');
    } else if (filters.status && filters.status !== 'all') {
      qb.andWhere('ap.status = :status', { status: filters.status });
    }

    qb.orderBy('ap.due_date', 'ASC');

    const total = await qb.getCount();
    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    const records = await qb.getMany();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      data: records.map((ap) => {
        const dueDate = new Date(ap.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = (ap.status === 'pending' || ap.status === 'partial') && dueDate < today;
        const overdueDays = isOverdue
          ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          id: ap.id,
          supplier_name: ap.supplier?.name || '',
          supplier_id: ap.supplier_id,
          purchase_order_id: ap.purchase_order_id,
          folio: ap.purchase_order ? `OC-${String(ap.purchase_order.folio_number).padStart(4, '0')}` : '',
          amount: ap.amount,
          paid_amount: ap.paid_amount,
          balance: Number(ap.amount) - Number(ap.paid_amount),
          due_date: ap.due_date,
          status: isOverdue ? 'overdue' : ap.status,
          overdue_days: overdueDays,
          received_at: ap.purchase_order?.received_at || null,
          created_at: ap.created_at,
        };
      }),
      total,
    };
  }

  async registerPayment(
    connection: DataSource,
    data: {
      account_id: string;
      amount: number;
      payment_method: 'cash' | 'transfer';
      reference?: string;
      payment_date?: string;
      employee_id: string;
      pos_session_id?: string;
    },
  ) {
    return connection.transaction(async (manager) => {
      const repo = manager.getRepository(AccountPayable);
      const ap = await repo.findOne({
        where: { id: data.account_id },
        relations: ['supplier', 'purchase_order'],
      });
      if (!ap) throw new NotFoundException('Cuenta por pagar no encontrada');

      if (data.amount <= 0) throw new BadRequestException('El monto debe ser mayor a 0');

      const balance = Number(ap.amount) - Number(ap.paid_amount);
      if (data.amount > balance + 0.01) {
        throw new BadRequestException(`El monto excede el saldo pendiente ($${balance.toFixed(2)})`);
      }

      const paymentAmount = Math.min(data.amount, balance);

      // Build payment log entry
      const now = data.payment_date || new Date().toISOString().split('T')[0];
      const methodLabel = data.payment_method === 'cash' ? 'Caja Chica' : 'Transferencia';
      const logEntry = `[${now}] Pago $${paymentAmount.toFixed(2)} — ${methodLabel}${data.reference ? ` — Ref: ${data.reference}` : ''}`;

      ap.paid_amount = Number(ap.paid_amount) + paymentAmount;
      ap.notes = ap.notes ? `${ap.notes}\n${logEntry}` : logEntry;

      const newBalance = Number(ap.amount) - ap.paid_amount;
      ap.status = newBalance <= 0.01 ? 'paid' : 'partial';

      await repo.save(ap);

      // If payment from petty cash → create CashTransaction to affect register
      if (data.payment_method === 'cash' && data.pos_session_id) {
        const session = await manager.findOne(PosSession, {
          where: { id: data.pos_session_id, status: 'open' },
        });

        if (session) {
          const cashTx = manager.create(CashTransaction, {
            session_id: session.id,
            employee_id: data.employee_id,
            type: 'supplier_payment',
            amount: -paymentAmount, // Negative = cash leaving the register
            description: `Pago a ${ap.supplier?.name || 'proveedor'} — ${ap.purchase_order ? `OC-${String(ap.purchase_order.folio_number).padStart(4, '0')}` : ''}${data.reference ? ` — Ref: ${data.reference}` : ''}`,
          });
          await manager.save(cashTx);
        }
      }

      return {
        id: ap.id,
        status: ap.status,
        paid_amount: ap.paid_amount,
        balance: newBalance > 0 ? newBalance : 0,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KPIs
  // ═══════════════════════════════════════════════════════════════════

  async getKpis(connection: DataSource, filters?: { supplier_id?: string; branch_id?: string }) {
    const apRepo = connection.getRepository(AccountPayable);
    const poRepo = connection.getRepository(PurchaseOrder);

    // Total por pagar
    const totalPayableQb = apRepo.createQueryBuilder('ap')
      .innerJoin('ap.purchase_order', 'po')
      .select('COALESCE(SUM(ap.amount - ap.paid_amount), 0)', 'total')
      .where("ap.status IN ('pending', 'partial', 'overdue')");
    if (filters?.supplier_id) totalPayableQb.andWhere('ap.supplier_id = :sid', { sid: filters.supplier_id });
    if (filters?.branch_id) totalPayableQb.andWhere('po.branch_id = :bid', { bid: filters.branch_id });
    const totalPayable = await totalPayableQb.getRawOne();

    // Órdenes atrasadas (overdue accounts)
    const overdueQb = apRepo.createQueryBuilder('ap')
      .innerJoin('ap.purchase_order', 'po')
      .select('COUNT(*)', 'count')
      .where("ap.status IN ('pending', 'partial')")
      .andWhere('ap.due_date < CURRENT_DATE');
    if (filters?.supplier_id) overdueQb.andWhere('ap.supplier_id = :sid', { sid: filters.supplier_id });
    if (filters?.branch_id) overdueQb.andWhere('po.branch_id = :bid', { bid: filters.branch_id });
    const overdue = await overdueQb.getRawOne();

    // Órdenes pendientes de recibir
    const pendingOrdersQb = poRepo.createQueryBuilder('po')
      .select('COUNT(*)', 'count')
      .where("po.status IN ('ordered', 'partial')");
    if (filters?.supplier_id) pendingOrdersQb.andWhere('po.supplier_id = :sid', { sid: filters.supplier_id });
    if (filters?.branch_id) pendingOrdersQb.andWhere('po.branch_id = :bid', { bid: filters.branch_id });
    const pendingOrders = await pendingOrdersQb.getRawOne();

    // Total compras del mes
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthPurchasesQb = poRepo.createQueryBuilder('po')
      .select('COALESCE(SUM(po.total_cost), 0)', 'total')
      .where("po.status IN ('received', 'partial')")
      .andWhere('po.received_at >= :start', { start: monthStart.toISOString() });
    if (filters?.supplier_id) monthPurchasesQb.andWhere('po.supplier_id = :sid', { sid: filters.supplier_id });
    if (filters?.branch_id) monthPurchasesQb.andWhere('po.branch_id = :bid', { bid: filters.branch_id });
    const monthPurchases = await monthPurchasesQb.getRawOne();

    return {
      total_payable: parseFloat(totalPayable?.total || '0'),
      overdue_count: parseInt(overdue?.count || '0'),
      pending_orders: parseInt(pendingOrders?.count || '0'),
      month_purchases: parseFloat(monthPurchases?.total || '0'),
    };
  }
}
