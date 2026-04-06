import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PosSession, Sale, SaleItem, Inventory, Product, Employee, CashRegister, CollectionProduct } from '@nivo/database';
import * as bcrypt from 'bcrypt';
import { CollectionsService } from '../collections/collections.service';
import { PricingService } from '../pricing/pricing.service';

@Injectable()
export class PosService {
  constructor(
    private readonly collectionsService: CollectionsService,
    private readonly pricingService: PricingService,
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

  async closeSession(connection: DataSource, data: { session_id: string; closing_amount: number }) {
    const repo = connection.getRepository(PosSession);
    const session = await repo.findOne({ where: { id: data.session_id, status: 'open' } });
    if (!session) throw new NotFoundException('Sesion de caja no encontrada');

    session.closing_amount = data.closing_amount;
    session.status = 'closed';
    session.closed_at = new Date();

    return repo.save(session);
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

      const sale = manager.create(Sale, {
        id: data.id,
        pos_session_id: data.pos_session_id,
        customer_id: data.customer_id || null,
        employee_id: user.sub,
        branch_id: data.branch_id,
        total_amount: data.total_amount || 0,
        discount_amount: data.discount_amount || 0,
        tax_amount: data.tax_amount || 0,
        payment_method: data.payment_method,
        sale_type: data.sale_type || 'in_store',
        status: 'completed',
        notes: data.notes,
      });

      const savedSale = await manager.save(sale);

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

      return savedSale;
    });
  }
}
