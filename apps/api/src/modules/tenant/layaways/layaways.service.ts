import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  Layaway, LayawayItem, LayawayPayment,
  Customer, Inventory, ProductVariant, CashTransaction,
} from '@nivo/database';

@Injectable()
export class LayawaysService {
  // ═══════════════════════════════════════════════════════════════════
  //  LIST & DETAIL
  // ═══════════════════════════════════════════════════════════════════

  async findAll(connection: DataSource, filters: {
    branch_id?: string;
    status?: string;
    customer_id?: string;
    page?: number;
    limit?: number;
  }) {
    const repo = connection.getRepository(Layaway);
    const qb = repo.createQueryBuilder('l')
      .leftJoinAndSelect('l.customer', 'customer')
      .leftJoinAndSelect('l.branch', 'branch')
      .leftJoinAndSelect('l.employee', 'employee')
      .leftJoinAndSelect('l.items', 'items')
      .leftJoinAndSelect('items.variant', 'variant')
      .leftJoinAndSelect('variant.product', 'product');

    if (filters.branch_id) qb.andWhere('l.branch_id = :bid', { bid: filters.branch_id });
    if (filters.status) qb.andWhere('l.status = :status', { status: filters.status });
    if (filters.customer_id) qb.andWhere('l.customer_id = :cid', { cid: filters.customer_id });

    qb.orderBy('l.created_at', 'DESC');

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Layaway);
    const layaway = await repo.findOne({
      where: { id },
      relations: [
        'customer', 'branch', 'employee',
        'items', 'items.variant', 'items.variant.product',
        'payments', 'payments.employee',
      ],
    });
    if (!layaway) throw new NotFoundException('Apartado no encontrado');
    return layaway;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CREATE LAYAWAY — reserves stock, collects down payment
  // ═══════════════════════════════════════════════════════════════════

  async create(connection: DataSource, data: {
    customer_id: string;
    branch_id: string;
    employee_id: string;
    pos_session_id?: string;
    items: { variant_id: string; quantity: number; unit_price: number; discount?: number }[];
    down_payment: number;
    down_payment_method: string;
    due_days?: number;
    notes?: string;
  }) {
    if (!data.customer_id) throw new BadRequestException('Se requiere un cliente para crear un apartado');
    if (!data.items || data.items.length === 0) throw new BadRequestException('El apartado debe tener al menos un articulo');

    const customerRepo = connection.getRepository(Customer);
    const customer = await customerRepo.findOne({ where: { id: data.customer_id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    // Calculate total
    let totalAmount = 0;
    const layawayItems: Partial<LayawayItem>[] = [];

    for (const item of data.items) {
      const discount = item.discount || 0;
      const subtotal = (item.unit_price * item.quantity) - discount;
      totalAmount += subtotal;
      layawayItems.push({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount,
        subtotal,
      });
    }

    // Validate down payment
    if (Number(data.down_payment) <= 0) {
      throw new BadRequestException('El enganche debe ser mayor a 0');
    }
    if (Number(data.down_payment) > totalAmount) {
      throw new BadRequestException('El enganche no puede ser mayor al total');
    }

    const balanceDue = totalAmount - Number(data.down_payment);
    const dueDays = data.due_days || 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    return connection.transaction(async (manager) => {
      // 1. Reserve stock — deduct from available inventory
      const inventoryRepo = manager.getRepository(Inventory);
      for (const item of data.items) {
        const inv = await inventoryRepo.findOne({
          where: { variant_id: item.variant_id, branch_id: data.branch_id },
        });
        if (!inv || Number(inv.stock_available) < item.quantity) {
          const variant = await manager.getRepository(ProductVariant).findOne({
            where: { id: item.variant_id },
            relations: ['product'],
          });
          throw new BadRequestException(
            `Stock insuficiente para ${variant?.product?.name || 'variante'} (Disponible: ${inv?.stock_available || 0}, Requerido: ${item.quantity})`,
          );
        }
        inv.stock_available = Number(inv.stock_available) - item.quantity;
        await inventoryRepo.save(inv);
      }

      // 2. Create layaway
      const layawayRepo = manager.getRepository(Layaway);
      const layaway = layawayRepo.create({
        customer_id: data.customer_id,
        branch_id: data.branch_id,
        employee_id: data.employee_id,
        total_amount: totalAmount,
        down_payment: data.down_payment,
        balance_due: balanceDue,
        status: balanceDue === 0 ? 'paid_delivered' : 'active',
        due_date: dueDate,
        pos_session_id: data.pos_session_id || null,
        notes: data.notes || null,
      });
      const savedLayaway = await layawayRepo.save(layaway);

      // 3. Create items
      const itemRepo = manager.getRepository(LayawayItem);
      for (const item of layawayItems) {
        await itemRepo.save(itemRepo.create({ ...item, layaway_id: savedLayaway.id }));
      }

      // 4. Register down payment
      const paymentRepo = manager.getRepository(LayawayPayment);
      await paymentRepo.save(paymentRepo.create({
        layaway_id: savedLayaway.id,
        amount: data.down_payment,
        payment_method: data.down_payment_method || 'cash',
        employee_id: data.employee_id,
        pos_session_id: data.pos_session_id || null,
      }));

      // 5. Record in cash transaction if there's a session
      if (data.pos_session_id && data.down_payment_method === 'cash') {
        const ctRepo = manager.getRepository(CashTransaction);
        await ctRepo.save(ctRepo.create({
          session_id: data.pos_session_id,
          employee_id: data.employee_id,
          type: 'layaway_payment',
          amount: data.down_payment,
          description: `Enganche apartado APT-${String(savedLayaway.folio_number).padStart(4, '0')} — ${customer.name}`,
        }));
      }

      return savedLayaway;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MAKE PAYMENT (ABONO) — installment towards a layaway
  // ═══════════════════════════════════════════════════════════════════

  async makePayment(connection: DataSource, data: {
    layaway_id: string;
    amount: number;
    payment_method: string;
    employee_id: string;
    pos_session_id?: string;
    reference?: string;
  }) {
    const layaway = await connection.getRepository(Layaway).findOne({
      where: { id: data.layaway_id },
      relations: ['customer'],
    });
    if (!layaway) throw new NotFoundException('Apartado no encontrado');
    if (layaway.status !== 'active') throw new BadRequestException('Este apartado ya no acepta pagos');

    if (Number(data.amount) <= 0) throw new BadRequestException('El monto debe ser mayor a 0');
    if (Number(data.amount) > Number(layaway.balance_due)) {
      throw new BadRequestException(`El abono ($${data.amount}) excede el saldo pendiente ($${layaway.balance_due})`);
    }

    return connection.transaction(async (manager) => {
      const layawayRepo = manager.getRepository(Layaway);
      const newBalance = Number(layaway.balance_due) - Number(data.amount);

      layaway.balance_due = newBalance;
      if (newBalance <= 0) {
        layaway.status = 'paid_delivered';
      }
      await layawayRepo.save(layaway);

      // Record payment
      const paymentRepo = manager.getRepository(LayawayPayment);
      await paymentRepo.save(paymentRepo.create({
        layaway_id: data.layaway_id,
        amount: data.amount,
        payment_method: data.payment_method,
        employee_id: data.employee_id,
        pos_session_id: data.pos_session_id || null,
        reference: data.reference || null,
      }));

      // Cash transaction for session
      if (data.pos_session_id && data.payment_method === 'cash') {
        const ctRepo = manager.getRepository(CashTransaction);
        await ctRepo.save(ctRepo.create({
          session_id: data.pos_session_id,
          employee_id: data.employee_id,
          type: 'layaway_payment',
          amount: data.amount,
          description: `Abono apartado APT-${String(layaway.folio_number).padStart(4, '0')} — ${(layaway as any).customer?.name || ''}`,
        }));
      }

      return this.findOne(connection, data.layaway_id);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CANCEL LAYAWAY — returns stock, optionally refunds
  // ═══════════════════════════════════════════════════════════════════

  async cancel(connection: DataSource, data: {
    layaway_id: string;
    forfeit: boolean; // true = customer loses payments, false = refund
    employee_id: string;
  }) {
    const layaway = await connection.getRepository(Layaway).findOne({
      where: { id: data.layaway_id },
      relations: ['items'],
    });
    if (!layaway) throw new NotFoundException('Apartado no encontrado');
    if (layaway.status !== 'active') throw new BadRequestException('Solo se pueden cancelar apartados activos');

    return connection.transaction(async (manager) => {
      // Return stock
      const inventoryRepo = manager.getRepository(Inventory);
      for (const item of layaway.items) {
        const inv = await inventoryRepo.findOne({
          where: { variant_id: item.variant_id, branch_id: layaway.branch_id },
        });
        if (inv) {
          inv.stock_available = Number(inv.stock_available) + item.quantity;
          await inventoryRepo.save(inv);
        }
      }

      // Update status
      const layawayRepo = manager.getRepository(Layaway);
      layaway.status = data.forfeit ? 'cancelled_forfeited' : 'cancelled_refunded';
      await layawayRepo.save(layaway);

      return layaway;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KPIs
  // ═══════════════════════════════════════════════════════════════════

  async getKpis(connection: DataSource, branchId?: string) {
    const repo = connection.getRepository(Layaway);

    const baseWhere = branchId ? { branch_id: branchId } : {};

    const activeCount = await repo.count({ where: { ...baseWhere, status: 'active' } });

    const activeLayaways = await repo.find({ where: { ...baseWhere, status: 'active' } });
    const totalPending = activeLayaways.reduce((sum, l) => sum + Number(l.balance_due), 0);
    const totalCollected = activeLayaways.reduce(
      (sum, l) => sum + (Number(l.total_amount) - Number(l.balance_due)),
      0,
    );

    // Overdue
    const now = new Date();
    const overdueCount = activeLayaways.filter((l) => new Date(l.due_date) < now).length;

    // Completed this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedCount = await repo.createQueryBuilder('l')
      .where('l.status = :status', { status: 'paid_delivered' })
      .andWhere('l.updated_at >= :start', { start: monthStart })
      .andWhere(branchId ? 'l.branch_id = :bid' : '1=1', { bid: branchId })
      .getCount();

    return {
      active_count: activeCount,
      total_pending: totalPending,
      total_collected: totalCollected,
      overdue_count: overdueCount,
      completed_this_month: completedCount,
    };
  }
}
