import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product, ProductVariant, Inventory } from '@nivo/database';

@Injectable()
export class InventoryService {
  async findAllProducts(connection: DataSource, filters: { category?: string; brand?: string }) {
    const repo = connection.getRepository(Product);
    const query = repo.createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.category', 'category');

    if (filters.category) query.andWhere('category.id = :categoryId', { categoryId: filters.category });
    if (filters.brand) query.andWhere('brand.id = :brandId', { brandId: filters.brand });

    return query.getMany();
  }

  async findProductById(connection: DataSource, id: string) {
    const repo = connection.getRepository(Product);
    const product = await repo.findOne({
      where: { id },
      relations: ['variants', 'brand', 'category'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(connection: DataSource, data: any) {
    const repo = connection.getRepository(Product);
    const product = repo.create({
      name: data.name,
      description: data.description,
      brand_id: data.brand_id,
      category_id: data.category_id,
      image_url: data.image_url,
      variants: data.variants?.map((v: any) => ({
        sku: v.sku,
        color: v.color,
        size_mex: v.size_mex,
        price: v.price,
        cost: v.cost,
        barcode: v.barcode,
      })),
    });
    return repo.save(product);
  }

  async updateProduct(connection: DataSource, id: string, data: any) {
    const repo = connection.getRepository(Product);
    const product = await repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    Object.assign(product, data);
    return repo.save(product);
  }

  async softDeleteProduct(connection: DataSource, id: string) {
    const repo = connection.getRepository(Product);
    await repo.softDelete(id);
    return { deleted: true };
  }

  async adjustInventory(connection: DataSource, data: { variant_id: string; branch_id: string; quantity_change: number; reason: string }) {
    const repo = connection.getRepository(Inventory);
    let inventory = await repo.findOne({
      where: { variant_id: data.variant_id, branch_id: data.branch_id },
    });

    if (!inventory) {
      inventory = repo.create({
        variant_id: data.variant_id,
        branch_id: data.branch_id,
        stock_available: Math.max(0, data.quantity_change),
      });
    } else {
      inventory.stock_available = Math.max(0, inventory.stock_available + data.quantity_change);
    }

    return repo.save(inventory);
  }

  async transferInventory(connection: DataSource, data: { variant_id: string; from_branch_id: string; to_branch_id: string; quantity: number }) {
    const repo = connection.getRepository(Inventory);

    return connection.transaction(async (manager) => {
      const fromInventory = await manager.findOne(Inventory, {
        where: { variant_id: data.variant_id, branch_id: data.from_branch_id },
      });

      if (!fromInventory || fromInventory.stock_available < data.quantity) {
        throw new NotFoundException('Insufficient stock for transfer');
      }

      fromInventory.stock_available -= data.quantity;
      await manager.save(fromInventory);

      let toInventory = await manager.findOne(Inventory, {
        where: { variant_id: data.variant_id, branch_id: data.to_branch_id },
      });

      if (!toInventory) {
        toInventory = manager.create(Inventory, {
          variant_id: data.variant_id,
          branch_id: data.to_branch_id,
          stock_available: data.quantity,
        });
      } else {
        toInventory.stock_available += data.quantity;
      }

      await manager.save(toInventory);
      return { message: 'Transfer completed', from: fromInventory, to: toInventory };
    });
  }
}
