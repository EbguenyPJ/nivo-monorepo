import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Expense, ExpenseCategory, CashTransaction, PosSession, TenantSetting,
} from '@nivo/database';

@Injectable()
export class ExpensesService {

  // ═══════════════════════════════════════════════════════════════════
  //  CATEGORIES
  // ═══════════════════════════════════════════════════════════════════

  async listCategories(connection: DataSource) {
    return connection.getRepository(ExpenseCategory).find({
      order: { name: 'ASC' },
    });
  }

  async createCategory(connection: DataSource, data: { name: string }) {
    const repo = connection.getRepository(ExpenseCategory);
    const exists = await repo.findOne({ where: { name: data.name } });
    if (exists) throw new BadRequestException('Ya existe una categoria con ese nombre');
    return repo.save(repo.create({ name: data.name }));
  }

  async updateCategory(connection: DataSource, id: string, data: { name?: string; is_active?: boolean }) {
    const repo = connection.getRepository(ExpenseCategory);
    const cat = await repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Categoria no encontrada');
    if (data.name !== undefined) cat.name = data.name;
    if (data.is_active !== undefined) cat.is_active = data.is_active;
    return repo.save(cat);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EXPENSES — CRUD
  // ═══════════════════════════════════════════════════════════════════

  async listExpenses(connection: DataSource, filters: {
    branch_id?: string;
    category_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const qb = connection.getRepository(Expense).createQueryBuilder('e')
      .leftJoinAndSelect('e.category', 'cat')
      .leftJoinAndSelect('e.employee', 'emp')
      .leftJoinAndSelect('e.branch', 'branch')
      .where('e.is_cancelled = false');

    if (filters.branch_id) qb.andWhere('e.branch_id = :bid', { bid: filters.branch_id });
    if (filters.category_id) qb.andWhere('e.category_id = :cid', { cid: filters.category_id });
    if (filters.start_date) qb.andWhere('e.date >= :start', { start: filters.start_date });
    if (filters.end_date) qb.andWhere('e.date <= :end', { end: filters.end_date });
    if (filters.search) {
      qb.andWhere('LOWER(e.description) LIKE LOWER(:search)', { search: `%${filters.search}%` });
    }

    qb.orderBy('e.date', 'DESC').addOrderBy('e.created_at', 'DESC');

    const total = await qb.getCount();
    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    const records = await qb.getMany();

    return {
      data: records.map((e) => ({
        id: e.id,
        branch_id: e.branch_id,
        branch_name: e.branch?.name || '',
        category_id: e.category_id,
        category_name: e.category?.name || '',
        employee_id: e.employee_id,
        employee_name: e.employee?.name || '',
        amount: e.amount,
        description: e.description,
        payment_source: e.payment_source,
        receipt_url: e.receipt_url,
        date: e.date,
        pos_session_id: e.pos_session_id,
        created_at: e.created_at,
      })),
      total,
    };
  }

  async createExpense(connection: DataSource, data: {
    branch_id: string;
    category_id: string;
    employee_id: string;
    amount: number;
    description: string;
    payment_source: 'cash' | 'bank';
    receipt_url?: string;
    date?: string;
    pos_session_id?: string;
  }) {
    if (data.amount <= 0) throw new BadRequestException('El monto debe ser mayor a 0');

    return connection.transaction(async (manager) => {
      const repo = manager.getRepository(Expense);

      const expense = repo.create({
        branch_id: data.branch_id,
        category_id: data.category_id,
        employee_id: data.employee_id,
        amount: data.amount,
        description: data.description,
        payment_source: data.payment_source || 'bank',
        receipt_url: data.receipt_url || null,
        date: data.date || new Date().toISOString().split('T')[0],
        pos_session_id: data.pos_session_id || null,
      });

      const saved = await manager.save(expense);

      // If paid from POS cash register → create CashTransaction (cash_out) to affect the register
      if (data.payment_source === 'cash' && data.pos_session_id) {
        const session = await manager.findOne(PosSession, {
          where: { id: data.pos_session_id, status: 'open' },
        });

        if (session) {
          const cashTx = manager.create(CashTransaction, {
            session_id: session.id,
            employee_id: data.employee_id,
            type: 'cash_out',
            amount: data.amount,
            description: `Gasto: ${data.description}`,
          });
          await manager.save(cashTx);
        }
      }

      return saved;
    });
  }

  /**
   * POS-specific: create expense from the register with optional expense limit check.
   * If amount exceeds the branch expense limit, requires manager override.
   */
  async createPosExpense(connection: DataSource, data: {
    branch_id: string;
    category_id: string;
    employee_id: string;
    amount: number;
    description: string;
    pos_session_id: string;
  }) {
    if (data.amount <= 0) throw new BadRequestException('El monto debe ser mayor a 0');

    // Check branch expense limit
    const limitSetting = await connection.getRepository(TenantSetting).findOne({
      where: { key: 'pos.expense_limit' },
    });
    const expenseLimit = limitSetting ? parseFloat(limitSetting.value) : 0;

    if (expenseLimit > 0 && data.amount > expenseLimit) {
      throw new BadRequestException(
        `El monto ($${data.amount.toFixed(2)}) excede el limite permitido desde caja ($${expenseLimit.toFixed(2)}). Se requiere autorizacion de gerente.`,
      );
    }

    return this.createExpense(connection, {
      ...data,
      payment_source: 'cash',
    });
  }

  async cancelExpense(connection: DataSource, expenseId: string, data: {
    employee_id: string;
    reason: string;
  }) {
    const repo = connection.getRepository(Expense);
    const expense = await repo.findOne({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Gasto no encontrado');
    if (expense.is_cancelled) throw new BadRequestException('Este gasto ya fue cancelado');

    expense.is_cancelled = true;
    expense.cancellation_note = `Cancelado por ${data.employee_id} — ${data.reason}`;

    return repo.save(expense);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KPIs
  // ═══════════════════════════════════════════════════════════════════

  async getKpis(connection: DataSource, filters: {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const qb = connection.getRepository(Expense).createQueryBuilder('e')
      .leftJoin('e.category', 'cat')
      .where('e.is_cancelled = false');

    if (filters.branch_id) qb.andWhere('e.branch_id = :bid', { bid: filters.branch_id });
    if (filters.start_date) qb.andWhere('e.date >= :start', { start: filters.start_date });
    if (filters.end_date) qb.andWhere('e.date <= :end', { end: filters.end_date });

    // Total
    const totalResult = await qb.clone()
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .getRawOne();

    // Top category
    const topCat = await qb.clone()
      .select('cat.name', 'name')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .groupBy('cat.name')
      .orderBy('SUM(e.amount)', 'DESC')
      .limit(1)
      .getRawOne();

    const totalAmount = parseFloat(totalResult?.total) || 0;
    const topCatTotal = topCat ? parseFloat(topCat.total) || 0 : 0;

    // By category breakdown
    const breakdown = await qb.clone()
      .select('cat.id', 'category_id')
      .addSelect('cat.name', 'category_name')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy('cat.id')
      .addGroupBy('cat.name')
      .orderBy('SUM(e.amount)', 'DESC')
      .getRawMany();

    return {
      total_amount: totalAmount,
      expense_count: parseInt(totalResult?.count) || 0,
      top_category: topCat ? topCat.name : null,
      top_category_pct: totalAmount > 0 ? Math.round((topCatTotal / totalAmount) * 100) : 0,
      breakdown: breakdown.map((r: any) => ({
        category_id: r.category_id,
        category_name: r.category_name,
        total: parseFloat(r.total) || 0,
        count: parseInt(r.count) || 0,
        pct: totalAmount > 0 ? Math.round(((parseFloat(r.total) || 0) / totalAmount) * 100) : 0,
      })),
    };
  }
}
