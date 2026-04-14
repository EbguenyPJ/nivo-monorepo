import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { DataSource, LessThan, MoreThan } from 'typeorm';
import {
  CreditAccount, CreditTransaction, Customer, CashTransaction,
} from '@nivo/database';

@Injectable()
export class CreditAccountsService {
  // ═══════════════════════════════════════════════════════════════════
  //  ACCOUNTS — CRUD
  // ═══════════════════════════════════════════════════════════════════

  async findAll(connection: DataSource, filters: {
    status?: 'all' | 'active' | 'overdue';
    page?: number;
    limit?: number;
  }) {
    const repo = connection.getRepository(CreditAccount);
    const qb = repo.createQueryBuilder('ca')
      .leftJoinAndSelect('ca.customer', 'customer')
      .where('ca.is_active = true');

    if (filters.status === 'overdue') {
      // Accounts with charges past due_date
      const txRepo = connection.getRepository(CreditTransaction);
      const overdueAccounts = await txRepo.createQueryBuilder('ct')
        .select('DISTINCT ct.credit_account_id', 'id')
        .where('ct.type = :type', { type: 'charge' })
        .andWhere('ct.due_date < :now', { now: new Date() })
        .getRawMany();
      const ids = overdueAccounts.map((r) => r.id);
      if (ids.length > 0) {
        qb.andWhere('ca.id IN (:...ids)', { ids });
      } else {
        return { items: [], total: 0, page: 1, limit: 20, pages: 0 };
      }
    }

    qb.orderBy('ca.current_balance', 'DESC');

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(CreditAccount);
    const account = await repo.findOne({
      where: { id },
      relations: ['customer'],
    });
    if (!account) throw new NotFoundException('Cuenta de credito no encontrada');
    return account;
  }

  async findByCustomer(connection: DataSource, customerId: string): Promise<CreditAccount | null> {
    return connection.getRepository(CreditAccount).findOne({
      where: { customer_id: customerId },
      relations: ['customer'],
    });
  }

  async createAccount(connection: DataSource, data: {
    customer_id: string;
    credit_limit: number;
    payment_terms?: number;
    notes?: string;
  }) {
    const repo = connection.getRepository(CreditAccount);

    // Check customer exists
    const customer = await connection.getRepository(Customer).findOne({ where: { id: data.customer_id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    // Check no duplicate
    const existing = await repo.findOne({ where: { customer_id: data.customer_id } });
    if (existing) throw new BadRequestException('Este cliente ya tiene una cuenta de credito');

    const account = repo.create({
      customer_id: data.customer_id,
      credit_limit: data.credit_limit,
      payment_terms: data.payment_terms || 30,
      current_balance: 0,
      is_active: true,
      notes: data.notes || null,
    });

    return repo.save(account);
  }

  async updateAccount(connection: DataSource, id: string, data: {
    credit_limit?: number;
    payment_terms?: number;
    notes?: string;
    is_active?: boolean;
  }) {
    const repo = connection.getRepository(CreditAccount);
    const account = await repo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    if (data.credit_limit !== undefined) account.credit_limit = data.credit_limit;
    if (data.payment_terms !== undefined) account.payment_terms = data.payment_terms;
    if (data.notes !== undefined) account.notes = data.notes;
    if (data.is_active !== undefined) account.is_active = data.is_active;

    return repo.save(account);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CHARGE — Sale on credit (increases debt)
  // ═══════════════════════════════════════════════════════════════════

  async charge(connection: DataSource, data: {
    customer_id: string;
    sale_id: string;
    amount: number;
    employee_id: string;
    pos_session_id?: string;
  }) {
    const account = await connection.getRepository(CreditAccount).findOne({
      where: { customer_id: data.customer_id, is_active: true },
    });
    if (!account) throw new NotFoundException('El cliente no tiene una cuenta de credito activa');

    const availableCredit = Number(account.credit_limit) - Number(account.current_balance);
    if (Number(data.amount) > availableCredit) {
      throw new BadRequestException(
        `Credito insuficiente. Disponible: $${availableCredit.toFixed(2)}, Requerido: $${Number(data.amount).toFixed(2)}`,
      );
    }

    return connection.transaction(async (manager) => {
      const accountRepo = manager.getRepository(CreditAccount);
      const newBalance = Number(account.current_balance) + Number(data.amount);
      account.current_balance = newBalance;
      await accountRepo.save(account);

      // Due date based on payment terms
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + account.payment_terms);

      const txRepo = manager.getRepository(CreditTransaction);
      const tx = txRepo.create({
        credit_account_id: account.id,
        type: 'charge',
        amount: data.amount,
        balance_after: newBalance,
        sale_id: data.sale_id,
        due_date: dueDate,
        employee_id: data.employee_id,
        pos_session_id: data.pos_session_id || null,
        reference: `Cargo por venta`,
      });

      return txRepo.save(tx);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  REGISTER PAYMENT — customer pays down their debt
  // ═══════════════════════════════════════════════════════════════════

  async registerPayment(connection: DataSource, data: {
    credit_account_id: string;
    amount: number;
    payment_method: string;
    reference?: string;
    employee_id: string;
    pos_session_id?: string;
  }) {
    const account = await connection.getRepository(CreditAccount).findOne({
      where: { id: data.credit_account_id },
      relations: ['customer'],
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    if (Number(data.amount) <= 0) throw new BadRequestException('El monto debe ser mayor a 0');
    if (Number(data.amount) > Number(account.current_balance)) {
      throw new BadRequestException(`El pago ($${data.amount}) excede el saldo ($${account.current_balance})`);
    }

    return connection.transaction(async (manager) => {
      const accountRepo = manager.getRepository(CreditAccount);
      const newBalance = Number(account.current_balance) - Number(data.amount);
      account.current_balance = newBalance;
      await accountRepo.save(account);

      const txRepo = manager.getRepository(CreditTransaction);
      const tx = txRepo.create({
        credit_account_id: account.id,
        type: 'payment',
        amount: data.amount,
        balance_after: newBalance,
        payment_method: data.payment_method,
        reference: data.reference || null,
        employee_id: data.employee_id,
        pos_session_id: data.pos_session_id || null,
      });
      await txRepo.save(tx);

      // Cash transaction for POS session tracking
      if (data.pos_session_id && data.payment_method === 'cash') {
        const ctRepo = manager.getRepository(CashTransaction);
        await ctRepo.save(ctRepo.create({
          session_id: data.pos_session_id,
          employee_id: data.employee_id,
          type: 'credit_payment',
          amount: data.amount,
          description: `Pago deuda ${(account as any).customer?.name || ''} — ${data.reference || ''}`.trim(),
        }));
      }

      return { account, transaction: tx };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TRANSACTION HISTORY — customer statement
  // ═══════════════════════════════════════════════════════════════════

  async getTransactions(connection: DataSource, creditAccountId: string, page = 1, limit = 20) {
    const repo = connection.getRepository(CreditTransaction);
    const [items, total] = await repo.findAndCount({
      where: { credit_account_id: creditAccountId },
      relations: ['sale', 'employee'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KPIs — Accounts receivable summary
  // ═══════════════════════════════════════════════════════════════════

  async getKpis(connection: DataSource) {
    const accountRepo = connection.getRepository(CreditAccount);
    const txRepo = connection.getRepository(CreditTransaction);

    const accounts = await accountRepo.find({ where: { is_active: true } });
    const totalDebt = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);
    const totalLimit = accounts.reduce((sum, a) => sum + Number(a.credit_limit), 0);

    // Overdue charges
    const now = new Date();
    const overdueCharges = await txRepo.createQueryBuilder('ct')
      .select('SUM(ct.amount)', 'total')
      .addSelect('COUNT(DISTINCT ct.credit_account_id)', 'accounts')
      .where('ct.type = :type', { type: 'charge' })
      .andWhere('ct.due_date < :now', { now })
      .getRawOne();

    // Payments received this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthPayments = await txRepo.createQueryBuilder('ct')
      .select('SUM(ct.amount)', 'total')
      .where('ct.type = :type', { type: 'payment' })
      .andWhere('ct.created_at >= :start', { start: monthStart })
      .getRawOne();

    return {
      total_accounts: accounts.length,
      total_debt: totalDebt,
      total_credit_limit: totalLimit,
      overdue_amount: Number(overdueCharges?.total || 0),
      overdue_accounts: Number(overdueCharges?.accounts || 0),
      payments_this_month: Number(monthPayments?.total || 0),
    };
  }
}
