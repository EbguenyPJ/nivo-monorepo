import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, Not } from 'typeorm';
import {
  PriceList,
  BranchVariantOverride,
  VariantPriceMargin,
  ProductVariant,
  Branch,
  TenantSetting,
  BranchSettingOverride,
  Product,
} from '@nivo/database';

@Injectable()
export class PricingService {
  // ═══════════════════════════════════════════════════════════════
  // PRICE LISTS — CRUD
  // ═══════════════════════════════════════════════════════════════
  async findAllPriceLists(connection: DataSource) {
    const repo = connection.getRepository(PriceList);
    return repo.find({ order: { created_at: 'ASC' } });
  }

  async createPriceList(connection: DataSource, data: { name: string; default_margin_percentage: number }) {
    const repo = connection.getRepository(PriceList);
    if (!data.name?.trim()) throw new BadRequestException('El nombre es obligatorio');
    const existing = await repo.findOne({ where: { name: data.name.trim() } });
    if (existing) throw new ConflictException(`Ya existe una lista de precios con el nombre "${data.name}"`);
    return repo.save(repo.create({
      name: data.name.trim(),
      default_margin_percentage: data.default_margin_percentage || 0,
      is_active: true,
    }));
  }

  async updatePriceList(connection: DataSource, id: string, data: Partial<{ name: string; default_margin_percentage: number; is_active: boolean }>) {
    const repo = connection.getRepository(PriceList);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Lista de precios no encontrada');
    if (data.name && data.name !== entity.name) {
      const dup = await repo.findOne({ where: { name: data.name } });
      if (dup) throw new ConflictException(`Ya existe una lista de precios con el nombre "${data.name}"`);
    }
    Object.assign(entity, data);
    return repo.save(entity);
  }

  async deletePriceList(connection: DataSource, id: string) {
    const repo = connection.getRepository(PriceList);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Lista de precios no encontrada');
    if (entity.is_default) throw new BadRequestException('No se puede eliminar la lista de precios por defecto. Marca otra como defecto primero.');
    await repo.remove(entity);
    return { deleted: true };
  }

  async setDefaultPriceList(connection: DataSource, id: string) {
    const repo = connection.getRepository(PriceList);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Lista de precios no encontrada');

    // Unset all others using query builder (empty where causes issues with .update)
    await repo.createQueryBuilder()
      .update(PriceList)
      .set({ is_default: false })
      .where('is_default = :val', { val: true })
      .execute();
    // Set this one
    entity.is_default = true;
    return repo.save(entity);
  }

  async findDefaultPriceList(connection: DataSource): Promise<PriceList | null> {
    const repo = connection.getRepository(PriceList);
    const defaultPl = await repo.findOne({ where: { is_default: true } });
    if (defaultPl) return defaultPl;
    // Fallback: first active price list
    return repo.findOne({ where: { is_active: true }, order: { created_at: 'ASC' } });
  }

  // ═══════════════════════════════════════════════════════════════
  // BRANCH VARIANT OVERRIDES — Cost exceptions per branch
  // ═══════════════════════════════════════════════════════════════
  async findBranchOverridesForProduct(connection: DataSource, productId: string) {
    const variantRepo = connection.getRepository(ProductVariant);
    const variants = await variantRepo.find({ where: { product_id: productId }, select: ['id'] });
    if (!variants.length) return [];

    const overrideRepo = connection.getRepository(BranchVariantOverride);
    return overrideRepo.find({
      where: variants.map((v) => ({ variant_id: v.id })),
      relations: ['branch', 'variant'],
    });
  }

  async upsertBranchOverride(
    connection: DataSource,
    data: { variant_id: string; branch_id: string; purchase_price_override: number | null },
  ) {
    const repo = connection.getRepository(BranchVariantOverride);
    const existing = await repo.findOne({
      where: { variant_id: data.variant_id, branch_id: data.branch_id },
    });

    // If null or undefined, remove the override (use global)
    if (data.purchase_price_override === null || data.purchase_price_override === undefined) {
      if (existing) await repo.remove(existing);
      return { removed: true };
    }

    if (existing) {
      existing.purchase_price_override = data.purchase_price_override;
      return repo.save(existing);
    }

    return repo.save(repo.create({
      variant_id: data.variant_id,
      branch_id: data.branch_id,
      purchase_price_override: data.purchase_price_override,
    }));
  }

  async batchUpsertBranchOverrides(
    connection: DataSource,
    overrides: Array<{ variant_id: string; branch_id: string; purchase_price_override: number | null }>,
  ) {
    const results = [];
    for (const o of overrides) {
      results.push(await this.upsertBranchOverride(connection, o));
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // VARIANT PRICE MARGINS — Margin exceptions per price list
  // ═══════════════════════════════════════════════════════════════
  async findVariantMarginsForProduct(connection: DataSource, productId: string) {
    const variantRepo = connection.getRepository(ProductVariant);
    const variants = await variantRepo.find({ where: { product_id: productId }, select: ['id'] });
    if (!variants.length) return [];

    const marginRepo = connection.getRepository(VariantPriceMargin);
    return marginRepo.find({
      where: variants.map((v) => ({ variant_id: v.id })),
      relations: ['priceList', 'variant'],
    });
  }

  async upsertVariantMargin(
    connection: DataSource,
    data: { variant_id: string; price_list_id: string; custom_margin_percentage: number | null },
  ) {
    const repo = connection.getRepository(VariantPriceMargin);
    const existing = await repo.findOne({
      where: { variant_id: data.variant_id, price_list_id: data.price_list_id },
    });

    // If null, remove the custom margin (use global)
    if (data.custom_margin_percentage === null || data.custom_margin_percentage === undefined) {
      if (existing) await repo.remove(existing);
      return { removed: true };
    }

    if (existing) {
      existing.custom_margin_percentage = data.custom_margin_percentage;
      return repo.save(existing);
    }

    return repo.save(repo.create({
      variant_id: data.variant_id,
      price_list_id: data.price_list_id,
      custom_margin_percentage: data.custom_margin_percentage,
    }));
  }

  async batchUpsertVariantMargins(
    connection: DataSource,
    margins: Array<{ variant_id: string; price_list_id: string; custom_margin_percentage: number | null }>,
  ) {
    const results = [];
    for (const m of margins) {
      results.push(await this.upsertVariantMargin(connection, m));
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // PRICE CALCULATOR ENGINE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculates the final sale price for a variant at a specific branch and price list.
   *
   * Algorithm (strict fallback cascade):
   * 1. Purchase Cost: branch_variant_overrides.purchase_price_override ?? variant.cost
   * 2. Base Price: cost × (1 + landed_cost_%), where landed_cost_% = branch.custom ?? tenant.default
   * 3. Sale Price: base × (1 + margin_%), where margin_% = variant_price_margins.custom ?? price_list.default
   */
  async calculatePrice(
    connection: DataSource,
    variantId: string,
    branchId: string,
    priceListId: string,
  ): Promise<{
    purchase_cost: number;
    landed_cost_percentage: number;
    base_price: number;
    margin_percentage: number;
    final_price: number;
    has_branch_override: boolean;
    has_custom_margin: boolean;
  }> {
    // 1. Get the variant
    const variantRepo = connection.getRepository(ProductVariant);
    const variant = await variantRepo.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variante no encontrada');

    // 2. Get the price list
    const plRepo = connection.getRepository(PriceList);
    const priceList = await plRepo.findOne({ where: { id: priceListId } });
    if (!priceList) throw new NotFoundException('Lista de precios no encontrada');

    // 3. Determine purchase cost (branch override or global)
    const overrideRepo = connection.getRepository(BranchVariantOverride);
    const branchOverride = await overrideRepo.findOne({
      where: { variant_id: variantId, branch_id: branchId },
    });
    const purchaseCost = branchOverride
      ? Number(branchOverride.purchase_price_override)
      : Number(variant.cost);

    // 4. Determine landed cost percentage (branch override → global setting)
    const landedCostPercentage = await this.getEffectiveLandedCost(connection, branchId);

    // 5. Calculate base price
    const basePrice = purchaseCost * (1 + landedCostPercentage / 100);

    // 6. Determine margin percentage (variant custom or price list default)
    const marginRepo = connection.getRepository(VariantPriceMargin);
    const customMargin = await marginRepo.findOne({
      where: { variant_id: variantId, price_list_id: priceListId },
    });
    const marginPercentage = customMargin
      ? Number(customMargin.custom_margin_percentage)
      : Number(priceList.default_margin_percentage);

    // 7. Calculate final price
    const finalPrice = basePrice * (1 + marginPercentage / 100);

    return {
      purchase_cost: purchaseCost,
      landed_cost_percentage: landedCostPercentage,
      base_price: Math.round(basePrice * 100) / 100,
      margin_percentage: marginPercentage,
      final_price: Math.round(finalPrice * 100) / 100,
      has_branch_override: !!branchOverride,
      has_custom_margin: !!customMargin,
    };
  }

  /**
   * Calculate prices for ALL variants of a product across branches and price lists.
   * Useful for the product edit view.
   */
  async calculateProductPrices(
    connection: DataSource,
    productId: string,
    branchId: string,
    priceListId: string,
  ) {
    const variantRepo = connection.getRepository(ProductVariant);
    const variants = await variantRepo.find({ where: { product_id: productId } });

    const results = [];
    for (const variant of variants) {
      const priceInfo = await this.calculatePrice(connection, variant.id, branchId, priceListId);
      results.push({
        variant_id: variant.id,
        sku: variant.sku,
        attributes: variant.attributes,
        ...priceInfo,
      });
    }

    return results;
  }

  /**
   * Calculate a representative price for each product in a list.
   * Uses the first active variant of each product. Optimized for product listing page.
   * Returns a map: { product_id: final_price }
   */
  async calculateProductListPrices(
    connection: DataSource,
    branchId: string,
  ): Promise<Record<string, { min: number; max: number }>> {
    // Get default price list
    const defaultPl = await this.findDefaultPriceList(connection);
    if (!defaultPl) return {};

    // Get shared config (landed cost — uses branch override cascade)
    const landedCostPercentage = await this.getEffectiveLandedCost(connection, branchId);

    // Get all active products with their variants
    const productRepo = connection.getRepository(Product);
    const products = await productRepo.find({
      relations: ['variants'],
      order: { created_at: 'DESC' },
    });

    // Get all branch overrides at once
    const overrideRepo = connection.getRepository(BranchVariantOverride);
    const allOverrides = await overrideRepo.find({ where: { branch_id: branchId } });
    const overrideMap = new Map(allOverrides.map((o) => [o.variant_id, Number(o.purchase_price_override)]));

    // Get all custom margins for default price list at once
    const marginRepo = connection.getRepository(VariantPriceMargin);
    const allMargins = await marginRepo.find({ where: { price_list_id: defaultPl.id } });
    const marginMap = new Map(allMargins.map((m) => [m.variant_id, Number(m.custom_margin_percentage)]));

    const defaultMargin = Number(defaultPl.default_margin_percentage);

    const result: Record<string, { min: number; max: number }> = {};

    for (const product of products) {
      const activeVariants = product.variants.filter((v) => v.is_active);
      if (!activeVariants.length) {
        result[product.id] = { min: 0, max: 0 };
        continue;
      }

      let min = Infinity;
      let max = -Infinity;

      for (const variant of activeVariants) {
        const purchaseCost = overrideMap.get(variant.id) ?? Number(variant.cost);
        const basePrice = purchaseCost * (1 + landedCostPercentage / 100);
        const margin = marginMap.get(variant.id) ?? defaultMargin;
        const finalPrice = Math.round(basePrice * (1 + margin / 100) * 100) / 100;

        if (finalPrice < min) min = finalPrice;
        if (finalPrice > max) max = finalPrice;
      }

      result[product.id] = { min, max };
    }

    return result;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Resolve landed cost % using the branch setting override cascade:
   * BranchSettingOverride → TenantSetting → 0
   */
  private async getEffectiveLandedCost(
    connection: DataSource,
    branchId: string,
  ): Promise<number> {
    const KEY = 'operacion.default_landed_cost_percentage';

    // 1. Check branch-specific override
    const overrideRepo = connection.getRepository(BranchSettingOverride);
    const override = await overrideRepo.findOne({
      where: { branch_id: branchId, key: KEY },
    });
    if (override) return Number(override.value);

    // 2. Fall back to global tenant setting
    const settingRepo = connection.getRepository(TenantSetting);
    const setting = await settingRepo.findOne({ where: { key: KEY } });
    return setting ? Number(setting.value) : 0;
  }
}
