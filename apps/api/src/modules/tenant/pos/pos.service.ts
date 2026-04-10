import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PosSession, Sale, SaleItem, SalePayment, Inventory, Product, Employee, CashRegister, CashTransaction, CollectionProduct, PaymentMethod, Branch, TenantSetting } from '@nivo/database';
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
}
