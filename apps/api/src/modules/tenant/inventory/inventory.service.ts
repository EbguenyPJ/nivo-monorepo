import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product, ProductVariant, Inventory, CollectionProduct, InventoryLocation, StorageLocation } from '@nivo/database';

@Injectable()
export class InventoryService {
  // ─── List Products ──────────────────────────────────────────────
  async findAllProducts(connection: DataSource, filters: { category?: string; brand?: string; search?: string }) {
    const repo = connection.getRepository(Product);
    const query = repo.createQueryBuilder('product')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.collectionProducts', 'cp')
      .leftJoinAndSelect('cp.collection', 'collection');

    if (filters.category) query.andWhere('category.id = :categoryId', { categoryId: filters.category });
    if (filters.brand) query.andWhere('brand.id = :brandId', { brandId: filters.brand });
    if (filters.search) {
      query.andWhere(
        '(product.name ILIKE :search OR variant.sku ILIKE :search OR variant.barcode ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    query.orderBy('product.created_at', 'DESC');
    return query.getMany();
  }

  // ─── Single Product ─────────────────────────────────────────────
  async findProductById(connection: DataSource, id: string) {
    const repo = connection.getRepository(Product);
    const product = await repo.findOne({
      where: { id },
      relations: ['variants', 'brand', 'category', 'collectionProducts', 'collectionProducts.collection'],
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  // ─── Create Product (Legacy) ────────────────────────────────────
  async createProduct(connection: DataSource, data: any) {
    const repo = connection.getRepository(Product);
    const product = repo.create({
      name: data.name,
      description: data.description,
      brand_id: data.brand_id,
      category_id: data.category_id,
      base_price: data.base_price || 0,
      image_url: data.image_url,
      images: data.images || [],
      variants: data.variants?.map((v: any) => ({
        sku: v.sku,
        attributes: v.attributes || {},
        price_override: v.price_override ?? null,
        cost: v.cost || 0,
        barcode: v.barcode,
      })),
    });
    return repo.save(product);
  }

  // ─── Wizard: Create Product + Variants + Inventory (Transactional) ──
  async createProductWizard(
    connection: DataSource,
    data: {
      name: string;
      description?: string;
      brand_id?: string;
      category_id?: string;
      base_price?: number;
      cost: number;
      images: string[];
      /** Images grouped by color name → URLs */
      color_images?: Record<string, string[]>;
      collection_ids: string[];
      variants: Array<{
        sku: string;
        attributes: Record<string, string>;
        price_override?: number | null;
        cost: number;
        barcode?: string;
        /** Multi-branch stock: { branch_id: quantity } */
        stock_by_branch: Record<string, number>;
      }>;
    },
  ) {
    if (!data.variants?.length) {
      throw new BadRequestException('Debe incluir al menos una variante');
    }

    // Check for duplicate SKUs in the payload
    const skus = data.variants.map((v) => v.sku);
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length) {
      throw new BadRequestException('Hay SKUs duplicados en las variantes');
    }

    return connection.transaction(async (manager) => {
      // 1. Create product
      const productRepo = manager.getRepository(Product);
      const product = productRepo.create({
        name: data.name,
        description: data.description || null,
        brand_id: data.brand_id || null,
        category_id: data.category_id || null,
        base_price: data.base_price || 0,
        images: data.images || [],
        image_url: data.images?.[0] || null,
      });
      const savedProduct = await productRepo.save(product);

      // 2. Link to collections (many-to-many)
      if (data.collection_ids?.length) {
        const cpRepo = manager.getRepository(CollectionProduct);
        const collectionLinks = data.collection_ids.map((cid) =>
          cpRepo.create({ collection_id: cid, product_id: savedProduct.id }),
        );
        await cpRepo.save(collectionLinks);
      }

      // 3. Create variants (with color images)
      const variantRepo = manager.getRepository(ProductVariant);
      const savedVariants: ProductVariant[] = [];

      for (const v of data.variants) {
        // Check SKU uniqueness against DB
        const existingSku = await variantRepo.findOne({ where: { sku: v.sku } });
        if (existingSku) {
          throw new BadRequestException(`El SKU "${v.sku}" ya existe en otro producto`);
        }

        // Assign color-specific images to the variant
        const colorName = v.attributes?.['Color'] || '';
        const variantImages = data.color_images?.[colorName] || [];

        const variant = variantRepo.create({
          product_id: savedProduct.id,
          sku: v.sku,
          attributes: v.attributes,
          price_override: v.price_override ?? null,
          cost: v.cost || 0,
          barcode: v.barcode || null,
          images: variantImages,
        });
        savedVariants.push(await variantRepo.save(variant));
      }

      // 4. Create inventory entries per variant per branch
      const invRepo = manager.getRepository(Inventory);
      for (let i = 0; i < savedVariants.length; i++) {
        const variant = savedVariants[i];
        const stockByBranch = data.variants[i].stock_by_branch || {};

        for (const [branchId, qty] of Object.entries(stockByBranch)) {
          if (qty > 0) {
            await invRepo.save(
              invRepo.create({
                variant_id: variant.id,
                branch_id: branchId,
                stock_available: qty,
              }),
            );
          }
        }
      }

      // 5. Return full product with relations
      return productRepo.findOne({
        where: { id: savedProduct.id },
        relations: ['variants', 'brand', 'collectionProducts', 'collectionProducts.collection'],
      });
    });
  }

  // ─── Update Product ─────────────────────────────────────────────
  async updateProduct(connection: DataSource, id: string, data: any) {
    const repo = connection.getRepository(Product);
    const product = await repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    Object.assign(product, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.brand_id !== undefined && { brand_id: data.brand_id }),
      ...(data.category_id !== undefined && { category_id: data.category_id }),
      ...(data.base_price !== undefined && { base_price: data.base_price }),
      ...(data.images !== undefined && { images: data.images }),
      ...(data.is_active !== undefined && { is_active: data.is_active }),
    });

    return repo.save(product);
  }

  // ─── Toggle Product Status ──────────────────────────────────────
  async toggleProductStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Product);
    const product = await repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    product.is_active = !product.is_active;
    return repo.save(product);
  }

  // ─── Soft Delete ────────────────────────────────────────────────
  async softDeleteProduct(connection: DataSource, id: string) {
    const repo = connection.getRepository(Product);
    await repo.softDelete(id);
    return { deleted: true };
  }

  // ─── Inventory: Adjust ──────────────────────────────────────────
  async adjustInventory(
    connection: DataSource,
    data: { variant_id: string; branch_id: string; quantity_change: number; reason: string; location_id?: string },
  ) {
    return connection.transaction(async (manager) => {
      const repo = manager.getRepository(Inventory);
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

      await repo.save(inventory);

      // If location_id provided, also adjust InventoryLocation
      if (data.location_id) {
        const ilRepo = manager.getRepository(InventoryLocation);
        let invLoc = await ilRepo.findOne({
          where: { variant_id: data.variant_id, branch_id: data.branch_id, location_id: data.location_id },
        });

        if (!invLoc) {
          if (data.quantity_change > 0) {
            invLoc = ilRepo.create({
              variant_id: data.variant_id,
              branch_id: data.branch_id,
              location_id: data.location_id,
              quantity: data.quantity_change,
            });
            await ilRepo.save(invLoc);
          }
        } else {
          invLoc.quantity = Math.max(0, invLoc.quantity + data.quantity_change);
          if (invLoc.quantity === 0) {
            await ilRepo.remove(invLoc);
          } else {
            await ilRepo.save(invLoc);
          }
        }
      }

      return inventory;
    });
  }

  // ─── Inventory: List stock by branch (for assignment UI) ────────
  async getStockByBranch(connection: DataSource, branchId: string) {
    const repo = connection.getRepository(Inventory);
    return repo.createQueryBuilder('inv')
      .leftJoinAndSelect('inv.variant', 'variant')
      .leftJoin('variant.product', 'product')
      .addSelect(['product.id', 'product.name'])
      .where('inv.branch_id = :branchId', { branchId })
      .andWhere('inv.stock_available > 0')
      .orderBy('product.name', 'ASC')
      .addOrderBy('variant.sku', 'ASC')
      .getMany();
  }

  // ─── Inventory: Transfer ────────────────────────────────────────
  async transferInventory(
    connection: DataSource,
    data: {
      variant_id: string;
      from_branch_id: string;
      to_branch_id: string;
      quantity: number;
      from_location_id?: string;
      to_location_id?: string;
    },
  ) {
    const repo = connection.getRepository(Inventory);

    return connection.transaction(async (manager) => {
      const fromInventory = await manager.findOne(Inventory, {
        where: { variant_id: data.variant_id, branch_id: data.from_branch_id },
      });

      if (!fromInventory || fromInventory.stock_available < data.quantity) {
        throw new NotFoundException('Stock insuficiente para el traspaso');
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

      // Handle InventoryLocation if location IDs provided
      const ilRepo = manager.getRepository(InventoryLocation);

      if (data.from_location_id) {
        const fromIL = await ilRepo.findOne({
          where: { variant_id: data.variant_id, branch_id: data.from_branch_id, location_id: data.from_location_id },
        });
        if (fromIL) {
          fromIL.quantity -= data.quantity;
          if (fromIL.quantity <= 0) {
            await ilRepo.remove(fromIL);
          } else {
            await ilRepo.save(fromIL);
          }
        }
      }

      if (data.to_location_id) {
        let toIL = await ilRepo.findOne({
          where: { variant_id: data.variant_id, branch_id: data.to_branch_id, location_id: data.to_location_id },
        });
        if (!toIL) {
          toIL = ilRepo.create({
            variant_id: data.variant_id,
            branch_id: data.to_branch_id,
            location_id: data.to_location_id,
            quantity: data.quantity,
          });
        } else {
          toIL.quantity += data.quantity;
        }
        await ilRepo.save(toIL);
      }

      return { message: 'Traspaso completado', from: fromInventory, to: toInventory };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // INVENTORY LOCATIONS — Stock by physical location
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get stock breakdown by location for a branch.
   * Optionally filter to a specific location (and its descendants).
   */
  async getStockByLocation(
    connection: DataSource,
    data: { branch_id: string; location_id?: string },
  ) {
    const ilRepo = connection.getRepository(InventoryLocation);
    const query = ilRepo.createQueryBuilder('il')
      .leftJoinAndSelect('il.variant', 'variant')
      .leftJoinAndSelect('il.location', 'location')
      .leftJoin('variant.product', 'product')
      .addSelect(['product.id', 'product.name', 'product.images'])
      .where('il.branch_id = :branchId', { branchId: data.branch_id })
      .andWhere('il.quantity > 0')
      .orderBy('location.code', 'ASC')
      .addOrderBy('product.name', 'ASC');

    if (data.location_id) {
      // Get this location + descendants
      const locRepo = connection.getRepository(StorageLocation);
      const locationIds = await this.collectDescendantLocationIds(locRepo, data.location_id);
      query.andWhere('il.location_id IN (:...locationIds)', { locationIds });
    }

    return query.getMany();
  }

  /**
   * Assign stock from "unlocated" pool to a specific location.
   * Validates that total allocated does not exceed aggregate stock.
   */
  async assignToLocation(
    connection: DataSource,
    data: { variant_id: string; branch_id: string; location_id: string; quantity: number },
  ) {
    if (data.quantity <= 0) throw new BadRequestException('La cantidad debe ser mayor a 0');

    return connection.transaction(async (manager) => {
      // 1. Get aggregate inventory
      const invRepo = manager.getRepository(Inventory);
      const inventory = await invRepo.findOne({
        where: { variant_id: data.variant_id, branch_id: data.branch_id },
      });
      if (!inventory) throw new NotFoundException('No hay stock de esta variante en esta sucursal');

      // 2. Calculate current total allocated
      const ilRepo = manager.getRepository(InventoryLocation);
      const { sum } = await ilRepo.createQueryBuilder('il')
        .select('COALESCE(SUM(il.quantity), 0)', 'sum')
        .where('il.variant_id = :variantId AND il.branch_id = :branchId', {
          variantId: data.variant_id,
          branchId: data.branch_id,
        })
        .getRawOne();

      const currentAllocated = Number(sum);
      const unlocated = inventory.stock_available - currentAllocated;

      if (data.quantity > unlocated) {
        throw new BadRequestException(
          `Stock sin ubicar insuficiente. Disponible: ${unlocated}, solicitado: ${data.quantity}`,
        );
      }

      // 3. Upsert InventoryLocation
      let invLoc = await ilRepo.findOne({
        where: { variant_id: data.variant_id, branch_id: data.branch_id, location_id: data.location_id },
      });

      if (invLoc) {
        invLoc.quantity += data.quantity;
      } else {
        invLoc = ilRepo.create({
          variant_id: data.variant_id,
          branch_id: data.branch_id,
          location_id: data.location_id,
          quantity: data.quantity,
        });
      }

      return ilRepo.save(invLoc);
    });
  }

  /**
   * Move stock between locations within the same branch.
   * The aggregate Inventory does NOT change.
   */
  async moveWithinBranch(
    connection: DataSource,
    data: { variant_id: string; branch_id: string; from_location_id: string; to_location_id: string; quantity: number },
  ) {
    if (data.quantity <= 0) throw new BadRequestException('La cantidad debe ser mayor a 0');
    if (data.from_location_id === data.to_location_id) {
      throw new BadRequestException('La ubicación origen y destino no pueden ser la misma');
    }

    return connection.transaction(async (manager) => {
      const ilRepo = manager.getRepository(InventoryLocation);

      // 1. Deduct from source
      const fromIL = await ilRepo.findOne({
        where: { variant_id: data.variant_id, branch_id: data.branch_id, location_id: data.from_location_id },
      });
      if (!fromIL || fromIL.quantity < data.quantity) {
        throw new BadRequestException('Stock insuficiente en la ubicación origen');
      }

      fromIL.quantity -= data.quantity;
      if (fromIL.quantity === 0) {
        await ilRepo.remove(fromIL);
      } else {
        await ilRepo.save(fromIL);
      }

      // 2. Add to destination
      let toIL = await ilRepo.findOne({
        where: { variant_id: data.variant_id, branch_id: data.branch_id, location_id: data.to_location_id },
      });

      if (toIL) {
        toIL.quantity += data.quantity;
      } else {
        toIL = ilRepo.create({
          variant_id: data.variant_id,
          branch_id: data.branch_id,
          location_id: data.to_location_id,
          quantity: data.quantity,
        });
      }

      await ilRepo.save(toIL);

      return { message: 'Stock movido exitosamente', from: fromIL, to: toIL };
    });
  }

  // ─── Private Helper ─────────────────────────────────────────────

  private async collectDescendantLocationIds(
    repo: ReturnType<DataSource['getRepository']>,
    locationId: string,
  ): Promise<string[]> {
    const ids = [locationId];
    const children = await (repo as any).find({ where: { parent_id: locationId } });
    for (const child of children) {
      const childIds = await this.collectDescendantLocationIds(repo, child.id);
      ids.push(...childIds);
    }
    return ids;
  }
}
