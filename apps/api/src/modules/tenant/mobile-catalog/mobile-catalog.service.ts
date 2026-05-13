import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product, ProductVariant, Inventory, Brand, Category, Branch } from '@nivo/database';

@Injectable()
export class MobileCatalogService {
  async listProducts(
    connection: DataSource,
    filters: { search?: string; category_id?: string; brand_id?: string; limit?: number; offset?: number },
  ) {
    const qb = connection.getRepository(Product)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoin('p.variants', 'v')
      .where('p.is_active = true')
      .andWhere('p.deleted_at IS NULL');

    if (filters.search) {
      qb.andWhere('(LOWER(p.name) LIKE LOWER(:s) OR LOWER(brand.name) LIKE LOWER(:s))', {
        s: `%${filters.search}%`,
      });
    }
    if (filters.category_id) qb.andWhere('p.category_id = :cid', { cid: filters.category_id });
    if (filters.brand_id) qb.andWhere('p.brand_id = :bid', { bid: filters.brand_id });

    qb.addSelect('COUNT(v.id)', 'variant_count')
      .addSelect('MIN(COALESCE(v.price_override, p.base_price))', 'min_price')
      .addSelect('MAX(COALESCE(v.price_override, p.base_price))', 'max_price')
      .groupBy('p.id')
      .addGroupBy('brand.id')
      .addGroupBy('category.id')
      .orderBy('p.name', 'ASC');

    const total = await qb.clone().getCount();
    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    const { entities, raw } = await qb.getRawAndEntities();

    return {
      data: entities.map((p, idx) => {
        const productImages: string[] = p.images || [];
        const legacyImage = p.image_url;
        return {
          id: p.id,
          name: p.name,
          brand_name: p.brand?.name ?? null,
          category_name: p.category?.name ?? null,
          base_price: p.base_price,
          image_url: productImages[0] || legacyImage || null,
          variant_count: parseInt(raw[idx]?.variant_count || '0'),
          min_price: parseFloat(raw[idx]?.min_price || String(p.base_price)),
          max_price: parseFloat(raw[idx]?.max_price || String(p.base_price)),
        };
      }),
      total,
    };
  }

  async getProductDetail(connection: DataSource, productId: string) {
    const product = await connection.getRepository(Product).findOne({
      where: { id: productId, is_active: true },
      relations: ['brand', 'category', 'variants'],
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const variantsWithStock = await Promise.all(
      product.variants.filter((v) => v.is_active).map(async (v) => {
        const inventoryRows = await connection.getRepository(Inventory).find({
          where: { variant_id: v.id },
          relations: ['branch'],
        });

        const stockByBranch = inventoryRows.map((inv: any) => ({
          branch_id: inv.branch_id,
          branch_name: inv.branch?.name ?? '',
          stock: Number(inv.stock_available),
        }));

        return {
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          attributes: v.attributes,
          price: v.price_override ?? product.base_price,
          images: v.images || [],
          stock_by_branch: stockByBranch,
          total_stock: stockByBranch.reduce((sum: number, b: any) => sum + b.stock, 0),
        };
      }),
    );

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      brand_name: product.brand?.name ?? null,
      category_name: product.category?.name ?? null,
      base_price: product.base_price,
      images: product.images?.length ? product.images : product.image_url ? [product.image_url] : [],
      variants: variantsWithStock,
    };
  }

  async getCategories(connection: DataSource) {
    return connection.getRepository(Category).find({ order: { name: 'ASC' } });
  }

  async getBrands(connection: DataSource) {
    return connection.getRepository(Brand).find({ order: { name: 'ASC' } });
  }

  async getBranchesWithStock(
    connection: DataSource,
    variantIds?: string[],
    userLat?: number,
    userLng?: number,
  ) {
    const branches = await connection.getRepository(Branch).find({
      where: { is_active: true },
    });

    const result = await Promise.all(
      branches.map(async (branch) => {
        let hasStock = true;

        if (variantIds?.length) {
          for (const vid of variantIds) {
            const inv = await connection.getRepository(Inventory).findOne({
              where: { variant_id: vid, branch_id: branch.id },
            });
            if (!inv || Number(inv.stock_available) <= 0) {
              hasStock = false;
              break;
            }
          }
        }

        let distanceKm: number | null = null;
        if (userLat && userLng && branch.latitude && branch.longitude) {
          distanceKm = this.haversineKm(
            userLat, userLng,
            Number(branch.latitude), Number(branch.longitude),
          );
        }

        return {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          city: branch.city,
          phone: branch.phone,
          latitude: branch.latitude ? Number(branch.latitude) : null,
          longitude: branch.longitude ? Number(branch.longitude) : null,
          distance_km: distanceKm,
          has_stock: hasStock,
        };
      }),
    );

    return result.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
  }

  async lookupBarcode(connection: DataSource, barcode: string) {
    const variant = await connection.getRepository(ProductVariant).findOne({
      where: [{ barcode }, { sku: barcode }],
      relations: ['product'],
    });
    if (!variant) throw new NotFoundException('Código no encontrado');

    const inventory = await connection.getRepository(Inventory).find({
      where: { variant_id: variant.id },
    });
    const totalStock = inventory.reduce((sum, inv) => sum + Number(inv.stock_available), 0);

    const variantImages: string[] = variant.images || [];
    const productImages: string[] = variant.product?.images || [];
    const legacyImage = variant.product?.image_url ?? null;

    return {
      variant_id: variant.id,
      product_name: variant.product?.name ?? '',
      sku: variant.sku,
      barcode: variant.barcode ?? barcode,
      attributes: variant.attributes,
      image_url: variantImages[0] || productImages[0] || legacyImage,
      price: variant.price_override ?? variant.product?.base_price ?? 0,
      stock_available: totalStock,
    };
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private toRad(deg: number) { return deg * (Math.PI / 180); }
}
