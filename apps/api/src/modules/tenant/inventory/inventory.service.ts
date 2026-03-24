import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product, ProductVariant, Inventory, CollectionProduct } from '@nivo/database';

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
      base_price: number;
      images: string[];
      collection_ids: string[];
      variants: Array<{
        sku: string;
        attributes: Record<string, string>;
        price_override?: number | null;
        cost: number;
        barcode?: string;
        stock: number;
      }>;
      branch_id: string;
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
        base_price: data.base_price,
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

      // 3. Create variants
      const variantRepo = manager.getRepository(ProductVariant);
      const savedVariants: ProductVariant[] = [];

      for (const v of data.variants) {
        // Check SKU uniqueness against DB
        const existingSku = await variantRepo.findOne({ where: { sku: v.sku } });
        if (existingSku) {
          throw new BadRequestException(`El SKU "${v.sku}" ya existe en otro producto`);
        }

        const variant = variantRepo.create({
          product_id: savedProduct.id,
          sku: v.sku,
          attributes: v.attributes,
          price_override: v.price_override ?? null,
          cost: v.cost || 0,
          barcode: v.barcode || null,
        });
        savedVariants.push(await variantRepo.save(variant));
      }

      // 4. Create inventory entries for each variant at the selected branch
      if (data.branch_id) {
        const invRepo = manager.getRepository(Inventory);
        for (let i = 0; i < savedVariants.length; i++) {
          const variant = savedVariants[i];
          const stock = data.variants[i].stock || 0;
          if (stock > 0) {
            const inv = invRepo.create({
              variant_id: variant.id,
              branch_id: data.branch_id,
              stock_available: stock,
            });
            await invRepo.save(inv);
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

  // ─── Inventory: Transfer ────────────────────────────────────────
  async transferInventory(connection: DataSource, data: { variant_id: string; from_branch_id: string; to_branch_id: string; quantity: number }) {
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
      return { message: 'Traspaso completado', from: fromInventory, to: toInventory };
    });
  }
}
