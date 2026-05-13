import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import {
  PurchaseRequisition,
  RequisitionItem,
  Inventory,
  ProductVariant,
  VariantSupplier,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  Product,
} from '@nivo/database';

@Injectable()
export class RequisitionsService {
  private readonly logger = new Logger(RequisitionsService.name);

  constructor(private readonly config: ConfigService) {}

  // ═══════════════════════════════════════════════════════════════════
  // DRAFT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get or create the active draft requisition for a branch.
   * Only ONE draft exists per branch at any time.
   */
  async getOrCreateDraft(connection: DataSource, branchId: string): Promise<PurchaseRequisition> {
    const repo = connection.getRepository(PurchaseRequisition);

    let draft = await repo.findOne({
      where: { branch_id: branchId, status: 'draft' },
      relations: ['items', 'items.variant', 'items.variant.product', 'items.supplier', 'branch'],
    });

    if (!draft) {
      draft = repo.create({ branch_id: branchId, status: 'draft' });
      draft = await repo.save(draft);
      draft.items = [];
    }

    return draft;
  }

  /**
   * Called asynchronously after a sale. Evaluates if stock fell below min
   * and adds/updates items in the active draft.
   */
  async evaluateStockAfterSale(
    connection: DataSource,
    branchId: string,
    variantIds: string[],
  ): Promise<void> {
    try {
      const inventoryRepo = connection.getRepository(Inventory);

      // Get inventory levels for the sold variants
      const inventories = await inventoryRepo.find({
        where: { branch_id: branchId, variant_id: In(variantIds) },
      });

      const belowMin = inventories.filter(
        (inv) => inv.stock_available <= inv.stock_minimum,
      );

      if (belowMin.length === 0) return;

      // Get the active draft (or create one)
      const draft = await this.getOrCreateDraft(connection, branchId);
      const itemRepo = connection.getRepository(RequisitionItem);
      const vsRepo = connection.getRepository(VariantSupplier);
      const variantRepo = connection.getRepository(ProductVariant);

      for (const inv of belowMin) {
        const suggestedQty = Math.max(1, inv.stock_maximum - inv.stock_available);

        // Find default supplier for this variant
        const defaultSupplier = await vsRepo.findOne({
          where: { variant_id: inv.variant_id, is_default: true },
        });

        const variant = await variantRepo.findOne({ where: { id: inv.variant_id } });

        // Check if this variant already exists in the draft
        let existingItem = await itemRepo.findOne({
          where: { requisition_id: draft.id, variant_id: inv.variant_id },
        });

        if (existingItem) {
          // Update with fresh calculation
          existingItem.suggested_quantity = suggestedQty;
          existingItem.current_stock = inv.stock_available;
          existingItem.max_stock = inv.stock_maximum;
          existingItem.estimated_cost = defaultSupplier?.last_cost || Number(variant?.cost || 0);
          existingItem.supplier_id = defaultSupplier?.supplier_id || null;
          existingItem.supplier_sku = defaultSupplier?.supplier_sku || null;
          await itemRepo.save(existingItem);
        } else {
          // Add new item to draft
          const newItem = itemRepo.create({
            requisition_id: draft.id,
            variant_id: inv.variant_id,
            suggested_quantity: suggestedQty,
            current_stock: inv.stock_available,
            max_stock: inv.stock_maximum,
            estimated_cost: defaultSupplier?.last_cost || Number(variant?.cost || 0),
            supplier_id: defaultSupplier?.supplier_id || null,
            supplier_sku: defaultSupplier?.supplier_sku || null,
          });
          await itemRepo.save(newItem);
        }
      }

      // Update totals on the draft
      await this.recalculateTotals(connection, draft.id);

      this.logger.log(`Draft REQ updated for branch ${branchId}: ${belowMin.length} items evaluated`);
    } catch (error) {
      this.logger.error(`Error evaluating stock after sale: ${error}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIST & DETAIL
  // ═══════════════════════════════════════════════════════════════════

  async listRequisitions(
    connection: DataSource,
    filters: { branch_id?: string; status?: string; limit?: number; offset?: number },
  ) {
    const repo = connection.getRepository(PurchaseRequisition);
    const qb = repo.createQueryBuilder('req')
      .leftJoinAndSelect('req.branch', 'branch')
      .leftJoinAndSelect('req.locked_by', 'locked_by')
      .leftJoinAndSelect('req.approved_by', 'approved_by')
      .loadRelationCountAndMap('req.item_count', 'req.items');

    if (filters.branch_id) qb.andWhere('req.branch_id = :branchId', { branchId: filters.branch_id });
    if (filters.status) qb.andWhere('req.status = :status', { status: filters.status });

    qb.orderBy('req.created_at', 'DESC');
    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getRequisitionDetail(connection: DataSource, id: string) {
    const repo = connection.getRepository(PurchaseRequisition);
    const req = await repo.findOne({
      where: { id },
      relations: [
        'items',
        'items.variant',
        'items.variant.product',
        'items.supplier',
        'branch',
        'locked_by',
        'approved_by',
      ],
      order: { items: { variant: { product: { name: 'ASC' } } } },
    });

    if (!req) throw new Error('Requisición no encontrada');
    return req;
  }

  // ═══════════════════════════════════════════════════════════════════
  // MANUAL ITEM MANAGEMENT (add/remove items while draft)
  // ═══════════════════════════════════════════════════════════════════

  async addItemToDraft(
    connection: DataSource,
    requisitionId: string,
    data: { variant_id: string; quantity: number; supplier_id?: string },
  ) {
    const reqRepo = connection.getRepository(PurchaseRequisition);
    const req = await reqRepo.findOne({ where: { id: requisitionId } });
    if (!req || req.status !== 'draft') throw new Error('Solo se pueden editar requisiciones en borrador');

    const itemRepo = connection.getRepository(RequisitionItem);
    const invRepo = connection.getRepository(Inventory);
    const vsRepo = connection.getRepository(VariantSupplier);
    const variantRepo = connection.getRepository(ProductVariant);

    // Get current stock info
    const inventory = await invRepo.findOne({
      where: { variant_id: data.variant_id, branch_id: req.branch_id },
    });
    const variant = await variantRepo.findOne({ where: { id: data.variant_id } });

    // Default supplier
    let supplierId = data.supplier_id || null;
    let supplierSku: string | null = null;
    let estimatedCost = Number(variant?.cost || 0);

    if (!supplierId) {
      const defaultVs = await vsRepo.findOne({ where: { variant_id: data.variant_id, is_default: true } });
      if (defaultVs) {
        supplierId = defaultVs.supplier_id;
        supplierSku = defaultVs.supplier_sku;
        estimatedCost = Number(defaultVs.last_cost) || estimatedCost;
      }
    } else {
      const vs = await vsRepo.findOne({ where: { variant_id: data.variant_id, supplier_id: supplierId } });
      if (vs) {
        supplierSku = vs.supplier_sku;
        estimatedCost = Number(vs.last_cost) || estimatedCost;
      }
    }

    // Check if item already exists
    let item = await itemRepo.findOne({
      where: { requisition_id: requisitionId, variant_id: data.variant_id },
    });

    if (item) {
      item.suggested_quantity = data.quantity;
      item.current_stock = inventory?.stock_available || 0;
      item.max_stock = inventory?.stock_maximum || 0;
      item.estimated_cost = estimatedCost;
      item.supplier_id = supplierId;
      item.supplier_sku = supplierSku;
    } else {
      item = itemRepo.create({
        requisition_id: requisitionId,
        variant_id: data.variant_id,
        suggested_quantity: data.quantity,
        current_stock: inventory?.stock_available || 0,
        max_stock: inventory?.stock_maximum || 0,
        estimated_cost: estimatedCost,
        supplier_id: supplierId,
        supplier_sku: supplierSku,
      });
    }

    await itemRepo.save(item);
    await this.recalculateTotals(connection, requisitionId);
    return this.getRequisitionDetail(connection, requisitionId);
  }

  async removeItemFromDraft(connection: DataSource, requisitionId: string, itemId: string) {
    const reqRepo = connection.getRepository(PurchaseRequisition);
    const req = await reqRepo.findOne({ where: { id: requisitionId } });
    if (!req || req.status !== 'draft') throw new Error('Solo se pueden editar requisiciones en borrador');

    const itemRepo = connection.getRepository(RequisitionItem);
    await itemRepo.delete({ id: itemId, requisition_id: requisitionId });
    await this.recalculateTotals(connection, requisitionId);
    return this.getRequisitionDetail(connection, requisitionId);
  }

  async updateItemQuantity(
    connection: DataSource,
    requisitionId: string,
    itemId: string,
    data: { override_quantity?: number | null; supplier_id?: string },
  ) {
    const reqRepo = connection.getRepository(PurchaseRequisition);
    const req = await reqRepo.findOne({ where: { id: requisitionId } });
    if (!req || req.status === 'approved') throw new Error('No se puede editar una requisición aprobada');

    const itemRepo = connection.getRepository(RequisitionItem);
    const item = await itemRepo.findOne({ where: { id: itemId, requisition_id: requisitionId } });
    if (!item) throw new Error('Ítem no encontrado');

    if (data.override_quantity !== undefined) {
      item.override_quantity = data.override_quantity;
    }
    if (data.supplier_id !== undefined) {
      item.supplier_id = data.supplier_id;
      // Update supplier sku and cost
      const vsRepo = connection.getRepository(VariantSupplier);
      const vs = await vsRepo.findOne({ where: { variant_id: item.variant_id, supplier_id: data.supplier_id } });
      if (vs) {
        item.supplier_sku = vs.supplier_sku;
        item.estimated_cost = Number(vs.last_cost) || item.estimated_cost;
      }
    }

    await itemRepo.save(item);
    await this.recalculateTotals(connection, requisitionId);
    return this.getRequisitionDetail(connection, requisitionId);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE MACHINE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * LOCK: Freeze the draft for manager review.
   * New stock drops will create a fresh draft for the next cycle.
   */
  async lockRequisition(connection: DataSource, id: string, employeeId: string) {
    const repo = connection.getRepository(PurchaseRequisition);
    const req = await repo.findOne({ where: { id }, relations: ['items'] });
    if (!req) throw new Error('Requisición no encontrada');
    if (req.status !== 'draft') throw new Error('Solo se pueden bloquear requisiciones en borrador');
    if (!req.items || req.items.length === 0) throw new Error('No se puede bloquear una requisición vacía');

    // Refresh all item quantities with current stock before locking
    const invRepo = connection.getRepository(Inventory);
    const itemRepo = connection.getRepository(RequisitionItem);

    for (const item of req.items) {
      const inv = await invRepo.findOne({
        where: { variant_id: item.variant_id, branch_id: req.branch_id },
      });
      if (inv) {
        item.current_stock = inv.stock_available;
        item.suggested_quantity = Math.max(1, inv.stock_maximum - inv.stock_available);
        item.max_stock = inv.stock_maximum;
        await itemRepo.save(item);
      }
    }

    req.status = 'locked';
    req.locked_by_id = employeeId;
    req.locked_at = new Date();
    await repo.save(req);

    await this.recalculateTotals(connection, id);
    return this.getRequisitionDetail(connection, id);
  }

  /**
   * UNLOCK: Return to draft for further editing.
   */
  async unlockRequisition(connection: DataSource, id: string) {
    const repo = connection.getRepository(PurchaseRequisition);
    const req = await repo.findOne({ where: { id } });
    if (!req) throw new Error('Requisición no encontrada');
    if (req.status !== 'locked') throw new Error('Solo se pueden desbloquear requisiciones bloqueadas');

    req.status = 'draft';
    req.locked_by_id = null;
    req.locked_at = null;
    await repo.save(req);

    return this.getRequisitionDetail(connection, id);
  }

  /**
   * APPROVE: Split the requisition into Purchase Orders by supplier
   * and optionally fire webhooks to n8n.
   */
  async approveRequisition(
    connection: DataSource,
    id: string,
    employeeId: string,
  ): Promise<{ requisition: PurchaseRequisition; purchase_orders: PurchaseOrder[] }> {
    return connection.transaction(async (manager) => {
      const reqRepo = manager.getRepository(PurchaseRequisition);
      const req = await reqRepo.findOne({
        where: { id },
        relations: ['items', 'items.variant', 'items.variant.product', 'items.supplier', 'branch'],
      });
      if (!req) throw new Error('Requisición no encontrada');
      if (req.status !== 'locked') throw new Error('Solo se pueden aprobar requisiciones bloqueadas');
      if (!req.items || req.items.length === 0) throw new Error('Requisición sin ítems');

      // ─── Group items by supplier ────────────────────────────
      const supplierGroups = new Map<string, RequisitionItem[]>();
      const noSupplierItems: RequisitionItem[] = [];

      for (const item of req.items) {
        if (item.supplier_id) {
          const group = supplierGroups.get(item.supplier_id) || [];
          group.push(item);
          supplierGroups.set(item.supplier_id, group);
        } else {
          noSupplierItems.push(item);
        }
      }

      // Items without supplier go into a "sin proveedor" group — skip PO generation for these
      if (noSupplierItems.length > 0) {
        this.logger.warn(
          `Requisition ${req.folio}: ${noSupplierItems.length} items have no supplier assigned — skipped for PO generation`,
        );
      }

      // ─── Create Purchase Orders per supplier ────────────────
      const createdPOs: PurchaseOrder[] = [];
      const poRepo = manager.getRepository(PurchaseOrder);
      const poItemRepo = manager.getRepository(PurchaseOrderItem);

      for (const [supplierId, items] of supplierGroups) {
        const po = poRepo.create({
          supplier_id: supplierId,
          branch_id: req.branch_id,
          status: 'draft',
          created_by_id: employeeId,
          requisition_id: req.id,
          notes: `Generada automáticamente desde ${req.folio}`,
        });

        const savedPO = await poRepo.save(po);

        let totalCost = 0;
        for (const item of items) {
          const qty = item.override_quantity ?? item.suggested_quantity;
          const cost = Number(item.estimated_cost);
          const poItem = poItemRepo.create({
            purchase_order_id: savedPO.id,
            variant_id: item.variant_id,
            ordered_quantity: qty,
            unit_cost: cost,
          });
          await poItemRepo.save(poItem);
          totalCost += qty * cost;
        }

        savedPO.total_cost = totalCost;
        await poRepo.save(savedPO);
        createdPOs.push(savedPO);
      }

      // ─── Mark requisition as approved ───────────────────────
      req.status = 'approved';
      req.approved_by_id = employeeId;
      req.approved_at = new Date();
      await reqRepo.save(req);

      // ─── Fire n8n webhooks (non-blocking) ───────────────────
      this.fireWebhooks(connection, createdPOs, req);

      const updatedReq = await this.getRequisitionDetail(connection, id);
      return { requisition: updatedReq, purchase_orders: createdPOs };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // GENERATE REQUISITION FROM CURRENT STOCK LEVELS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Scan all inventory in a branch and populate the draft with items
   * where stock_available <= stock_minimum. Useful for manual "check all" action.
   */
  async generateDraftFromStock(connection: DataSource, branchId: string) {
    const invRepo = connection.getRepository(Inventory);
    const belowMin = await invRepo
      .createQueryBuilder('inv')
      .where('inv.branch_id = :branchId', { branchId })
      .andWhere('inv.stock_available <= inv.stock_minimum')
      .getMany();

    if (belowMin.length === 0) {
      return { message: 'Todo el inventario está por encima del mínimo', items_added: 0 };
    }

    const draft = await this.getOrCreateDraft(connection, branchId);
    const itemRepo = connection.getRepository(RequisitionItem);
    const vsRepo = connection.getRepository(VariantSupplier);
    const variantRepo = connection.getRepository(ProductVariant);

    let added = 0;
    for (const inv of belowMin) {
      // Check if already in draft
      const existing = await itemRepo.findOne({
        where: { requisition_id: draft.id, variant_id: inv.variant_id },
      });
      if (existing) {
        // Update suggested quantity with fresh data
        existing.suggested_quantity = Math.max(1, inv.stock_maximum - inv.stock_available);
        existing.current_stock = inv.stock_available;
        existing.max_stock = inv.stock_maximum;
        await itemRepo.save(existing);
        continue;
      }

      const defaultVs = await vsRepo.findOne({ where: { variant_id: inv.variant_id, is_default: true } });
      const variant = await variantRepo.findOne({ where: { id: inv.variant_id } });

      const item = itemRepo.create({
        requisition_id: draft.id,
        variant_id: inv.variant_id,
        suggested_quantity: Math.max(1, inv.stock_maximum - inv.stock_available),
        current_stock: inv.stock_available,
        max_stock: inv.stock_maximum,
        estimated_cost: defaultVs?.last_cost ? Number(defaultVs.last_cost) : Number(variant?.cost || 0),
        supplier_id: defaultVs?.supplier_id || null,
        supplier_sku: defaultVs?.supplier_sku || null,
      });
      await itemRepo.save(item);
      added++;
    }

    await this.recalculateTotals(connection, draft.id);
    return { draft_id: draft.id, items_added: added, total_below_min: belowMin.length };
  }

  // ═══════════════════════════════════════════════════════════════════
  // VARIANT SUPPLIER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  async getVariantSuppliers(connection: DataSource, variantId: string) {
    const repo = connection.getRepository(VariantSupplier);
    return repo.find({
      where: { variant_id: variantId },
      relations: ['supplier'],
      order: { is_default: 'DESC', created_at: 'ASC' },
    });
  }

  async setVariantSuppliers(
    connection: DataSource,
    variantId: string,
    suppliers: Array<{ supplier_id: string; supplier_sku?: string; last_cost?: number; is_default?: boolean }>,
  ) {
    return connection.transaction(async (manager) => {
      const repo = manager.getRepository(VariantSupplier);

      // Remove existing
      await repo.delete({ variant_id: variantId });

      // Ensure only one default
      let hasDefault = false;
      const records = suppliers.map((s, i) => {
        const isDefault = s.is_default && !hasDefault;
        if (isDefault) hasDefault = true;
        return repo.create({
          variant_id: variantId,
          supplier_id: s.supplier_id,
          supplier_sku: s.supplier_sku || null,
          last_cost: s.last_cost || 0,
          is_default: isDefault || (i === 0 && !hasDefault),
        });
      });

      if (records.length > 0) {
        await repo.save(records);
      }

      return repo.find({ where: { variant_id: variantId }, relations: ['supplier'] });
    });
  }

  /** Set suppliers in batch for all variants of a product */
  async setProductDefaultSupplier(
    connection: DataSource,
    productId: string,
    supplierId: string,
    data?: { supplier_sku_prefix?: string; last_cost?: number },
  ) {
    const variantRepo = connection.getRepository(ProductVariant);
    const vsRepo = connection.getRepository(VariantSupplier);

    const variants = await variantRepo.find({ where: { product_id: productId } });

    for (const variant of variants) {
      // Unset previous defaults for this variant
      await vsRepo.update({ variant_id: variant.id }, { is_default: false });

      // Upsert the new default
      let vs = await vsRepo.findOne({ where: { variant_id: variant.id, supplier_id: supplierId } });
      if (vs) {
        vs.is_default = true;
        if (data?.last_cost) vs.last_cost = data.last_cost;
        if (data?.supplier_sku_prefix) vs.supplier_sku = `${data.supplier_sku_prefix}-${variant.sku}`;
      } else {
        vs = vsRepo.create({
          variant_id: variant.id,
          supplier_id: supplierId,
          is_default: true,
          last_cost: data?.last_cost || Number(variant.cost) || 0,
          supplier_sku: data?.supplier_sku_prefix ? `${data.supplier_sku_prefix}-${variant.sku}` : null,
        });
      }
      await vsRepo.save(vs);
    }

    return { updated: variants.length };
  }

  // ═══════════════════════════════════════════════════════════════════
  // INVENTORY LEVELS (min/max stock)
  // ═══════════════════════════════════════════════════════════════════

  async updateInventoryLevels(
    connection: DataSource,
    data: { variant_id: string; branch_id: string; stock_minimum?: number; stock_maximum?: number },
  ) {
    const repo = connection.getRepository(Inventory);
    let inv = await repo.findOne({
      where: { variant_id: data.variant_id, branch_id: data.branch_id },
    });

    if (!inv) {
      inv = repo.create({
        variant_id: data.variant_id,
        branch_id: data.branch_id,
        stock_available: 0,
        stock_minimum: data.stock_minimum ?? 5,
        stock_maximum: data.stock_maximum ?? 20,
      });
    } else {
      if (data.stock_minimum !== undefined) inv.stock_minimum = data.stock_minimum;
      if (data.stock_maximum !== undefined) inv.stock_maximum = data.stock_maximum;
    }

    return repo.save(inv);
  }

  async bulkUpdateInventoryLevels(
    connection: DataSource,
    branchId: string,
    items: Array<{ variant_id: string; stock_minimum: number; stock_maximum: number }>,
  ) {
    const repo = connection.getRepository(Inventory);

    for (const item of items) {
      let inv = await repo.findOne({
        where: { variant_id: item.variant_id, branch_id: branchId },
      });

      if (!inv) {
        inv = repo.create({
          variant_id: item.variant_id,
          branch_id: branchId,
          stock_available: 0,
          stock_minimum: item.stock_minimum,
          stock_maximum: item.stock_maximum,
        });
      } else {
        inv.stock_minimum = item.stock_minimum;
        inv.stock_maximum = item.stock_maximum;
      }

      await repo.save(inv);
    }

    return { updated: items.length };
  }

  // ═══════════════════════════════════════════════════════════════════
  // N8N WEBHOOK INTEGRATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Fire webhooks to n8n for each generated PO.
   * Non-blocking — failures are logged but don't break the flow.
   */
  private async fireWebhooks(
    connection: DataSource,
    purchaseOrders: PurchaseOrder[],
    requisition: PurchaseRequisition,
  ) {
    const webhookUrl = this.config.get<string>('N8N_PURCHASE_ORDER_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.log('N8N_PURCHASE_ORDER_WEBHOOK_URL not configured — skipping webhook dispatch');
      return;
    }

    const supplierRepo = connection.getRepository(Supplier);
    const poItemRepo = connection.getRepository(PurchaseOrderItem);
    const variantRepo = connection.getRepository(ProductVariant);
    const vsRepo = connection.getRepository(VariantSupplier);

    for (const po of purchaseOrders) {
      try {
        const supplier = await supplierRepo.findOne({ where: { id: po.supplier_id } });
        const items = await poItemRepo.find({
          where: { purchase_order_id: po.id },
          relations: ['variant', 'variant.product'],
        });

        const payload = {
          purchase_order_id: po.id,
          folio: po.folio,
          requisition_folio: requisition.folio,
          supplier: {
            id: supplier?.id,
            name: supplier?.name,
            email: supplier?.email,
            phone: supplier?.phone,
            tax_id: supplier?.tax_id,
          },
          branch: {
            id: requisition.branch?.id,
            name: requisition.branch?.name,
          },
          items: await Promise.all(
            items.map(async (item) => {
              const vs = await vsRepo.findOne({
                where: { variant_id: item.variant_id, supplier_id: po.supplier_id },
              });
              return {
                variant_id: item.variant_id,
                sku: item.variant?.sku,
                supplier_sku: vs?.supplier_sku || null,
                product_name: item.variant?.product?.name,
                attributes: item.variant?.attributes,
                ordered_quantity: item.ordered_quantity,
                unit_cost: Number(item.unit_cost),
                subtotal: item.ordered_quantity * Number(item.unit_cost),
              };
            }),
          ),
          total_cost: Number(po.total_cost),
          created_at: po.created_at,
        };

        // Fire and forget
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((res) => {
            this.logger.log(`Webhook sent for PO ${po.folio}: HTTP ${res.status}`);
          })
          .catch((err) => {
            this.logger.error(`Webhook failed for PO ${po.folio}: ${err.message}`);
          });
      } catch (err) {
        this.logger.error(`Error preparing webhook for PO ${po.id}: ${err}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private async recalculateTotals(connection: DataSource, requisitionId: string) {
    const itemRepo = connection.getRepository(RequisitionItem);
    const reqRepo = connection.getRepository(PurchaseRequisition);

    const items = await itemRepo.find({ where: { requisition_id: requisitionId } });
    let total = 0;
    for (const item of items) {
      const qty = item.override_quantity ?? item.suggested_quantity;
      total += qty * Number(item.estimated_cost);
    }

    await reqRepo.update(requisitionId, {
      total_estimated_cost: Math.round(total * 100) / 100,
      total_items: items.length,
    });
  }

  /** KPIs for the requisitions dashboard */
  async getKpis(connection: DataSource, branchId?: string) {
    const repo = connection.getRepository(PurchaseRequisition);
    const invRepo = connection.getRepository(Inventory);

    const qb = repo.createQueryBuilder('req');
    if (branchId) qb.andWhere('req.branch_id = :branchId', { branchId });

    const drafts = await qb.clone().andWhere('req.status = :s', { s: 'draft' }).getCount();
    const locked = await qb.clone().andWhere('req.status = :s', { s: 'locked' }).getCount();
    const approved = await qb.clone().andWhere('req.status = :s', { s: 'approved' }).getCount();

    // Count variants below minimum
    const belowMinQb = invRepo.createQueryBuilder('inv')
      .where('inv.stock_available <= inv.stock_minimum');
    if (branchId) belowMinQb.andWhere('inv.branch_id = :branchId', { branchId });
    const belowMinCount = await belowMinQb.getCount();

    return { drafts, locked, approved, below_minimum: belowMinCount };
  }
}
