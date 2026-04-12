import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  InventoryAudit,
  InventoryAuditItem,
  InventoryAdjustment,
  Inventory,
  ProductVariant,
  Product,
  Branch,
  StorageLocation,
  InventoryLocation,
} from '@nivo/database';

@Injectable()
export class AuditsService {
  // ═══════════════════════════════════════════════════════════════════
  //  LIST & DETAIL
  // ═══════════════════════════════════════════════════════════════════

  async listAudits(
    connection: DataSource,
    filters: { branch_id?: string; status?: string; limit?: number; offset?: number },
  ) {
    const qb = connection.getRepository(InventoryAudit)
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.branch', 'branch')
      .leftJoinAndSelect('a.created_by', 'created_by')
      .leftJoinAndSelect('a.closed_by', 'closed_by')
      .leftJoin('a.items', 'items')
      .addSelect('COUNT(items.id)', 'item_count');

    if (filters.branch_id) qb.andWhere('a.branch_id = :bid', { bid: filters.branch_id });
    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });

    qb.groupBy('a.id')
      .addGroupBy('branch.id')
      .addGroupBy('created_by.id')
      .addGroupBy('closed_by.id')
      .orderBy('a.created_at', 'DESC');

    const total = await connection.getRepository(InventoryAudit)
      .createQueryBuilder('a')
      .where(filters.branch_id ? 'a.branch_id = :bid' : '1=1', { bid: filters.branch_id })
      .andWhere(filters.status ? 'a.status = :status' : '1=1', { status: filters.status })
      .getCount();

    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    const { entities, raw } = await qb.getRawAndEntities();

    return {
      data: entities.map((a, idx) => ({
        id: a.id,
        folio: `AUD-${String(a.folio_number).padStart(4, '0')}`,
        branch_name: a.branch?.name || '',
        branch_id: a.branch_id,
        type: a.type,
        status: a.status,
        branch_locked: a.branch_locked,
        created_by_name: a.created_by?.name || '',
        closed_by_name: a.closed_by?.name || null,
        started_at: a.started_at,
        completed_at: a.completed_at,
        created_at: a.created_at,
        item_count: parseInt(raw[idx]?.item_count || '0'),
      })),
      total,
    };
  }

  async getAuditDetail(connection: DataSource, auditId: string) {
    const audit = await connection.getRepository(InventoryAudit).findOne({
      where: { id: auditId },
      relations: ['branch', 'created_by', 'closed_by', 'items'],
    });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');

    const itemsWithDetails = await Promise.all(
      (audit.items || []).map(async (item) => {
        const variant = await connection.getRepository(ProductVariant)
          .createQueryBuilder('v')
          .leftJoinAndSelect('v.product', 'product')
          .where('v.id = :id', { id: item.variant_id })
          .getOne();

        const variantImages: string[] = variant?.images || [];
        const productImages: string[] = (variant?.product as any)?.images || [];
        const legacyImage: string | null = (variant?.product as any)?.image_url || null;
        const image_url = variantImages[0] || productImages[0] || legacyImage || null;

        let location_name: string | null = null;
        if (item.location_id) {
          const loc = await connection.getRepository(StorageLocation).findOne({ where: { id: item.location_id } });
          location_name = loc?.name || null;
        }

        return {
          id: item.id,
          variant_id: item.variant_id,
          location_id: item.location_id,
          location_name,
          expected_quantity: item.expected_quantity,
          counted_quantity: item.counted_quantity,
          difference: item.difference,
          item_status: item.item_status,
          adjustment_reason: item.adjustment_reason,
          unit_cost: item.unit_cost,
          financial_impact: item.difference !== null ? item.difference * Number(item.unit_cost) : null,
          product_name: variant?.product?.name || '',
          sku: variant?.sku || '',
          barcode: variant?.barcode || null,
          attributes: variant?.attributes || {},
          image_url,
        };
      }),
    );

    return {
      id: audit.id,
      folio: `AUD-${String(audit.folio_number).padStart(4, '0')}`,
      branch_id: audit.branch_id,
      branch_name: audit.branch?.name || '',
      type: audit.type,
      status: audit.status,
      branch_locked: audit.branch_locked,
      filter_criteria: audit.filter_criteria,
      notes: audit.notes,
      created_by_name: audit.created_by?.name || '',
      closed_by_name: audit.closed_by?.name || null,
      started_at: audit.started_at,
      completed_at: audit.completed_at,
      created_at: audit.created_at,
      items: itemsWithDetails,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CREATE AUDIT
  // ═══════════════════════════════════════════════════════════════════

  async createAudit(
    connection: DataSource,
    data: {
      branch_id: string;
      type: 'full' | 'partial';
      created_by_id: string;
      notes?: string;
      filter_criteria?: Record<string, string>;
    },
  ) {
    const branch = await connection.getRepository(Branch).findOne({ where: { id: data.branch_id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    // Prevent overlapping active audits on same branch
    const activeAudit = await connection.getRepository(InventoryAudit).findOne({
      where: { branch_id: data.branch_id, status: In(['draft', 'counting', 'review']) },
    });
    if (activeAudit) {
      throw new BadRequestException(
        `Ya existe una auditoría activa en esta sucursal (${`AUD-${String(activeAudit.folio_number).padStart(4, '0')}`})`,
      );
    }

    const repo = connection.getRepository(InventoryAudit);
    const audit = repo.create({
      branch_id: data.branch_id,
      type: data.type,
      status: 'draft',
      created_by_id: data.created_by_id,
      notes: data.notes || null,
      filter_criteria: data.filter_criteria || null,
    });
    const saved = await repo.save(audit);

    return {
      id: saved.id,
      folio: `AUD-${String(saved.folio_number).padStart(4, '0')}`,
      status: saved.status,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  START COUNTING — Snapshot expected quantities
  // ═══════════════════════════════════════════════════════════════════

  async startCounting(
    connection: DataSource,
    auditId: string,
    lockBranch: boolean,
  ) {
    const audit = await connection.getRepository(InventoryAudit).findOne({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');
    if (audit.status !== 'draft') {
      throw new BadRequestException('Solo se puede iniciar el conteo de auditorías en borrador');
    }

    return connection.transaction(async (manager) => {
      // Build inventory query — all variants with stock in this branch
      const invQb = manager.getRepository(Inventory)
        .createQueryBuilder('inv')
        .leftJoinAndSelect('inv.variant', 'variant')
        .leftJoinAndSelect('variant.product', 'product')
        .where('inv.branch_id = :bid', { bid: audit.branch_id });

      // Apply partial filters
      if (audit.type === 'partial' && audit.filter_criteria) {
        if (audit.filter_criteria.brand_id) {
          invQb.andWhere('product.brand_id = :brandId', { brandId: audit.filter_criteria.brand_id });
        }
        if (audit.filter_criteria.category_id) {
          invQb.andWhere('product.category_id = :catId', { catId: audit.filter_criteria.category_id });
        }
      }

      const inventoryRows = await invQb.getMany();

      if (inventoryRows.length === 0) {
        throw new BadRequestException('No hay inventario para auditar en esta sucursal con los filtros seleccionados');
      }

      // Create audit items — snapshot of expected quantities
      for (const inv of inventoryRows) {
        const item = manager.create(InventoryAuditItem, {
          audit_id: audit.id,
          variant_id: inv.variant_id,
          expected_quantity: inv.stock_available,
          counted_quantity: null,
          difference: null,
          item_status: 'pending',
          unit_cost: Number(inv.variant?.cost) || 0,
        });
        await manager.save(item);
      }

      // Update audit status
      audit.status = 'counting';
      audit.started_at = new Date();
      audit.branch_locked = lockBranch;
      await manager.save(audit);

      return {
        id: audit.id,
        status: 'counting',
        branch_locked: lockBranch,
        item_count: inventoryRows.length,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  COUNTING — Submit counts (blind count)
  // ═══════════════════════════════════════════════════════════════════

  /** Submit count for a single item (scan by barcode/sku) */
  async submitCount(
    connection: DataSource,
    data: { audit_id: string; variant_id: string; counted_quantity: number },
  ) {
    const audit = await connection.getRepository(InventoryAudit).findOne({
      where: { id: data.audit_id },
    });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');
    if (audit.status !== 'counting') {
      throw new BadRequestException('La auditoría no está en fase de conteo');
    }

    const itemRepo = connection.getRepository(InventoryAuditItem);
    const item = await itemRepo.findOne({
      where: { audit_id: data.audit_id, variant_id: data.variant_id },
    });
    if (!item) throw new NotFoundException('Artículo no encontrado en esta auditoría');

    if (item.item_status !== 'pending' && item.item_status !== 'recount') {
      throw new BadRequestException('Este artículo ya fue contado y aceptado');
    }

    item.counted_quantity = data.counted_quantity;
    item.difference = data.counted_quantity - item.expected_quantity;
    item.item_status = 'counted';

    await itemRepo.save(item);

    return {
      id: item.id,
      variant_id: item.variant_id,
      counted_quantity: item.counted_quantity,
      item_status: item.item_status,
    };
  }

  /** Scan barcode → find variant in audit and increment count */
  async scanBarcode(
    connection: DataSource,
    data: { audit_id: string; barcode: string },
  ) {
    const audit = await connection.getRepository(InventoryAudit).findOne({
      where: { id: data.audit_id },
    });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');
    if (audit.status !== 'counting') {
      throw new BadRequestException('La auditoría no está en fase de conteo');
    }

    // Find variant by barcode or sku
    const variant = await connection.getRepository(ProductVariant).findOne({
      where: [
        { barcode: data.barcode },
        { sku: data.barcode },
      ],
      relations: ['product'],
    });
    if (!variant) throw new NotFoundException('Código no encontrado en el catálogo');

    const itemRepo = connection.getRepository(InventoryAuditItem);
    let item = await itemRepo.findOne({
      where: { audit_id: data.audit_id, variant_id: variant.id },
    });

    if (!item) {
      // Variant exists in catalog but wasn't in inventory snapshot — create as "surprise" item
      item = itemRepo.create({
        audit_id: data.audit_id,
        variant_id: variant.id,
        expected_quantity: 0,
        counted_quantity: 1,
        difference: 1,
        item_status: 'counted',
        unit_cost: Number(variant.cost) || 0,
      });
      await itemRepo.save(item);
    } else {
      if (item.item_status === 'accepted') {
        throw new BadRequestException('Este artículo ya fue cerrado por el gerente');
      }
      item.counted_quantity = (item.counted_quantity || 0) + 1;
      item.difference = item.counted_quantity - item.expected_quantity;
      item.item_status = 'counted';
      await itemRepo.save(item);
    }

    const variantImages: string[] = variant.images || [];
    const productImages: string[] = (variant.product as any)?.images || [];
    const legacyImage: string | null = (variant.product as any)?.image_url || null;
    const image_url = variantImages[0] || productImages[0] || legacyImage || null;

    return {
      id: item.id,
      variant_id: variant.id,
      product_name: variant.product?.name || '',
      sku: variant.sku,
      attributes: variant.attributes || {},
      image_url,
      counted_quantity: item.counted_quantity,
      item_status: item.item_status,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FINISH COUNTING → move to REVIEW
  // ═══════════════════════════════════════════════════════════════════

  async finishCounting(connection: DataSource, auditId: string) {
    const audit = await connection.getRepository(InventoryAudit).findOne({
      where: { id: auditId },
      relations: ['items'],
    });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');
    if (audit.status !== 'counting') {
      throw new BadRequestException('La auditoría no está en fase de conteo');
    }

    // Mark any uncounted items as counted with quantity 0
    const itemRepo = connection.getRepository(InventoryAuditItem);
    for (const item of audit.items) {
      if (item.counted_quantity === null) {
        item.counted_quantity = 0;
        item.difference = 0 - item.expected_quantity;
        item.item_status = 'counted';
        await itemRepo.save(item);
      }
    }

    audit.status = 'review';
    await connection.getRepository(InventoryAudit).save(audit);

    return { id: audit.id, status: 'review' };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  REVIEW — Manager actions on discrepancies
  // ═══════════════════════════════════════════════════════════════════

  /** Request a recount on an item — resets for employee to re-count */
  async requestRecount(connection: DataSource, itemId: string) {
    const itemRepo = connection.getRepository(InventoryAuditItem);
    const item = await itemRepo.findOne({ where: { id: itemId }, relations: ['audit'] });
    if (!item) throw new NotFoundException('Artículo no encontrado');
    if (item.audit.status !== 'review') {
      throw new BadRequestException('La auditoría no está en fase de revisión');
    }

    item.counted_quantity = null;
    item.difference = null;
    item.item_status = 'recount';
    item.adjustment_reason = null;
    await itemRepo.save(item);

    // Move audit back to counting so employee can access scan screen
    const auditRepo = connection.getRepository(InventoryAudit);
    if (item.audit.status === 'review') {
      item.audit.status = 'counting';
      await auditRepo.save(item.audit);
    }

    return { id: item.id, item_status: 'recount' };
  }

  /** Accept a discrepancy with a reason */
  async acceptDiscrepancy(
    connection: DataSource,
    data: { item_id: string; reason: string },
  ) {
    const itemRepo = connection.getRepository(InventoryAuditItem);
    const item = await itemRepo.findOne({ where: { id: data.item_id }, relations: ['audit'] });
    if (!item) throw new NotFoundException('Artículo no encontrado');
    if (item.audit.status !== 'review' && item.audit.status !== 'counting') {
      throw new BadRequestException('La auditoría no está en fase de revisión');
    }

    item.item_status = 'accepted';
    item.adjustment_reason = data.reason;
    await itemRepo.save(item);

    return { id: item.id, item_status: 'accepted', adjustment_reason: data.reason };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CLOSE & APPLY — The big finale
  // ═══════════════════════════════════════════════════════════════════

  async closeAndApply(
    connection: DataSource,
    data: { audit_id: string; closed_by_id: string },
  ) {
    const audit = await connection.getRepository(InventoryAudit).findOne({
      where: { id: data.audit_id },
      relations: ['items'],
    });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');
    if (audit.status !== 'review') {
      throw new BadRequestException('La auditoría debe estar en revisión para cerrarla');
    }

    // Check all items with discrepancies are resolved
    const unresolvedItems = audit.items.filter(
      (item) => item.difference !== 0 && item.item_status !== 'accepted',
    );
    if (unresolvedItems.length > 0) {
      throw new BadRequestException(
        `Hay ${unresolvedItems.length} discrepancia(s) sin resolver. Acepte o solicite reconteo para cada una.`,
      );
    }

    return connection.transaction(async (manager) => {
      for (const item of audit.items) {
        if (item.difference === null || item.difference === 0) continue;

        // 1. Update inventory to match counted quantity
        let inventory = await manager.findOne(Inventory, {
          where: { variant_id: item.variant_id, branch_id: audit.branch_id },
        });

        if (inventory) {
          inventory.stock_available = item.counted_quantity ?? 0;
          await manager.save(inventory);
        } else if ((item.counted_quantity ?? 0) > 0) {
          // Surplus item that wasn't in inventory
          inventory = manager.create(Inventory, {
            variant_id: item.variant_id,
            branch_id: audit.branch_id,
            stock_available: item.counted_quantity ?? 0,
          });
          await manager.save(inventory);
        }

        // 2. Clear InventoryLocation rows and reset (simplified: remove all locations for this variant/branch)
        // Items will appear as "unlocated" after audit, manager can re-assign
        if (item.difference < 0) {
          const locRepo = manager.getRepository(InventoryLocation);
          const locations = await locRepo.find({
            where: { variant_id: item.variant_id, branch_id: audit.branch_id },
            order: { quantity: 'DESC' },
          });
          let remaining = Math.abs(item.difference);
          for (const loc of locations) {
            if (remaining <= 0) break;
            const deduct = Math.min(loc.quantity, remaining);
            loc.quantity -= deduct;
            remaining -= deduct;
            if (loc.quantity <= 0) {
              await locRepo.remove(loc);
            } else {
              await locRepo.save(loc);
            }
          }
        }

        // 3. Create adjustment record
        const adjustment = manager.create(InventoryAdjustment, {
          audit_id: audit.id,
          variant_id: item.variant_id,
          branch_id: audit.branch_id,
          reason: item.adjustment_reason || (item.difference > 0 ? 'surplus' : 'shrinkage'),
          quantity: item.difference,
          financial_impact: item.difference * Number(item.unit_cost),
          approved_by_id: data.closed_by_id,
          notes: `Auditoría ${`AUD-${String(audit.folio_number).padStart(4, '0')}`}`,
        });
        await manager.save(adjustment);
      }

      // Mark audit as completed and unlock branch
      audit.status = 'completed';
      audit.completed_at = new Date();
      audit.closed_by_id = data.closed_by_id;
      audit.branch_locked = false;
      await manager.save(audit);

      return { id: audit.id, status: 'completed' };
    });
  }

  /** Cancel a draft or counting audit */
  async cancelAudit(connection: DataSource, auditId: string) {
    const repo = connection.getRepository(InventoryAudit);
    const audit = await repo.findOne({ where: { id: auditId } });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');
    if (audit.status === 'completed' || audit.status === 'cancelled') {
      throw new BadRequestException('No se puede cancelar esta auditoría');
    }
    audit.status = 'cancelled';
    audit.branch_locked = false;
    await repo.save(audit);
    return { id: audit.id, status: 'cancelled' };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CHECK BRANCH LOCK (used by POS/Transfers middleware)
  // ═══════════════════════════════════════════════════════════════════

  async isBranchLocked(connection: DataSource, branchId: string): Promise<boolean> {
    const locked = await connection.getRepository(InventoryAudit).findOne({
      where: { branch_id: branchId, branch_locked: true, status: In(['counting', 'review']) },
    });
    return !!locked;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KPIs
  // ═══════════════════════════════════════════════════════════════════

  async getKpis(connection: DataSource, filters?: { branch_id?: string }) {
    const auditRepo = connection.getRepository(InventoryAudit);
    const adjRepo = connection.getRepository(InventoryAdjustment);

    // Last completed audit
    const lastAuditQb = auditRepo.createQueryBuilder('a')
      .where("a.status = 'completed'")
      .orderBy('a.completed_at', 'DESC')
      .take(1);
    if (filters?.branch_id) lastAuditQb.andWhere('a.branch_id = :bid', { bid: filters.branch_id });
    const lastAudit = await lastAuditQb.getOne();

    let daysSinceLastAudit: number | null = null;
    if (lastAudit?.completed_at) {
      const diff = Date.now() - new Date(lastAudit.completed_at).getTime();
      daysSinceLastAudit = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    // Historical accuracy — from all completed audits
    const accuracyQb = connection.getRepository(InventoryAuditItem)
      .createQueryBuilder('ai')
      .leftJoin('ai.audit', 'a')
      .where("a.status = 'completed'")
      .select('SUM(ai.expected_quantity)', 'total_expected')
      .addSelect('SUM(ai.counted_quantity)', 'total_counted');
    if (filters?.branch_id) accuracyQb.andWhere('a.branch_id = :bid', { bid: filters.branch_id });
    const accuracyRaw = await accuracyQb.getRawOne();

    const totalExpected = parseFloat(accuracyRaw?.total_expected || '0');
    const totalCounted = parseFloat(accuracyRaw?.total_counted || '0');
    let accuracy: number | null = null;
    if (totalExpected > 0) {
      accuracy = Math.round((Math.min(totalCounted, totalExpected) / totalExpected) * 10000) / 100;
    }

    // Year-to-date shrinkage (negative adjustments)
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const shrinkageQb = adjRepo.createQueryBuilder('adj')
      .select('COALESCE(SUM(adj.financial_impact), 0)', 'total')
      .where('adj.quantity < 0')
      .andWhere('adj.created_at >= :yearStart', { yearStart: yearStart.toISOString() });
    if (filters?.branch_id) shrinkageQb.andWhere('adj.branch_id = :bid', { bid: filters.branch_id });
    const shrinkageRaw = await shrinkageQb.getRawOne();

    return {
      days_since_last_audit: daysSinceLastAudit,
      accuracy_percentage: accuracy,
      ytd_shrinkage: parseFloat(shrinkageRaw?.total || '0'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  COUNTING PROGRESS — for the counting screen
  // ═══════════════════════════════════════════════════════════════════

  async getCountingProgress(connection: DataSource, auditId: string) {
    const audit = await connection.getRepository(InventoryAudit).findOne({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Auditoría no encontrada');

    const itemRepo = connection.getRepository(InventoryAuditItem);

    const total = await itemRepo.count({ where: { audit_id: auditId } });
    const counted = await itemRepo.count({
      where: { audit_id: auditId, item_status: In(['counted', 'accepted']) },
    });
    const pending = await itemRepo.count({
      where: { audit_id: auditId, item_status: In(['pending', 'recount']) },
    });

    // Return recently counted items for the live list
    const recentItems = await itemRepo.createQueryBuilder('ai')
      .leftJoinAndSelect('ai.variant', 'variant')
      .leftJoinAndSelect('variant.product', 'product')
      .where('ai.audit_id = :aid', { aid: auditId })
      .andWhere('ai.counted_quantity IS NOT NULL')
      .orderBy('ai.counted_quantity', 'DESC')
      .take(50)
      .getMany();

    return {
      id: audit.id,
      status: audit.status,
      total_items: total,
      counted_items: counted,
      pending_items: pending,
      progress_percentage: total > 0 ? Math.round((counted / total) * 100) : 0,
      items: recentItems.map((item) => {
        const v = item.variant;
        const variantImages: string[] = v?.images || [];
        const productImages: string[] = (v?.product as any)?.images || [];
        const legacyImage: string | null = (v?.product as any)?.image_url || null;

        return {
          id: item.id,
          variant_id: item.variant_id,
          product_name: v?.product?.name || '',
          sku: v?.sku || '',
          barcode: v?.barcode || null,
          attributes: v?.attributes || {},
          image_url: variantImages[0] || productImages[0] || legacyImage || null,
          counted_quantity: item.counted_quantity,
          item_status: item.item_status,
        };
      }),
    };
  }
}
