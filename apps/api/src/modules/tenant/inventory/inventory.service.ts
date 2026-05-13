import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product, ProductVariant, Inventory, CollectionProduct, InventoryLocation, StorageLocation, InventoryTransfer, InventoryTransferItem, Branch } from '@nivo/database';

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

  // ─── Update Variant ─────────────────────────────────────────────
  async updateVariant(connection: DataSource, productId: string, variantId: string, data: any) {
    const repo = connection.getRepository(ProductVariant);
    const variant = await repo.findOne({ where: { id: variantId, product_id: productId } });
    if (!variant) throw new NotFoundException('Variante no encontrada');

    Object.assign(variant, {
      ...(data.sku !== undefined && { sku: data.sku }),
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      ...(data.cost !== undefined && { cost: data.cost }),
      ...(data.price_override !== undefined && { price_override: data.price_override }),
      ...(data.images !== undefined && { images: data.images }),
      ...(data.attributes !== undefined && { attributes: data.attributes }),
      ...(data.is_active !== undefined && { is_active: data.is_active }),
    });

    return repo.save(variant);
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

  // ═══════════════════════════════════════════════════════════════
  // INVENTORY TRANSFERS — Multi-step branch-to-branch transfers
  // ═══════════════════════════════════════════════════════════════

  /**
   * List transfers filtered by role: sent from, incoming to, or all for a branch.
   */
  async listTransfers(
    connection: DataSource,
    filters: {
      branch_id?: string;
      tab?: 'sent' | 'incoming' | 'history' | 'all';
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const qb = connection.getRepository(InventoryTransfer)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.origin_branch', 'origin')
      .leftJoinAndSelect('t.destination_branch', 'destination')
      .leftJoinAndSelect('t.created_by', 'creator')
      .leftJoinAndSelect('t.received_by', 'receiver');

    if (filters.branch_id) {
      if (filters.tab === 'sent') {
        qb.andWhere('t.origin_branch_id = :bid', { bid: filters.branch_id });
        qb.andWhere('t.status IN (:...statuses)', { statuses: ['draft', 'in_transit'] });
      } else if (filters.tab === 'incoming') {
        qb.andWhere('t.destination_branch_id = :bid', { bid: filters.branch_id });
        qb.andWhere('t.status = :status', { status: 'in_transit' });
      } else if (filters.tab === 'history') {
        qb.andWhere('(t.origin_branch_id = :bid OR t.destination_branch_id = :bid)', { bid: filters.branch_id });
        qb.andWhere('t.status IN (:...statuses)', { statuses: ['completed', 'discrepancy', 'cancelled'] });
      } else {
        qb.andWhere('(t.origin_branch_id = :bid OR t.destination_branch_id = :bid)', { bid: filters.branch_id });
      }
    }

    if (filters.status && filters.status !== 'all') {
      qb.andWhere('t.status = :filterStatus', { filterStatus: filters.status });
    }

    qb.orderBy('t.created_at', 'DESC');

    const total = await qb.getCount();
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const data = await qb.skip(offset).take(limit).getMany();

    return {
      data: data.map((t) => ({
        id: t.id,
        folio: `TR-${String(t.folio_number).padStart(4, '0')}`,
        status: t.status,
        origin_branch_name: t.origin_branch?.name || '',
        origin_branch_id: t.origin_branch_id,
        destination_branch_name: t.destination_branch?.name || '',
        destination_branch_id: t.destination_branch_id,
        created_by_name: t.created_by?.name || '',
        received_by_name: t.received_by?.name || null,
        shipped_at: t.shipped_at,
        received_at: t.received_at,
        notes: t.notes,
        discrepancy_notes: t.discrepancy_notes,
        created_at: t.created_at,
        item_count: 0, // filled below
        total_sent: 0,
      })),
      total,
    };
  }

  /**
   * Count pending incoming transfers for a branch (for sidebar badge).
   */
  async countIncoming(connection: DataSource, branchId: string): Promise<number> {
    return connection.getRepository(InventoryTransfer).count({
      where: { destination_branch_id: branchId, status: 'in_transit' },
    });
  }

  /**
   * Get full transfer detail with items + variant info.
   */
  async getTransferDetail(connection: DataSource, transferId: string) {
    const transfer = await connection.getRepository(InventoryTransfer).findOne({
      where: { id: transferId },
      relations: ['origin_branch', 'destination_branch', 'created_by', 'received_by', 'items'],
    });
    if (!transfer) throw new NotFoundException('Traspaso no encontrado');

    // Load variant details for each item
    const itemsWithDetails = await Promise.all(
      (transfer.items || []).map(async (item) => {
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
          sent_quantity: item.sent_quantity,
          received_quantity: item.received_quantity,
          difference: item.received_quantity !== null ? item.received_quantity - item.sent_quantity : null,
          product_name: variant?.product?.name || '',
          sku: variant?.sku || '',
          barcode: variant?.barcode || null,
          attributes: variant?.attributes || {},
          image_url,
        };
      }),
    );

    return {
      id: transfer.id,
      folio: `TR-${String(transfer.folio_number).padStart(4, '0')}`,
      status: transfer.status,
      origin_branch_id: transfer.origin_branch_id,
      origin_branch_name: transfer.origin_branch?.name || '',
      destination_branch_id: transfer.destination_branch_id,
      destination_branch_name: transfer.destination_branch?.name || '',
      created_by_name: transfer.created_by?.name || '',
      received_by_name: transfer.received_by?.name || null,
      shipped_at: transfer.shipped_at,
      received_at: transfer.received_at,
      notes: transfer.notes,
      discrepancy_notes: transfer.discrepancy_notes,
      created_at: transfer.created_at,
      items: itemsWithDetails,
    };
  }

  /**
   * Create a new transfer in draft state.
   */
  async createTransfer(
    connection: DataSource,
    data: {
      origin_branch_id: string;
      destination_branch_id: string;
      created_by_id: string;
      notes?: string;
      items: { variant_id: string; sent_quantity: number }[];
    },
  ) {
    if (data.origin_branch_id === data.destination_branch_id) {
      throw new BadRequestException('La sucursal origen y destino no pueden ser la misma');
    }
    if (!data.items?.length) {
      throw new BadRequestException('Debe incluir al menos un artículo');
    }

    const savedId = await connection.transaction(async (manager) => {
      // Validate stock for each item
      for (const item of data.items) {
        const inventory = await manager.findOne(Inventory, {
          where: { variant_id: item.variant_id, branch_id: data.origin_branch_id },
        });
        const available = inventory?.stock_available ?? 0;
        if (item.sent_quantity > available) {
          const variant = await manager.findOne(ProductVariant, { where: { id: item.variant_id }, relations: ['product'] });
          throw new BadRequestException(
            `Stock insuficiente para ${variant?.product?.name || ''} (${variant?.sku || item.variant_id}). Disponible: ${available}, solicitado: ${item.sent_quantity}`,
          );
        }
        if (item.sent_quantity <= 0) {
          throw new BadRequestException('La cantidad debe ser mayor a 0');
        }
      }

      const transfer = manager.create(InventoryTransfer, {
        origin_branch_id: data.origin_branch_id,
        destination_branch_id: data.destination_branch_id,
        created_by_id: data.created_by_id,
        status: 'draft',
        notes: data.notes || null,
      });
      const saved = await manager.save(transfer);

      for (const item of data.items) {
        const transferItem = manager.create(InventoryTransferItem, {
          transfer_id: saved.id,
          variant_id: item.variant_id,
          sent_quantity: item.sent_quantity,
        });
        await manager.save(transferItem);
      }

      return saved.id;
    });

    // Fetch detail AFTER transaction commits so the data is visible
    return this.getTransferDetail(connection, savedId);
  }

  /**
   * Dispatch a draft transfer: deduct from origin, set in_transit.
   */
  async dispatchTransfer(connection: DataSource, transferId: string) {
    return connection.transaction(async (manager) => {
      const transfer = await manager.findOne(InventoryTransfer, {
        where: { id: transferId },
        relations: ['items'],
      });
      if (!transfer) throw new NotFoundException('Traspaso no encontrado');
      if (transfer.status !== 'draft') {
        throw new BadRequestException('Solo se pueden despachar traspasos en borrador');
      }

      // Re-validate and deduct stock from origin
      for (const item of transfer.items) {
        const inventory = await manager.findOne(Inventory, {
          where: { variant_id: item.variant_id, branch_id: transfer.origin_branch_id },
        });
        if (!inventory || inventory.stock_available < item.sent_quantity) {
          throw new BadRequestException(
            `Stock insuficiente para variante ${item.variant_id}. Disponible: ${inventory?.stock_available ?? 0}`,
          );
        }
        inventory.stock_available -= item.sent_quantity;
        await manager.save(inventory);

        // Also deduct from InventoryLocation if allocated
        const ilRepo = manager.getRepository(InventoryLocation);
        const locations = await ilRepo.find({
          where: { variant_id: item.variant_id, branch_id: transfer.origin_branch_id },
          order: { quantity: 'DESC' },
        });
        let remaining = item.sent_quantity;
        for (const loc of locations) {
          if (remaining <= 0) break;
          const deduct = Math.min(loc.quantity, remaining);
          loc.quantity -= deduct;
          remaining -= deduct;
          if (loc.quantity <= 0) {
            await ilRepo.remove(loc);
          } else {
            await ilRepo.save(loc);
          }
        }
      }

      transfer.status = 'in_transit';
      transfer.shipped_at = new Date();
      await manager.save(transfer);

      return { id: transfer.id, status: 'in_transit' };
    });
  }

  /**
   * Receive a transfer at destination: apply received quantities,
   * add to destination inventory, mark completed or discrepancy.
   * Items arrive as "unlocated" (no InventoryLocation row = orange badge).
   */
  async receiveTransfer(
    connection: DataSource,
    data: {
      transfer_id: string;
      received_by_id: string;
      items: { item_id: string; received_quantity: number }[];
    },
  ) {
    return connection.transaction(async (manager) => {
      const transfer = await manager.findOne(InventoryTransfer, {
        where: { id: data.transfer_id },
        relations: ['items'],
      });
      if (!transfer) throw new NotFoundException('Traspaso no encontrado');
      if (transfer.status !== 'in_transit') {
        throw new BadRequestException('Solo se pueden recibir traspasos en tránsito');
      }

      let hasDiscrepancy = false;
      const discrepancies: string[] = [];

      for (const received of data.items) {
        const item = transfer.items.find((i) => i.id === received.item_id);
        if (!item) throw new BadRequestException(`Artículo ${received.item_id} no encontrado en el traspaso`);

        item.received_quantity = received.received_quantity;
        await manager.save(item);

        // Add received quantity to destination branch inventory
        if (received.received_quantity > 0) {
          let destInv = await manager.findOne(Inventory, {
            where: { variant_id: item.variant_id, branch_id: transfer.destination_branch_id },
          });
          if (!destInv) {
            destInv = manager.create(Inventory, {
              variant_id: item.variant_id,
              branch_id: transfer.destination_branch_id,
              stock_available: received.received_quantity,
            });
          } else {
            destInv.stock_available += received.received_quantity;
          }
          await manager.save(destInv);
        }

        // Track discrepancies
        const diff = received.received_quantity - item.sent_quantity;
        if (diff !== 0) {
          hasDiscrepancy = true;
          const variant = await manager.findOne(ProductVariant, {
            where: { id: item.variant_id },
            relations: ['product'],
          });
          const name = variant?.product?.name || variant?.sku || item.variant_id;
          discrepancies.push(
            `${name} (${variant?.sku}): enviado ${item.sent_quantity}, recibido ${received.received_quantity} (${diff > 0 ? '+' : ''}${diff})`,
          );
        }
      }

      transfer.status = hasDiscrepancy ? 'discrepancy' : 'completed';
      transfer.received_by_id = data.received_by_id;
      transfer.received_at = new Date();
      if (discrepancies.length > 0) {
        transfer.discrepancy_notes = discrepancies.join('\n');
      }
      await manager.save(transfer);

      return {
        id: transfer.id,
        status: transfer.status,
        discrepancy_notes: transfer.discrepancy_notes,
      };
    });
  }

  /**
   * Cancel a draft transfer (cannot cancel in_transit).
   */
  async cancelTransfer(connection: DataSource, transferId: string) {
    const repo = connection.getRepository(InventoryTransfer);
    const transfer = await repo.findOne({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException('Traspaso no encontrado');
    if (transfer.status !== 'draft') {
      throw new BadRequestException('Solo se pueden cancelar traspasos en borrador');
    }
    transfer.status = 'cancelled';
    return repo.save(transfer);
  }

  /**
   * Search variants with stock in a branch — for the transfer item picker.
   */
  async searchVariantsForTransfer(
    connection: DataSource,
    branchId: string,
    search: string,
  ) {
    const qb = connection.getRepository(Inventory)
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.variant', 'variant')
      .leftJoin('variant.product', 'product')
      .addSelect(['product.id', 'product.name', 'product.images', 'product.image_url'])
      .where('inv.branch_id = :branchId', { branchId })
      .andWhere('inv.stock_available > 0');

    if (search) {
      qb.andWhere(
        '(product.name ILIKE :q OR variant.sku ILIKE :q OR variant.barcode ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    qb.orderBy('product.name', 'ASC').addOrderBy('variant.sku', 'ASC').take(30);

    const rows = await qb.getMany();
    return rows.map((inv) => {
      const v = inv.variant;
      const p = (v as any)?.product;
      const variantImages: string[] = v?.images || [];
      const productImages: string[] = p?.images || [];
      const image_url = variantImages[0] || productImages[0] || p?.image_url || null;

      return {
        variant_id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        attributes: v.attributes,
        product_name: p?.name || '',
        image_url,
        stock_available: inv.stock_available,
      };
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
