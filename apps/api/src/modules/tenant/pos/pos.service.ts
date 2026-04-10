import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PosSession, Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem, Inventory, Product, Employee, CashRegister, CashTransaction, CollectionProduct, PaymentMethod, Branch, TenantSetting } from '@nivo/database';
import * as bcrypt from 'bcrypt';
import { CollectionsService } from '../collections/collections.service';
import { PricingService } from '../pricing/pricing.service';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';

@Injectable()
export class PosService {
  constructor(
    private readonly collectionsService: CollectionsService,
    private readonly pricingService: PricingService,
    private readonly tenantSettingsService: TenantSettingsService,
  ) {}

  // ─── POS Catalog (single call for frontend) ──────────────────

  /**
   * Returns everything the POS frontend needs in one call:
   * - collections tree
   * - collection → product_id mapping
   * - all products with variants + stock
   * - variant prices (default price list)
   * - available price lists
   */
  async getPosCatalog(connection: DataSource, branchId: string) {
    const [collections, products, variantPrices, priceLists, collectionProductRows] = await Promise.all([
      this.collectionsService.getTree(connection),
      this.getProductsWithStock(connection, branchId),
      this.pricingService.calculateVariantPrices(connection, branchId),
      this.pricingService.findAllPriceLists(connection),
      connection.getRepository(CollectionProduct).find(),
    ]);

    // Build collection_id → product_id[] map
    const collectionProducts: Record<string, string[]> = {};
    for (const cp of collectionProductRows) {
      if (!collectionProducts[cp.collection_id]) {
        collectionProducts[cp.collection_id] = [];
      }
      collectionProducts[cp.collection_id].push(cp.product_id);
    }

    return {
      collections,
      collection_products: collectionProducts,
      products,
      variant_prices: variantPrices,
      price_lists: priceLists.filter((pl: any) => pl.is_active),
    };
  }

  /**
   * Returns prices for a single variant across ALL active price lists.
   * Used by the discrete price selector popover in the POS ticket.
   */
  async getVariantPricesByAllLists(connection: DataSource, variantId: string, branchId: string) {
    const priceLists = await this.pricingService.findAllPriceLists(connection);
    const activeLists = priceLists.filter((pl: any) => pl.is_active);

    const prices = await Promise.all(
      activeLists.map(async (pl: any) => {
        try {
          const result = await this.pricingService.calculatePrice(connection, variantId, branchId, pl.id);
          return {
            price_list_id: pl.id,
            price_list_name: pl.name,
            price: result.final_price,
            is_default: pl.is_default,
          };
        } catch {
          return null;
        }
      }),
    );

    return { prices: prices.filter(Boolean) };
  }
  // ─── Cash Register management ─────────────────────────────────

  async getCashRegisters(connection: DataSource, branchId: string) {
    const repo = connection.getRepository(CashRegister);
    return repo.find({
      where: { branch_id: branchId, is_active: true },
      order: { name: 'ASC' },
    });
  }

  async createCashRegister(connection: DataSource, data: { branch_id: string; name: string }) {
    const repo = connection.getRepository(CashRegister);
    const register = repo.create({
      branch_id: data.branch_id,
      name: data.name,
      is_active: true,
    });
    return repo.save(register);
  }

  /**
   * Ensure that a branch has at least one cash register.
   * Called lazily when verifying PIN or opening session.
   */
  async ensureDefaultRegister(connection: DataSource, branchId: string): Promise<CashRegister> {
    const repo = connection.getRepository(CashRegister);
    const existing = await repo.findOne({ where: { branch_id: branchId, is_active: true } });
    if (existing) return existing;

    const register = repo.create({
      branch_id: branchId,
      name: 'Caja 1',
      is_active: true,
    });
    return repo.save(register);
  }

  // ─── Session management ────────────────────────────────────────

  async getActiveSession(connection: DataSource, user: any, employeeId?: string, cashRegisterId?: string) {
    const repo = connection.getRepository(PosSession);

    // Priority 1: search by cash_register_id (POS knows which register it's operating)
    if (cashRegisterId) {
      const session = await repo.findOne({
        where: { cash_register_id: cashRegisterId, status: 'open' },
        relations: ['branch', 'cash_register'],
      });
      return session || null;
    }

    // Priority 2: search by explicit employee_id (POS context where PIN user ≠ JWT user)
    if (employeeId) {
      const session = await repo.findOne({
        where: { employee_id: employeeId, status: 'open' },
        relations: ['branch', 'cash_register'],
      });
      return session || null;
    }

    // Fallback: search by JWT user id
    const session = await repo.findOne({
      where: { employee_id: user.sub, status: 'open' },
      relations: ['branch', 'cash_register'],
    });
    return session || null;
  }

  async getActiveSessionByEmployee(connection: DataSource, employeeId: string) {
    const repo = connection.getRepository(PosSession);
    const session = await repo.findOne({
      where: { employee_id: employeeId, status: 'open' },
      relations: ['branch', 'employee', 'cash_register'],
    });
    return session || null;
  }

  async openSession(
    connection: DataSource,
    data: { branch_id: string; opening_amount: number; employee_id: string; cash_register_id: string },
  ) {
    const repo = connection.getRepository(PosSession);

    // Check if this employee already has an open session (anywhere)
    const existingEmployee = await repo.findOne({
      where: { employee_id: data.employee_id, status: 'open' },
      relations: ['cash_register'],
    });
    if (existingEmployee) {
      const regName = existingEmployee.cash_register?.name || 'una caja';
      throw new BadRequestException(`Este empleado ya tiene una sesion abierta en ${regName}`);
    }

    // Check if this cash register already has an open session
    const existingRegister = await repo.findOne({
      where: { cash_register_id: data.cash_register_id, status: 'open' },
      relations: ['employee'],
    });
    if (existingRegister) {
      const opName = existingRegister.employee?.name || 'otro empleado';
      throw new BadRequestException(`Esta caja ya fue abierta por ${opName}`);
    }

    const session = repo.create({
      employee_id: data.employee_id,
      branch_id: data.branch_id,
      cash_register_id: data.cash_register_id,
      opening_amount: data.opening_amount,
      status: 'open',
    });

    const saved = await repo.save(session);
    // Reload with relations
    return repo.findOne({ where: { id: saved.id }, relations: ['branch', 'cash_register'] });
  }

  /**
   * Switch the operator of an open cash register session.
   * The session stays open (same opening_amount, same id) — only employee_id changes.
   * This is a quick handoff, NOT a close+reopen.
   */
  async switchCashier(
    connection: DataSource,
    data: {
      session_id: string;
      new_employee_id: string;
    },
  ) {
    const repo = connection.getRepository(PosSession);

    const session = await repo.findOne({
      where: { id: data.session_id, status: 'open' },
      relations: ['branch', 'cash_register'],
    });
    if (!session) throw new NotFoundException('Sesion de caja no encontrada');

    // Just update the operator
    session.employee_id = data.new_employee_id;
    await repo.save(session);

    return repo.findOne({
      where: { id: session.id },
      relations: ['branch', 'cash_register'],
    });
  }

  /**
   * Corte Z — Definitive close. Performs blind close with declared amount,
   * calculates expected cash, difference, and locks the session.
   */
  async closeSession(
    connection: DataSource,
    data: {
      session_id: string;
      declared_amount: number;
      closed_by?: string; // employee_id of who is forcing the close (manager override)
    },
  ) {
    const repo = connection.getRepository(PosSession);
    const session = await repo.findOne({
      where: { id: data.session_id, status: 'open' },
      relations: ['cash_register'],
    });
    if (!session) throw new NotFoundException('Sesion de caja no encontrada');

    // Calculate expected cash amount
    const expectedAmount = await this.calculateExpectedCash(connection, session.id);

    session.closing_amount = data.declared_amount;
    session.expected_amount = expectedAmount;
    session.difference = parseFloat((data.declared_amount - expectedAmount).toFixed(2));
    session.status = 'closed';
    session.closed_at = new Date();
    if (data.closed_by) {
      session.closed_by = data.closed_by;
    }

    const saved = await repo.save(session);

    // Build the close summary
    const summary = await this.getSessionSummary(connection, session.id);

    return {
      session: saved,
      summary,
    };
  }

  /**
   * Force-close an orphan session (manager permission required).
   * Marks the session as closed with the manager who forced it.
   */
  async forceCloseSession(
    connection: DataSource,
    data: { session_id: string; manager_employee_id: string },
  ) {
    const repo = connection.getRepository(PosSession);
    const session = await repo.findOne({
      where: { id: data.session_id, status: 'open' },
    });
    if (!session) throw new NotFoundException('Sesion de caja no encontrada');

    const expectedAmount = await this.calculateExpectedCash(connection, session.id);

    session.closing_amount = 0; // Not counted — forced close
    session.expected_amount = expectedAmount;
    session.difference = parseFloat((0 - expectedAmount).toFixed(2));
    session.status = 'closed';
    session.closed_at = new Date();
    session.closed_by = data.manager_employee_id;

    return repo.save(session);
  }

  // ─── Cash Operations (Entries / Withdrawals / Audits) ──────────

  /**
   * Calculate expected cash in the register for a given session.
   * Formula: opening_amount + sale_cash - refunds + cash_in - cash_out
   */
  async calculateExpectedCash(connection: DataSource, sessionId: string): Promise<number> {
    const session = await connection.getRepository(PosSession).findOne({
      where: { id: sessionId },
    });
    if (!session) return 0;

    const txRepo = connection.getRepository(CashTransaction);
    const transactions = await txRepo.find({ where: { session_id: sessionId } });

    let expected = parseFloat(String(session.opening_amount)) || 0;
    for (const tx of transactions) {
      const amt = parseFloat(String(tx.amount)) || 0;
      switch (tx.type) {
        case 'sale_cash':
        case 'cash_in':
          expected += amt;
          break;
        case 'refund':
        case 'cash_out':
          expected -= amt;
          break;
        // 'audit' doesn't affect balance
      }
    }

    return parseFloat(expected.toFixed(2));
  }

  /**
   * Record a cash entry (extra change fund, etc.)
   */
  async addCashIn(
    connection: DataSource,
    data: { session_id: string; employee_id: string; amount: number; description?: string },
  ) {
    const session = await connection.getRepository(PosSession).findOne({
      where: { id: data.session_id, status: 'open' },
    });
    if (!session) throw new NotFoundException('Sesion de caja no encontrada');

    const tx = connection.getRepository(CashTransaction).create({
      session_id: data.session_id,
      employee_id: data.employee_id,
      type: 'cash_in',
      amount: data.amount,
      description: data.description || 'Entrada de efectivo',
    });
    return connection.getRepository(CashTransaction).save(tx);
  }

  /**
   * Record a cash withdrawal (sangria / security withdrawal).
   */
  async addCashOut(
    connection: DataSource,
    data: { session_id: string; employee_id: string; amount: number; description?: string },
  ) {
    const session = await connection.getRepository(PosSession).findOne({
      where: { id: data.session_id, status: 'open' },
    });
    if (!session) throw new NotFoundException('Sesion de caja no encontrada');

    // Validate there's enough cash
    const expected = await this.calculateExpectedCash(connection, data.session_id);
    if (data.amount > expected) {
      throw new BadRequestException(
        `No se puede retirar $${data.amount.toFixed(2)}. Efectivo esperado en caja: $${expected.toFixed(2)}`,
      );
    }

    const tx = connection.getRepository(CashTransaction).create({
      session_id: data.session_id,
      employee_id: data.employee_id,
      type: 'cash_out',
      amount: data.amount,
      description: data.description || 'Retiro de valores',
    });
    return connection.getRepository(CashTransaction).save(tx);
  }

  /**
   * Corte X — Blind audit. Records the declared amount without closing the session.
   */
  async performAudit(
    connection: DataSource,
    data: { session_id: string; employee_id: string; declared_amount: number },
  ) {
    const session = await connection.getRepository(PosSession).findOne({
      where: { id: data.session_id, status: 'open' },
    });
    if (!session) throw new NotFoundException('Sesion de caja no encontrada');

    const expectedAmount = await this.calculateExpectedCash(connection, data.session_id);
    const difference = parseFloat((data.declared_amount - expectedAmount).toFixed(2));

    const tx = connection.getRepository(CashTransaction).create({
      session_id: data.session_id,
      employee_id: data.employee_id,
      type: 'audit',
      amount: 0,
      description: 'Arqueo de caja (Corte X)',
      declared_amount: data.declared_amount,
      expected_amount: expectedAmount,
      difference,
    });

    const saved = await connection.getRepository(CashTransaction).save(tx);

    return {
      ...saved,
      expected_amount: expectedAmount,
      declared_amount: data.declared_amount,
      difference,
    };
  }

  /**
   * Get the full financial summary for a session (used in Corte Z reveal).
   */
  async getSessionSummary(connection: DataSource, sessionId: string) {
    const session = await connection.getRepository(PosSession).findOne({
      where: { id: sessionId },
      relations: ['employee', 'cash_register'],
    });
    if (!session) throw new NotFoundException('Sesion no encontrada');

    const transactions = await connection.getRepository(CashTransaction).find({
      where: { session_id: sessionId },
      order: { created_at: 'ASC' },
    });

    // Get sales for this session with their payments
    const sales = await connection.getRepository(Sale).find({
      where: { pos_session_id: sessionId, status: 'completed' },
    });

    const salePayments = await connection.getRepository(SalePayment)
      .createQueryBuilder('sp')
      .where('sp.sale_id IN (:...saleIds)', {
        saleIds: sales.length > 0 ? sales.map((s) => s.id) : ['00000000-0000-0000-0000-000000000000'],
      })
      .getMany();

    // Aggregate by payment method
    const paymentSummary: Record<string, { method: string; total: number; count: number }> = {};
    for (const sp of salePayments) {
      const key = sp.payment_method_name;
      if (!paymentSummary[key]) {
        paymentSummary[key] = { method: key, total: 0, count: 0 };
      }
      paymentSummary[key].total += parseFloat(String(sp.amount));
      paymentSummary[key].count++;
    }

    // Cash-specific totals
    let totalCashSales = 0;
    let totalCashIn = 0;
    let totalCashOut = 0;
    let totalRefunds = 0;
    const audits: any[] = [];

    for (const tx of transactions) {
      const amt = parseFloat(String(tx.amount)) || 0;
      switch (tx.type) {
        case 'sale_cash':
          totalCashSales += amt;
          break;
        case 'cash_in':
          totalCashIn += amt;
          break;
        case 'cash_out':
          totalCashOut += amt;
          break;
        case 'refund':
          totalRefunds += amt;
          break;
        case 'audit':
          audits.push({
            declared: parseFloat(String(tx.declared_amount)) || 0,
            expected: parseFloat(String(tx.expected_amount)) || 0,
            difference: parseFloat(String(tx.difference)) || 0,
            time: tx.created_at,
          });
          break;
      }
    }

    const openingAmount = parseFloat(String(session.opening_amount)) || 0;
    const expectedCash = parseFloat(
      (openingAmount + totalCashSales - totalRefunds + totalCashIn - totalCashOut).toFixed(2),
    );

    return {
      session_id: sessionId,
      employee_name: session.employee?.name || '',
      cash_register_name: session.cash_register?.name || '',
      opened_at: session.opened_at,
      closed_at: session.closed_at,
      status: session.status,
      // Cash flow
      opening_amount: openingAmount,
      total_cash_sales: parseFloat(totalCashSales.toFixed(2)),
      total_cash_in: parseFloat(totalCashIn.toFixed(2)),
      total_cash_out: parseFloat(totalCashOut.toFixed(2)),
      total_refunds: parseFloat(totalRefunds.toFixed(2)),
      expected_cash: expectedCash,
      declared_amount: session.closing_amount != null ? parseFloat(String(session.closing_amount)) : null,
      difference: session.difference != null ? parseFloat(String(session.difference)) : null,
      // Other payment methods
      payment_methods: Object.values(paymentSummary),
      // Total sales
      total_sales_count: sales.length,
      total_sales_amount: parseFloat(
        sales.reduce((sum, s) => sum + parseFloat(String(s.total_amount)), 0).toFixed(2),
      ),
      // Audits performed during this session
      audits,
      // Raw transactions for detailed view
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(String(tx.amount)),
        description: tx.description,
        created_at: tx.created_at,
      })),
    };
  }

  /**
   * Get transactions list for the active session.
   */
  async getSessionTransactions(connection: DataSource, sessionId: string) {
    return connection.getRepository(CashTransaction).find({
      where: { session_id: sessionId },
      relations: ['employee'],
      order: { created_at: 'DESC' },
    });
  }

  // ─── Audit Dashboard ──────────────────────────────────────────

  /**
   * Returns a paginated, filterable list of POS sessions with aggregated
   * financial data for the audit dashboard.
   */
  async getSessionsAudit(
    connection: DataSource,
    filters: {
      branch_id?: string;
      employee_id?: string;
      status?: string; // 'open' | 'closed' | 'all'
      only_differences?: boolean;
      start_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const repo = connection.getRepository(PosSession);

    const qb = repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.employee', 'employee')
      .leftJoinAndSelect('s.branch', 'branch')
      .leftJoinAndSelect('s.cash_register', 'cash_register')
      .leftJoinAndSelect('s.closer', 'closer');

    // Filters
    if (filters.branch_id) {
      qb.andWhere('s.branch_id = :branchId', { branchId: filters.branch_id });
    }
    if (filters.employee_id) {
      qb.andWhere('s.employee_id = :employeeId', { employeeId: filters.employee_id });
    }
    if (filters.status && filters.status !== 'all') {
      qb.andWhere('s.status = :status', { status: filters.status });
    }
    if (filters.only_differences) {
      qb.andWhere('s.difference IS NOT NULL AND s.difference != 0');
    }
    if (filters.start_date) {
      qb.andWhere('s.opened_at >= :startDate', { startDate: filters.start_date });
    }
    if (filters.end_date) {
      qb.andWhere('s.opened_at <= :endDate', { endDate: filters.end_date });
    }

    qb.orderBy('s.opened_at', 'DESC');

    const total = await qb.getCount();
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    const sessions = await qb.skip(offset).take(limit).getMany();

    // For each session, compute aggregated data from CashTransactions + SalePayments
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const transactions = await connection.getRepository(CashTransaction).find({
          where: { session_id: session.id },
        });

        let totalCashSales = 0;
        let totalCashIn = 0;
        let totalCashOut = 0;
        let totalRefunds = 0;

        for (const tx of transactions) {
          const amt = parseFloat(String(tx.amount)) || 0;
          switch (tx.type) {
            case 'sale_cash': totalCashSales += amt; break;
            case 'cash_in': totalCashIn += amt; break;
            case 'cash_out': totalCashOut += amt; break;
            case 'refund': totalRefunds += amt; break;
          }
        }

        // Count sales and total revenue (all payment methods)
        const sales = await connection.getRepository(Sale).find({
          where: { pos_session_id: session.id, status: 'completed' },
        });
        const totalSalesAmount = sales.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);

        // Card/other payments total
        const salePayments = sales.length > 0
          ? await connection.getRepository(SalePayment)
              .createQueryBuilder('sp')
              .where('sp.sale_id IN (:...saleIds)', { saleIds: sales.map((s) => s.id) })
              .getMany()
          : [];

        let cardTotal = 0;
        for (const sp of salePayments) {
          if (!sp.payment_method_name?.toLowerCase().includes('efectivo')) {
            cardTotal += parseFloat(String(sp.amount)) || 0;
          }
        }

        const openingAmount = parseFloat(String(session.opening_amount)) || 0;

        return {
          id: session.id,
          status: session.status,
          opened_at: session.opened_at,
          closed_at: session.closed_at,
          // Relations
          employee_name: session.employee?.name || '',
          employee_id: session.employee_id,
          branch_name: session.branch?.name || '',
          branch_id: session.branch_id,
          cash_register_name: session.cash_register?.name || '',
          cash_register_id: session.cash_register_id,
          closed_by_name: session.closer?.name || null,
          // Financial
          opening_amount: openingAmount,
          closing_amount: session.closing_amount != null ? parseFloat(String(session.closing_amount)) : null,
          expected_amount: session.expected_amount != null ? parseFloat(String(session.expected_amount)) : null,
          difference: session.difference != null ? parseFloat(String(session.difference)) : null,
          // Aggregates
          total_cash_sales: parseFloat(totalCashSales.toFixed(2)),
          total_cash_in: parseFloat(totalCashIn.toFixed(2)),
          total_cash_out: parseFloat(totalCashOut.toFixed(2)),
          total_refunds: parseFloat(totalRefunds.toFixed(2)),
          total_sales_count: sales.length,
          total_sales_amount: parseFloat(totalSalesAmount.toFixed(2)),
          total_card_payments: parseFloat(cardTotal.toFixed(2)),
        };
      }),
    );

    // Compute KPIs across the full filtered set (not just the page)
    // Re-query all matching session IDs for KPIs
    const allSessionIds = await qb.select('s.id').skip(0).take(undefined).getRawMany();
    const allIds = allSessionIds.map((r: any) => r.s_id);

    let kpis = {
      total_revenue: 0,
      total_cash_expected: 0,
      total_card_payments: 0,
      sessions_with_difference: 0,
      total_sessions: total,
      total_difference_abs: 0,
    };

    if (allIds.length > 0) {
      // Total revenue from all sessions in filter
      const revenueResult = await connection.getRepository(Sale)
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'total')
        .where('sale.pos_session_id IN (:...ids)', { ids: allIds })
        .andWhere('sale.status = :status', { status: 'completed' })
        .getRawOne();
      kpis.total_revenue = parseFloat(revenueResult?.total) || 0;

      // Expected cash & differences from closed sessions
      const closedSessions = await repo
        .createQueryBuilder('s2')
        .select([
          'COALESCE(SUM(s2.expected_amount), 0) as total_expected',
          'SUM(CASE WHEN s2.difference != 0 THEN 1 ELSE 0 END) as diff_count',
          'COALESCE(SUM(ABS(s2.difference)), 0) as diff_abs_sum',
        ])
        .where('s2.id IN (:...ids)', { ids: allIds })
        .andWhere('s2.status = :status', { status: 'closed' })
        .getRawOne();

      kpis.total_cash_expected = parseFloat(closedSessions?.total_expected) || 0;
      kpis.sessions_with_difference = parseInt(closedSessions?.diff_count) || 0;
      kpis.total_difference_abs = parseFloat(closedSessions?.diff_abs_sum) || 0;

      // Card payments
      const cardResult = await connection.getRepository(SalePayment)
        .createQueryBuilder('sp')
        .innerJoin('sp.sale', 'sale')
        .select('COALESCE(SUM(sp.amount), 0)', 'total')
        .where('sale.pos_session_id IN (:...ids)', { ids: allIds })
        .andWhere('sale.status = :status', { status: 'completed' })
        .andWhere("LOWER(sp.payment_method_name) NOT LIKE '%efectivo%'")
        .getRawOne();
      kpis.total_card_payments = parseFloat(cardResult?.total) || 0;
    }

    return {
      data: enriched,
      total,
      kpis,
    };
  }

  /**
   * Get all cash_out transactions that haven't been marked as deposited.
   * Used by the vault management feature.
   */
  async getVaultWithdrawals(
    connection: DataSource,
    filters: {
      branch_id?: string;
      start_date?: string;
      end_date?: string;
    },
  ) {
    const qb = connection.getRepository(CashTransaction)
      .createQueryBuilder('tx')
      .innerJoinAndSelect('tx.session', 'session')
      .innerJoinAndSelect('tx.employee', 'employee')
      .leftJoinAndSelect('session.branch', 'branch')
      .leftJoinAndSelect('session.cash_register', 'cash_register')
      .where('tx.type = :type', { type: 'cash_out' });

    if (filters.branch_id) {
      qb.andWhere('session.branch_id = :branchId', { branchId: filters.branch_id });
    }
    if (filters.start_date) {
      qb.andWhere('tx.created_at >= :startDate', { startDate: filters.start_date });
    }
    if (filters.end_date) {
      qb.andWhere('tx.created_at <= :endDate', { endDate: filters.end_date });
    }

    qb.orderBy('tx.created_at', 'DESC');

    const withdrawals = await qb.getMany();

    return withdrawals.map((tx) => ({
      id: tx.id,
      session_id: tx.session_id,
      employee_name: tx.employee?.name || '',
      branch_name: tx.session?.branch?.name || '',
      cash_register_name: tx.session?.cash_register?.name || '',
      amount: parseFloat(String(tx.amount)) || 0,
      description: tx.description,
      created_at: tx.created_at,
    }));
  }

  // ─── PIN verification ──────────────────────────────────────────

  async verifyPin(connection: DataSource, pinCode: string, branchId: string) {
    const employeeRepo = connection.getRepository(Employee);

    // Load active employees in branch with PIN configured
    const employees = await employeeRepo
      .createQueryBuilder('e')
      .where('e.branch_id = :branchId', { branchId })
      .andWhere('e.is_active = true')
      .andWhere('e.pin_hash IS NOT NULL')
      .getMany();

    if (employees.length === 0) {
      throw new UnauthorizedException('No hay empleados con PIN configurado en esta sucursal');
    }

    // Compare PIN against each hash
    for (const emp of employees) {
      const isMatch = await bcrypt.compare(pinCode, emp.pin_hash!);
      if (isMatch) {
        // Ensure branch has at least one cash register
        await this.ensureDefaultRegister(connection, branchId);

        // Get cash registers for this branch
        const cashRegisters = await this.getCashRegisters(connection, branchId);

        // Check for active session by THIS employee (on any register)
        const ownSession = await this.getActiveSessionByEmployee(connection, emp.id);

        // Get all open sessions on registers of this branch
        const sessionRepo = connection.getRepository(PosSession);
        const registerSessions = await sessionRepo.find({
          where: { branch_id: branchId, status: 'open' },
          relations: ['employee', 'cash_register'],
        });

        return {
          employee: {
            id: emp.id,
            name: emp.name,
            role: emp.role,
          },
          has_active_session: !!ownSession,
          session: ownSession,
          cash_registers: cashRegisters.map((cr) => ({
            id: cr.id,
            name: cr.name,
          })),
          register_sessions: registerSessions.map((rs) => ({
            cash_register_id: rs.cash_register_id,
            cash_register_name: rs.cash_register?.name || 'Caja',
            employee_id: rs.employee_id,
            employee_name: rs.employee?.name || 'Desconocido',
            session_id: rs.id,
            opened_at: rs.opened_at,
            opening_amount: rs.opening_amount,
          })),
        };
      }
    }

    throw new UnauthorizedException('PIN invalido');
  }

  // ─── Products ──────────────────────────────────────────────────

  async getProductsWithStock(connection: DataSource, branchId: string) {
    const products = await connection.getRepository(Product)
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.deleted_at IS NULL')
      .getMany();

    // Fetch inventory for this branch
    const inventoryRows = await connection.getRepository(Inventory)
      .createQueryBuilder('inv')
      .where('inv.branch_id = :branchId', { branchId })
      .getMany();

    const stockMap = new Map<string, number>();
    for (const inv of inventoryRows) {
      stockMap.set(inv.variant_id, inv.stock_available);
    }

    // Attach stock to each variant
    return products.map((p) => ({
      ...p,
      variants: (p.variants || []).map((v: any) => ({
        ...v,
        stock_available: stockMap.get(v.id) ?? 0,
      })),
    }));
  }

  // ─── Ticket Config ─────────────────────────────────────────────

  /**
   * Returns branch info + ticket-related tenant settings for receipt printing.
   */
  async getTicketConfig(connection: DataSource, branchId: string) {
    const [branch, settings] = await Promise.all([
      connection.getRepository(Branch).findOne({ where: { id: branchId } }),
      this.tenantSettingsService.findAll(connection, 'ticket'),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return {
      branch: branch
        ? {
            name: branch.name,
            address: branch.address,
            city: branch.city,
            zip_code: branch.zip_code,
            phone: branch.phone,
            ticket_footer: branch.ticket_footer,
          }
        : null,
      settings: {
        auto_print_receipt: settingsMap['ticket.auto_print_receipt'] === 'true',
        show_logo: settingsMap['ticket.show_logo'] !== 'false',
        show_branch_address: settingsMap['ticket.show_branch_address'] !== 'false',
        business_name: settingsMap['ticket.business_name'] || '',
        rfc: settingsMap['ticket.rfc'] || '',
        footer_message: settingsMap['ticket.footer_message'] || 'Gracias por tu compra!',
      },
    };
  }

  // ─── Payment Methods ────────────────────────────────────────────

  async getPaymentMethods(connection: DataSource) {
    return connection.getRepository(PaymentMethod).find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  // ─── Sales ─────────────────────────────────────────────────────

  async createSale(connection: DataSource, user: any, data: any) {
    return connection.transaction(async (manager) => {
      // Validate stock before processing
      for (const item of data.items) {
        const inventory = await manager.findOne(Inventory, {
          where: { variant_id: item.variant_id, branch_id: data.branch_id },
        });
        const available = inventory?.stock_available ?? 0;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para variante ${item.variant_id}. Disponible: ${available}, solicitado: ${item.quantity}`,
          );
        }
      }

      // Determine payment_method enum from payments array
      let paymentMethodEnum = data.payment_method || 'cash';
      if (data.payments && data.payments.length > 0) {
        const hasCash = data.payments.some((p: any) => p.payment_method_name?.toLowerCase().includes('efectivo'));
        const hasNonCash = data.payments.some((p: any) => !p.payment_method_name?.toLowerCase().includes('efectivo'));
        if (data.payments.length === 1) {
          paymentMethodEnum = hasCash ? 'cash' : 'card';
        } else {
          paymentMethodEnum = 'mixed';
        }
      }

      const sale = manager.create(Sale, {
        id: data.id,
        pos_session_id: data.pos_session_id,
        customer_id: data.customer_id || null,
        employee_id: user.sub,
        branch_id: data.branch_id,
        total_amount: data.total_amount || 0,
        discount_amount: data.discount_amount || 0,
        tax_amount: data.tax_amount || 0,
        payment_method: paymentMethodEnum,
        sale_type: data.sale_type || 'in_store',
        status: 'completed',
        notes: data.notes,
      });

      const savedSale = await manager.save(sale);

      // Create sale items and compute total
      let total = 0;
      for (const item of data.items) {
        const subtotal = item.quantity * item.unit_price - (item.discount || 0);
        total += subtotal;

        const saleItem = manager.create(SaleItem, {
          sale_id: savedSale.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount || 0,
          subtotal,
        });
        await manager.save(saleItem);

        // Deduct inventory
        const inventory = await manager.findOne(Inventory, {
          where: { variant_id: item.variant_id, branch_id: data.branch_id },
        });
        if (inventory) {
          inventory.stock_available = Math.max(0, inventory.stock_available - item.quantity);
          await manager.save(inventory);
        }
      }

      savedSale.total_amount = total - (data.discount_amount || 0);
      await manager.save(savedSale);

      // Create payment records (split payments)
      let cashAmount = 0;
      if (data.payments && data.payments.length > 0) {
        for (const payment of data.payments) {
          const salePayment = manager.create(SalePayment, {
            sale_id: savedSale.id,
            payment_method_id: payment.payment_method_id,
            payment_method_name: payment.payment_method_name,
            amount: payment.amount,
            reference: payment.reference || null,
          });
          await manager.save(salePayment);

          // Track cash portion for CashTransaction
          if (payment.payment_method_name?.toLowerCase().includes('efectivo')) {
            cashAmount += parseFloat(String(payment.amount)) || 0;
          }
        }
      } else if (paymentMethodEnum === 'cash') {
        cashAmount = savedSale.total_amount;
      }

      // Auto-create CashTransaction for cash portion of the sale
      if (cashAmount > 0 && data.pos_session_id) {
        const cashTx = manager.create(CashTransaction, {
          session_id: data.pos_session_id,
          employee_id: user.sub,
          type: 'sale_cash',
          amount: cashAmount,
          description: `Venta ${savedSale.id.slice(0, 8).toUpperCase()}`,
        });
        await manager.save(cashTx);
      }

      return savedSale;
    });
  }

  // ─── Sales History ─────────────────────────────────────────────

  /**
   * Paginated, filterable list of sales for the dashboard history view.
   * Supports search by folio (first 8 chars of UUID).
   */
  async getSalesHistory(
    connection: DataSource,
    filters: {
      search?: string;
      branch_id?: string;
      customer_id?: string;
      status?: string;
      start_date?: string;
      end_date?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const qb = connection.getRepository(Sale)
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.employee', 'employee')
      .leftJoinAndSelect('s.branch', 'branch')
      .leftJoinAndSelect('s.customer', 'customer')
      .where('s.status != :pending', { pending: 'pending' });

    if (filters.search) {
      // Search by folio (UUID starts-with, case-insensitive)
      qb.andWhere('CAST(s.id AS text) ILIKE :search', { search: `${filters.search}%` });
    }
    if (filters.branch_id) {
      qb.andWhere('s.branch_id = :branchId', { branchId: filters.branch_id });
    }
    if (filters.customer_id) {
      qb.andWhere('s.customer_id = :customerId', { customerId: filters.customer_id });
    }
    if (filters.status && filters.status !== 'all') {
      qb.andWhere('s.status = :status', { status: filters.status });
    }
    if (filters.start_date) {
      qb.andWhere('s.created_at >= :startDate', { startDate: filters.start_date });
    }
    if (filters.end_date) {
      qb.andWhere('s.created_at <= :endDate', { endDate: filters.end_date });
    }

    qb.orderBy('s.created_at', 'DESC');

    const total = await qb.getCount();
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const data = await qb.skip(offset).take(limit).getMany();

    return {
      data: data.map((s) => ({
        id: s.id,
        folio: s.id.slice(0, 8).toUpperCase(),
        status: s.status,
        total_amount: parseFloat(String(s.total_amount)),
        discount_amount: parseFloat(String(s.discount_amount)),
        payment_method: s.payment_method,
        created_at: s.created_at,
        employee_name: s.employee?.name || '',
        branch_name: s.branch?.name || '',
        customer_name: s.customer?.name || null,
      })),
      total,
    };
  }

  /**
   * Full sale detail with items (including variant info), payments, and returns.
   */
  async getSaleDetail(connection: DataSource, saleId: string) {
    const sale = await connection.getRepository(Sale).findOne({
      where: { id: saleId },
      relations: ['employee', 'branch', 'customer', 'items', 'payments'],
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');

    // Load variant details for each item
    const itemsWithVariants = await Promise.all(
      (sale.items || []).map(async (item) => {
        const variant = await connection.getRepository('ProductVariant')
          .createQueryBuilder('v')
          .leftJoinAndSelect('v.product', 'product')
          .where('v.id = :id', { id: item.variant_id })
          .getOne();

        // Image fallback: variant images → product images → product legacy image_url
        const variantImages: string[] = (variant as any)?.images || [];
        const productImages: string[] = (variant as any)?.product?.images || [];
        const legacyImage: string | null = (variant as any)?.product?.image_url || null;
        const image_url = variantImages[0] || productImages[0] || legacyImage || null;

        return {
          id: item.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: parseFloat(String(item.unit_price)),
          discount: parseFloat(String(item.discount)),
          subtotal: parseFloat(String(item.subtotal)),
          product_name: (variant as any)?.product?.name || '',
          sku: (variant as any)?.sku || '',
          attributes: (variant as any)?.attributes || {},
          image_url,
        };
      }),
    );

    // Load returns for this sale
    const returns = await connection.getRepository(SaleReturn).find({
      where: { sale_id: saleId },
      relations: ['employee', 'items'],
      order: { created_at: 'DESC' },
    });

    // Already-returned quantities per sale_item_id
    const returnedQtyMap: Record<string, number> = {};
    for (const ret of returns) {
      for (const ri of ret.items || []) {
        returnedQtyMap[ri.sale_item_id] = (returnedQtyMap[ri.sale_item_id] || 0) + ri.quantity;
      }
    }

    return {
      id: sale.id,
      folio: sale.id.slice(0, 8).toUpperCase(),
      status: sale.status,
      total_amount: parseFloat(String(sale.total_amount)),
      discount_amount: parseFloat(String(sale.discount_amount)),
      tax_amount: parseFloat(String(sale.tax_amount)),
      payment_method: sale.payment_method,
      sale_type: sale.sale_type,
      notes: sale.notes,
      created_at: sale.created_at,
      employee_name: sale.employee?.name || '',
      branch_name: sale.branch?.name || '',
      branch_id: sale.branch_id,
      customer_name: sale.customer?.name || null,
      items: itemsWithVariants.map((item) => ({
        ...item,
        returned_quantity: returnedQtyMap[item.id] || 0,
        returnable_quantity: item.quantity - (returnedQtyMap[item.id] || 0),
      })),
      payments: (sale.payments || []).map((p) => ({
        id: p.id,
        payment_method_name: p.payment_method_name,
        amount: parseFloat(String(p.amount)),
        reference: p.reference,
      })),
      returns: returns.map((r) => ({
        id: r.id,
        refund_amount: parseFloat(String(r.refund_amount)),
        refund_method: r.refund_method,
        reason: r.reason,
        employee_name: r.employee?.name || '',
        created_at: r.created_at,
        items: (r.items || []).map((ri) => ({
          id: ri.id,
          variant_id: ri.variant_id,
          quantity: ri.quantity,
          unit_price: parseFloat(String(ri.unit_price)),
          subtotal: parseFloat(String(ri.subtotal)),
          disposition: ri.disposition,
        })),
      })),
    };
  }

  // ─── Returns ───────────────────────────────────────────────────

  /**
   * Process a return — creates SaleReturn + SaleReturnItems,
   * restores inventory (if disposition = 'floor'), creates CashTransaction
   * for cash refunds, and updates the original sale's status.
   */
  async processReturn(
    connection: DataSource,
    user: any,
    data: {
      sale_id: string;
      employee_id: string;
      branch_id: string;
      pos_session_id?: string;
      refund_method: 'cash' | 'card_reversal' | 'store_credit';
      reason?: string;
      items: {
        sale_item_id: string;
        variant_id: string;
        quantity: number;
        unit_price: number;
        disposition: 'floor' | 'shrinkage';
      }[];
    },
  ) {
    return connection.transaction(async (manager) => {
      // Use JWT user if no employee_id provided
      const employeeId = data.employee_id || user.sub;

      // Validate original sale
      const sale = await manager.findOne(Sale, {
        where: { id: data.sale_id },
        relations: ['items'],
      });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status === 'refunded') {
        throw new BadRequestException('Esta venta ya fue devuelta completamente');
      }

      // Load existing returns to check for double-return fraud
      const existingReturns = await manager.find(SaleReturnItem, {
        where: { sale_return: { sale_id: data.sale_id } } as any,
      });
      // Build map of already-returned quantities
      const alreadyReturned: Record<string, number> = {};
      // Query return items more reliably
      const existingReturnRecords = await manager
        .getRepository(SaleReturn)
        .find({ where: { sale_id: data.sale_id }, relations: ['items'] });
      for (const ret of existingReturnRecords) {
        for (const ri of ret.items || []) {
          alreadyReturned[ri.sale_item_id] = (alreadyReturned[ri.sale_item_id] || 0) + ri.quantity;
        }
      }

      // Validate each item
      let refundTotal = 0;
      for (const item of data.items) {
        const originalItem = sale.items.find((si) => si.id === item.sale_item_id);
        if (!originalItem) {
          throw new BadRequestException(`Artículo ${item.sale_item_id} no encontrado en la venta`);
        }
        const alreadyQty = alreadyReturned[item.sale_item_id] || 0;
        const maxReturnable = originalItem.quantity - alreadyQty;
        if (item.quantity > maxReturnable) {
          throw new BadRequestException(
            `No se puede devolver ${item.quantity} unidades del artículo. Máximo devolvible: ${maxReturnable}`,
          );
        }
        if (item.quantity <= 0) {
          throw new BadRequestException('La cantidad a devolver debe ser mayor a 0');
        }
        refundTotal += item.quantity * item.unit_price;
      }

      refundTotal = parseFloat(refundTotal.toFixed(2));

      // Create the return record
      const saleReturn = manager.create(SaleReturn, {
        sale_id: data.sale_id,
        employee_id: employeeId,
        branch_id: data.branch_id,
        pos_session_id: data.pos_session_id || null,
        refund_amount: refundTotal,
        refund_method: data.refund_method,
        reason: data.reason || null,
      });
      const savedReturn = await manager.save(saleReturn);

      // Create return items + handle inventory
      for (const item of data.items) {
        const returnItem = manager.create(SaleReturnItem, {
          sale_return_id: savedReturn.id,
          sale_item_id: item.sale_item_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: parseFloat((item.quantity * item.unit_price).toFixed(2)),
          disposition: item.disposition,
        });
        await manager.save(returnItem);

        // Restore inventory only if going back to sales floor
        if (item.disposition === 'floor') {
          const inventory = await manager.findOne(Inventory, {
            where: { variant_id: item.variant_id, branch_id: data.branch_id },
          });
          if (inventory) {
            inventory.stock_available += item.quantity;
            await manager.save(inventory);
          }
        }
      }

      // Create CashTransaction for cash refunds (affects current session)
      if (data.refund_method === 'cash' && data.pos_session_id) {
        const cashTx = manager.create(CashTransaction, {
          session_id: data.pos_session_id,
          employee_id: employeeId,
          type: 'refund',
          amount: refundTotal,
          description: `Devolución de venta ${data.sale_id.slice(0, 8).toUpperCase()}`,
        });
        await manager.save(cashTx);
      }

      // Update original sale status
      // Check if ALL items have now been fully returned
      const updatedReturned: Record<string, number> = { ...alreadyReturned };
      for (const item of data.items) {
        updatedReturned[item.sale_item_id] = (updatedReturned[item.sale_item_id] || 0) + item.quantity;
      }
      const allFullyReturned = sale.items.every(
        (si) => (updatedReturned[si.id] || 0) >= si.quantity,
      );

      sale.status = allFullyReturned ? 'refunded' : 'partial_return';
      await manager.save(sale);

      return {
        return_id: savedReturn.id,
        refund_amount: refundTotal,
        refund_method: data.refund_method,
        sale_status: sale.status,
      };
    });
  }
}
