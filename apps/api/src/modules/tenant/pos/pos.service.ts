import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PosSession, Sale, SaleItem, Inventory, Product } from '@nivo/database';

@Injectable()
export class PosService {
  async getActiveSession(connection: DataSource, user: any) {
    const repo = connection.getRepository(PosSession);
    const session = await repo.findOne({
      where: { employee_id: user.sub, status: 'open' },
      relations: ['branch'],
    });
    return session || null;
  }

  async openSession(connection: DataSource, user: any, data: { branch_id: string; opening_amount: number }) {
    const repo = connection.getRepository(PosSession);

    const existing = await repo.findOne({
      where: { employee_id: user.sub, status: 'open' },
    });
    if (existing) throw new BadRequestException('You already have an open session');

    const session = repo.create({
      employee_id: user.sub,
      branch_id: data.branch_id,
      opening_amount: data.opening_amount,
      status: 'open',
    });

    return repo.save(session);
  }

  async closeSession(connection: DataSource, data: { session_id: string; closing_amount: number }) {
    const repo = connection.getRepository(PosSession);
    const session = await repo.findOne({ where: { id: data.session_id, status: 'open' } });
    if (!session) throw new NotFoundException('Open session not found');

    session.closing_amount = data.closing_amount;
    session.status = 'closed';
    session.closed_at = new Date();

    return repo.save(session);
  }

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
