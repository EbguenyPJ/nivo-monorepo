import 'reflect-metadata';
import { DataSource, In } from 'typeorm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

// ─── Master Entities (direct imports to avoid barrel export issues) ─
import { SuperAdmin } from '../../../../packages/database/src/entities/master/super-admin.entity';
import { Tenant } from '../../../../packages/database/src/entities/master/tenant.entity';
import { Subscription } from '../../../../packages/database/src/entities/master/subscription.entity';
import { PlanConfig } from '../../../../packages/database/src/entities/master/plan-config.entity';
import { TenantBillingProfile } from '../../../../packages/database/src/entities/master/tenant-billing-profile.entity';
import { BillingInvoice } from '../../../../packages/database/src/entities/master/billing-invoice.entity';
import { Notification } from '../../../../packages/database/src/entities/master/notification.entity';
import { SupportTicket } from '../../../../packages/database/src/entities/master/support-ticket.entity';
import { TicketMessage } from '../../../../packages/database/src/entities/master/ticket-message.entity';
import { SystemSetting } from '../../../../packages/database/src/entities/master/system-setting.entity';

// ─── Tenant Entities (direct imports) ─────────────────────────────
import { Brand } from '../../../../packages/database/src/entities/tenant/brand.entity';
import { Category } from '../../../../packages/database/src/entities/tenant/category.entity';
import { Collection } from '../../../../packages/database/src/entities/tenant/collection.entity';
import { CollectionProduct } from '../../../../packages/database/src/entities/tenant/collection-product.entity';
import { Color } from '../../../../packages/database/src/entities/tenant/color.entity';
import { Branch } from '../../../../packages/database/src/entities/tenant/branch.entity';
import { Product } from '../../../../packages/database/src/entities/tenant/product.entity';
import { ProductVariant } from '../../../../packages/database/src/entities/tenant/product-variant.entity';
import { Inventory } from '../../../../packages/database/src/entities/tenant/inventory.entity';
import { Employee } from '../../../../packages/database/src/entities/tenant/employee.entity';
import { Permission } from '../../../../packages/database/src/entities/tenant/permission.entity';
import { Role } from '../../../../packages/database/src/entities/tenant/role.entity';
import { RolePermission } from '../../../../packages/database/src/entities/tenant/role-permission.entity';
import { EmployeePermission } from '../../../../packages/database/src/entities/tenant/employee-permission.entity';
import { BranchRoleEmployee } from '../../../../packages/database/src/entities/tenant/branch-role-employee.entity';
import { PosSession } from '../../../../packages/database/src/entities/tenant/pos-session.entity';
import { CashRegister } from '../../../../packages/database/src/entities/tenant/cash-register.entity';
import { CashTransaction } from '../../../../packages/database/src/entities/tenant/cash-transaction.entity';
import { Customer } from '../../../../packages/database/src/entities/tenant/customer.entity';
import { CustomerAuth } from '../../../../packages/database/src/entities/tenant/customer-auth.entity';
import { CustomerAddress } from '../../../../packages/database/src/entities/tenant/customer-address.entity';
import { Sale } from '../../../../packages/database/src/entities/tenant/sale.entity';
import { SaleItem } from '../../../../packages/database/src/entities/tenant/sale-item.entity';
import { SalePayment } from '../../../../packages/database/src/entities/tenant/sale-payment.entity';
import { PaymentMethod } from '../../../../packages/database/src/entities/tenant/payment-method.entity';
import { Tax } from '../../../../packages/database/src/entities/tenant/tax.entity';
import { SaleReturn } from '../../../../packages/database/src/entities/tenant/sale-return.entity';
import { SaleReturnItem } from '../../../../packages/database/src/entities/tenant/sale-return-item.entity';
import { CancellationReason } from '../../../../packages/database/src/entities/tenant/cancellation-reason.entity';
import { Supplier } from '../../../../packages/database/src/entities/tenant/supplier.entity';
import { VariantSupplier } from '../../../../packages/database/src/entities/tenant/variant-supplier.entity';
import { PurchaseOrder } from '../../../../packages/database/src/entities/tenant/purchase-order.entity';
import { PurchaseOrderItem } from '../../../../packages/database/src/entities/tenant/purchase-order-item.entity';
import { PurchaseRequisition } from '../../../../packages/database/src/entities/tenant/purchase-requisition.entity';
import { RequisitionItem } from '../../../../packages/database/src/entities/tenant/requisition-item.entity';
import { InventoryTransfer } from '../../../../packages/database/src/entities/tenant/inventory-transfer.entity';
import { InventoryTransferItem } from '../../../../packages/database/src/entities/tenant/inventory-transfer-item.entity';
import { InventoryAudit } from '../../../../packages/database/src/entities/tenant/inventory-audit.entity';
import { InventoryAuditItem } from '../../../../packages/database/src/entities/tenant/inventory-audit-item.entity';
import { InventoryAdjustment } from '../../../../packages/database/src/entities/tenant/inventory-adjustment.entity';
import { Expense } from '../../../../packages/database/src/entities/tenant/expense.entity';
import { ExpenseCategory } from '../../../../packages/database/src/entities/tenant/expense-category.entity';
import { Layaway } from '../../../../packages/database/src/entities/tenant/layaway.entity';
import { LayawayItem } from '../../../../packages/database/src/entities/tenant/layaway-item.entity';
import { LayawayPayment } from '../../../../packages/database/src/entities/tenant/layaway-payment.entity';
import { LoyaltyConfig } from '../../../../packages/database/src/entities/tenant/loyalty-config.entity';
import { LoyaltyLedger } from '../../../../packages/database/src/entities/tenant/loyalty-ledger.entity';
import { CreditAccount } from '../../../../packages/database/src/entities/tenant/credit-account.entity';
import { CreditTransaction } from '../../../../packages/database/src/entities/tenant/credit-transaction.entity';
import { PriceList } from '../../../../packages/database/src/entities/tenant/price-list.entity';
import { VariantPriceMargin } from '../../../../packages/database/src/entities/tenant/variant-price-margin.entity';
import { BranchVariantOverride } from '../../../../packages/database/src/entities/tenant/branch-variant-override.entity';
import { BranchSettingOverride } from '../../../../packages/database/src/entities/tenant/branch-setting-override.entity';
import { TenantSetting } from '../../../../packages/database/src/entities/tenant/tenant-setting.entity';
import { TenantIntegration } from '../../../../packages/database/src/entities/tenant/tenant-integration.entity';
import { IntegrationLog } from '../../../../packages/database/src/entities/tenant/integration-log.entity';
import { StorageLocation } from '../../../../packages/database/src/entities/tenant/storage-location.entity';
import { InventoryLocation } from '../../../../packages/database/src/entities/tenant/inventory-location.entity';
import { Order } from '../../../../packages/database/src/entities/tenant/order.entity';
import { OrderItem } from '../../../../packages/database/src/entities/tenant/order-item.entity';
import { OrderTracking } from '../../../../packages/database/src/entities/tenant/order-tracking.entity';
import { DeliveryProof } from '../../../../packages/database/src/entities/tenant/delivery-proof.entity';
import { PreSale } from '../../../../packages/database/src/entities/tenant/pre-sale.entity';
import { PreSaleItem } from '../../../../packages/database/src/entities/tenant/pre-sale-item.entity';
import { AccountPayable } from '../../../../packages/database/src/entities/tenant/account-payable.entity';
import { SizeGroup } from '../../../../packages/database/src/entities/tenant/size-group.entity';
import { SizeSystem } from '../../../../packages/database/src/entities/tenant/size-system.entity';
import { Size } from '../../../../packages/database/src/entities/tenant/size.entity';
import { SizeEquivalency } from '../../../../packages/database/src/entities/tenant/size-equivalency.entity';
import { UnitOfMeasure } from '../../../../packages/database/src/entities/tenant/unit-of-measure.entity';
import { EmailDraft } from '../../../../packages/database/src/entities/tenant/email-draft.entity';

// ─── Helpers ─────────────────────────────────────────────────────
const uuid = () => crypto.randomUUID();
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
};
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randDec = (min: number, max: number, dec = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const dateRange = (start: Date, end: Date): Date => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);
const addHours = (d: Date, hours: number) => new Date(d.getTime() + hours * 3600000);
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);

const TODAY = new Date('2026-05-18T23:59:59');
const LIVE_CUTOFF = new Date('2026-05-15T00:00:00');

const LIVE_EMAIL_RECIPIENT = 'nivo.demo2@gmail.com';
const LIVE_WHATSAPP_RECIPIENT = '+522228124824';

// ─── Live-Run Dispatcher (Phase 4) ──────────────────────────────
class LiveDispatcher {
  private redis: Redis;
  private notificationsQueue: Queue;
  private reportsQueue: Queue;
  private jobCounter = 0;

  constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redis = new Redis({ host: redisHost, port: redisPort, maxRetriesPerRequest: null });
    const connection = { host: redisHost, port: redisPort };
    this.notificationsQueue = new Queue('notifications-queue', { connection });
    this.reportsQueue = new Queue('reports-queue', { connection });
  }

  async enqueueEmail(to: string, subject: string, html: string) {
    this.jobCounter++;
    await this.notificationsQueue.add(`sim-email-${this.jobCounter}`, {
      type: 'email',
      payload: { to, subject, html },
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    count('live_email_jobs');
  }

  async enqueueWhatsApp(to: string, templateName: string, bodyParams: string[]) {
    this.jobCounter++;
    await this.notificationsQueue.add(`sim-wa-${this.jobCounter}`, {
      type: 'whatsapp',
      payload: {
        to,
        templateName,
        language: 'es_MX',
        components: [
          {
            type: 'body',
            parameters: bodyParams.map(text => ({ type: 'text', text })),
          },
        ],
      },
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    count('live_whatsapp_jobs');
  }

  async enqueueReport(tenantId: string, databaseName: string, reportType: string, filters: Record<string, string>, channel: 'email' | 'whatsapp' | 'both', recipient: string, recipientName?: string) {
    this.jobCounter++;
    await this.reportsQueue.add(`sim-report-${this.jobCounter}`, {
      tenantId,
      databaseName,
      reportType,
      filters,
      distribution: { channel, recipient, recipientName },
      requestedBy: 'simulation-script',
    }, { attempts: 2, backoff: { type: 'exponential', delay: 5000 } });
    count('live_report_jobs');
  }

  async emitOrderConfirmationEmail(customerName: string, customerEmail: string, orderFolio: string, total: number, tenantName: string) {
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;color:#065f46;">✅ Pedido Confirmado</h2>
          <p style="margin:0;color:#10b981;font-size:14px;">${tenantName}</p>
        </div>
        <p>Hola ${customerName},</p>
        <p>Tu pedido <strong>${orderFolio}</strong> ha sido confirmado por <strong>$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>.</p>
        <p>Te notificaremos cuando esté listo para recoger o en camino.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Generado por Nivo POS — simulación</p>
      </div>`;
    await this.enqueueEmail(customerEmail, `Pedido ${orderFolio} confirmado — ${tenantName}`, html);
  }

  async emitDeliveryWhatsApp(customerName: string, customerPhone: string, orderFolio: string, tenantName: string) {
    await this.enqueueWhatsApp(customerPhone, 'order_delivered', [customerName, orderFolio, tenantName]);
  }

  async emitDailySalesReport(tenantId: string, databaseName: string, date: Date, tenantName: string) {
    const dateStr = date.toISOString().split('T')[0];
    await this.enqueueReport(tenantId, databaseName, 'sales', { startDate: dateStr, endDate: dateStr }, 'both', LIVE_EMAIL_RECIPIENT, `Admin ${tenantName}`);
  }

  async emitSupplierPOEmail(supplierName: string, supplierEmail: string, poFolio: string, totalCost: number, tenantName: string) {
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;color:#1e3a5f;">📦 Orden de Compra ${poFolio}</h2>
          <p style="margin:0;color:#3b82f6;font-size:14px;">${tenantName}</p>
        </div>
        <p>Estimado ${supplierName},</p>
        <p>Le enviamos la orden de compra <strong>${poFolio}</strong> por un total de <strong>$${totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>.</p>
        <p>Por favor confirme la recepción y fecha estimada de entrega.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Generado por Nivo POS — simulación</p>
      </div>`;
    await this.enqueueEmail(supplierEmail, `OC ${poFolio} — ${tenantName}`, html);
  }

  async emitLowStockWhatsApp(branchName: string, variantCount: number, tenantName: string) {
    await this.enqueueWhatsApp(LIVE_WHATSAPP_RECIPIENT, 'low_stock_alert', [tenantName, branchName, String(variantCount)]);
  }

  async emitLayawayReminderEmail(customerName: string, customerEmail: string, balance: number, dueDate: string, tenantName: string) {
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:#fefce8;border:1px solid #eab308;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <h2 style="margin:0 0 4px;color:#854d0e;">⏰ Recordatorio de Apartado</h2>
          <p style="margin:0;color:#eab308;font-size:14px;">${tenantName}</p>
        </div>
        <p>Hola ${customerName},</p>
        <p>Tienes un apartado pendiente con saldo de <strong>$${balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong> que vence el <strong>${dueDate}</strong>.</p>
        <p>Visita tu sucursal más cercana para completar el pago.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Generado por Nivo POS — simulación</p>
      </div>`;
    await this.enqueueEmail(customerEmail, `Recordatorio de apartado — ${tenantName}`, html);
  }

  async destroy() {
    await this.notificationsQueue.close();
    await this.reportsQueue.close();
    await this.redis.quit();
  }
}

let liveDispatcher: LiveDispatcher | null = null;

const MEXICO_CITIES = [
  { city: 'Puebla', state: 'Puebla', zip: '72000', lat: 19.0414, lng: -98.2063 },
  { city: 'CDMX', state: 'Ciudad de México', zip: '06600', lat: 19.4326, lng: -99.1332 },
  { city: 'Guadalajara', state: 'Jalisco', zip: '44100', lat: 20.6597, lng: -103.3496 },
  { city: 'Monterrey', state: 'Nuevo León', zip: '64000', lat: 25.6866, lng: -100.3161 },
  { city: 'Querétaro', state: 'Querétaro', zip: '76000', lat: 20.5888, lng: -100.3899 },
  { city: 'Oaxaca', state: 'Oaxaca', zip: '68000', lat: 17.0732, lng: -96.7266 },
  { city: 'Mérida', state: 'Yucatán', zip: '97000', lat: 20.9674, lng: -89.5926 },
  { city: 'León', state: 'Guanajuato', zip: '37000', lat: 21.1250, lng: -101.6859 },
];

const FIRST_NAMES = ['Ana', 'Carlos', 'María', 'José', 'Lupita', 'Diego', 'Fernanda', 'Miguel', 'Sofía', 'Ricardo', 'Valeria', 'Andrés', 'Daniela', 'Roberto', 'Gabriela', 'Alejandro', 'Patricia', 'Fernando', 'Laura', 'Eduardo'];
const LAST_NAMES = ['García', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Díaz', 'Vázquez', 'Morales', 'Reyes', 'Cruz', 'Ortiz', 'Gutiérrez', 'Mendoza', 'Castillo'];

const SHOE_BRANDS = [
  { name: 'Nike', logo: 'https://ui-avatars.com/api/?name=NK&background=111&color=fff&size=128&bold=true' },
  { name: 'Adidas', logo: 'https://ui-avatars.com/api/?name=AD&background=000&color=fff&size=128&bold=true' },
  { name: 'Timberland', logo: 'https://ui-avatars.com/api/?name=TB&background=C28B1A&color=fff&size=128&bold=true' },
  { name: 'Puma', logo: 'https://ui-avatars.com/api/?name=PM&background=E5243A&color=fff&size=128&bold=true' },
  { name: 'New Balance', logo: 'https://ui-avatars.com/api/?name=NB&background=CF0A2C&color=fff&size=128&bold=true' },
  { name: 'Converse', logo: 'https://ui-avatars.com/api/?name=CV&background=1C1C1C&color=fff&size=128&bold=true' },
  { name: 'Vans', logo: 'https://ui-avatars.com/api/?name=VN&background=C41230&color=fff&size=128&bold=true' },
  { name: 'Skechers', logo: 'https://ui-avatars.com/api/?name=SK&background=003DA5&color=fff&size=128&bold=true' },
  { name: 'Reebok', logo: 'https://ui-avatars.com/api/?name=RB&background=E41317&color=fff&size=128&bold=true' },
  { name: 'Caterpillar', logo: 'https://ui-avatars.com/api/?name=CAT&background=FFCC00&color=000&size=128&bold=true' },
];

const SHOE_PRODUCTS: { name: string; brand: string; base_price: number; cost: number; category: string }[] = [
  { name: 'Nike Air Max 270', brand: 'Nike', base_price: 3299, cost: 1650, category: 'Tenis' },
  { name: 'Nike Air Force 1 Low', brand: 'Nike', base_price: 2499, cost: 1250, category: 'Tenis' },
  { name: 'Nike Dunk Low Retro', brand: 'Nike', base_price: 2799, cost: 1400, category: 'Tenis' },
  { name: 'Nike Revolution 6', brand: 'Nike', base_price: 1599, cost: 800, category: 'Running' },
  { name: 'Nike Court Vision Low', brand: 'Nike', base_price: 1899, cost: 950, category: 'Tenis' },
  { name: 'Adidas Ultraboost 22', brand: 'Adidas', base_price: 3999, cost: 2000, category: 'Running' },
  { name: 'Adidas Stan Smith', brand: 'Adidas', base_price: 2299, cost: 1150, category: 'Tenis' },
  { name: 'Adidas Samba OG', brand: 'Adidas', base_price: 2599, cost: 1300, category: 'Tenis' },
  { name: 'Adidas Gazelle', brand: 'Adidas', base_price: 1999, cost: 1000, category: 'Tenis' },
  { name: 'Adidas NMD R1', brand: 'Adidas', base_price: 3499, cost: 1750, category: 'Tenis' },
  { name: 'Timberland Pro 6" Waterproof', brand: 'Timberland', base_price: 4599, cost: 2300, category: 'Botas' },
  { name: 'Timberland Euro Sprint Hiker', brand: 'Timberland', base_price: 3799, cost: 1900, category: 'Botas' },
  { name: 'Timberland Classic 2-Eye Boat', brand: 'Timberland', base_price: 2899, cost: 1450, category: 'Casual' },
  { name: 'Puma RS-X3', brand: 'Puma', base_price: 2499, cost: 1250, category: 'Tenis' },
  { name: 'Puma Suede Classic XXI', brand: 'Puma', base_price: 1799, cost: 900, category: 'Tenis' },
  { name: 'Puma Carina Street', brand: 'Puma', base_price: 1499, cost: 750, category: 'Tenis' },
  { name: 'New Balance 574 Core', brand: 'New Balance', base_price: 2199, cost: 1100, category: 'Tenis' },
  { name: 'New Balance Fresh Foam 1080v12', brand: 'New Balance', base_price: 3799, cost: 1900, category: 'Running' },
  { name: 'New Balance 530', brand: 'New Balance', base_price: 2499, cost: 1250, category: 'Tenis' },
  { name: 'Converse Chuck Taylor All Star', brand: 'Converse', base_price: 1299, cost: 650, category: 'Tenis' },
  { name: 'Converse Chuck 70 High', brand: 'Converse', base_price: 1799, cost: 900, category: 'Tenis' },
  { name: 'Converse Run Star Hike', brand: 'Converse', base_price: 2299, cost: 1150, category: 'Tenis' },
  { name: 'Vans Old Skool', brand: 'Vans', base_price: 1599, cost: 800, category: 'Tenis' },
  { name: 'Vans Sk8-Hi', brand: 'Vans', base_price: 1799, cost: 900, category: 'Tenis' },
  { name: 'Vans Authentic', brand: 'Vans', base_price: 1299, cost: 650, category: 'Tenis' },
  { name: 'Skechers D\'Lites', brand: 'Skechers', base_price: 1899, cost: 950, category: 'Tenis' },
  { name: 'Skechers Go Walk 6', brand: 'Skechers', base_price: 1699, cost: 850, category: 'Casual' },
  { name: 'Skechers Arch Fit', brand: 'Skechers', base_price: 2099, cost: 1050, category: 'Casual' },
  { name: 'Reebok Classic Leather', brand: 'Reebok', base_price: 1999, cost: 1000, category: 'Tenis' },
  { name: 'Reebok Nano X3', brand: 'Reebok', base_price: 3299, cost: 1650, category: 'Training' },
  { name: 'Caterpillar Colorado 2.0', brand: 'Caterpillar', base_price: 3299, cost: 1650, category: 'Botas' },
  { name: 'Caterpillar Intruder', brand: 'Caterpillar', base_price: 2499, cost: 1250, category: 'Casual' },
];

const SHOE_COLORS_MAP: Record<string, string> = {
  'Negro': '#000000', 'Blanco': '#FFFFFF', 'Gris': '#808080', 'Azul Marino': '#1B2A4A',
  'Rojo': '#DC2626', 'Café': '#6B3E26', 'Beige': '#D4B896', 'Verde Olivo': '#556B2F',
  'Rosa': '#EC4899', 'Amarillo': '#EAB308',
};
const SHOE_COLORS = Object.keys(SHOE_COLORS_MAP);
const SHOE_SIZES_MX = ['22', '22.5', '23', '23.5', '24', '24.5', '25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5', '29'];
const UNSPLASH_SHOES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
  'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600',
  'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600',
  'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600',
  'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600',
  'https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600',
  'https://images.unsplash.com/photo-1543508282-6319a3e2621f?w=600',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600',
  'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600',
  'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=600',
];

const SUPPLIER_DATA = [
  { name: 'Distribuidora Calzatodo S.A. de C.V.', rfc: 'DCA200115QR8', email: 'ventas@calzatodo.mx', phone: '+52 222 555 1234', credit_days: 30 },
  { name: 'Importaciones Footwear MX', rfc: 'IFM190820AB3', email: 'pedidos@footwearmx.com', phone: '+52 55 4433 2211', credit_days: 45 },
  { name: 'Grupo Tenería León', rfc: 'GTL180503CD1', email: 'compras@teneria-leon.com', phone: '+52 477 612 3456', credit_days: 60 },
  { name: 'Mayoreo Deportivo Nacional', rfc: 'MDN210310EF5', email: 'ventas@mayoreo-deportivo.mx', phone: '+52 33 3344 5566', credit_days: 30 },
  { name: 'Proveedora de Calzado del Bajío', rfc: 'PCB200812GH7', email: 'contacto@calzadobajio.mx', phone: '+52 477 713 4567', credit_days: 45 },
];

const EXPENSE_CATEGORIES_DATA = ['Renta', 'Servicios (Luz/Agua/Internet)', 'Limpieza', 'Papelería', 'Transporte', 'Comida/Vales', 'Mantenimiento', 'Marketing', 'Seguridad', 'Varios'];
const CANCELLATION_REASONS_DATA = ['Defecto de fábrica', 'Talla incorrecta', 'No es lo que esperaba', 'Cambio de opinión', 'Producto dañado en tienda', 'Error del cajero'];

const COLLECTIONS_DATA = [
  { name: 'Verano 2026', image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400', color: '#FF6B35' },
  { name: 'Outlet', image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400', color: '#E63946' },
  { name: 'Back to School', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400', color: '#457B9D' },
  { name: 'Edición Limitada', image: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400', color: '#FFD700' },
  { name: 'Confort Premium', image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400', color: '#2A9D8F' },
];

const TENANT_PROFILES = [
  {
    name: 'Calzados El Paso',
    subdomain: 'elpaso',
    created_at: new Date('2025-12-01'),
    plan: 'corporativo',
    logo: 'https://ui-avatars.com/api/?name=EP&background=1E3A5F&color=fff&size=256&bold=true&format=svg',
    primary_color: '#1E3A5F',
    branches: [
      { name: 'Sucursal Centro', code: 'EP-CTR', ...MEXICO_CITIES[0] },
      { name: 'Sucursal Angelópolis', code: 'EP-ANG', city: 'Puebla', state: 'Puebla', zip: '72810', lat: 19.0089, lng: -98.2254 },
      { name: 'Sucursal Plaza Dorada', code: 'EP-PDR', city: 'Puebla', state: 'Puebla', zip: '72420', lat: 19.0533, lng: -98.2144 },
    ],
    profile: 'legacy',
    subscription_changes: [
      { plan: 'basico', date: new Date('2025-12-01') },
      { plan: 'profesional', date: new Date('2026-02-01') },
      { plan: 'corporativo', date: new Date('2026-04-01') },
    ],
  },
  {
    name: 'Zapatería Nova',
    subdomain: 'nova',
    created_at: new Date('2026-02-01'),
    plan: 'profesional',
    logo: 'https://ui-avatars.com/api/?name=NV&background=6C3CE1&color=fff&size=256&bold=true&format=svg',
    primary_color: '#6C3CE1',
    branches: [
      { name: 'Nova Reforma', code: 'NV-REF', ...MEXICO_CITIES[1] },
      { name: 'Nova Santa Fe', code: 'NV-STF', city: 'CDMX', state: 'Ciudad de México', zip: '05348', lat: 19.3590, lng: -99.2722 },
    ],
    profile: 'growth',
    subscription_changes: [],
  },
  {
    name: 'Foot Paradise',
    subdomain: 'footparadise',
    created_at: new Date('2026-03-01'),
    plan: 'basico',
    logo: 'https://ui-avatars.com/api/?name=FP&background=DC2626&color=fff&size=256&bold=true&format=svg',
    primary_color: '#DC2626',
    branches: [
      { name: 'FP Galerías', code: 'FP-GAL', ...MEXICO_CITIES[2] },
    ],
    profile: 'churn',
    subscription_changes: [],
    churn_date: new Date('2026-04-15'),
  },
  {
    name: 'Sneaker Hub',
    subdomain: 'sneakerhub',
    created_at: new Date('2026-01-15'),
    plan: 'profesional',
    logo: 'https://ui-avatars.com/api/?name=SH&background=059669&color=fff&size=256&bold=true&format=svg',
    primary_color: '#059669',
    branches: [
      { name: 'Hub Monterrey', code: 'SH-MTY', ...MEXICO_CITIES[3] },
      { name: 'Hub Querétaro', code: 'SH-QRO', ...MEXICO_CITIES[4] },
    ],
    profile: 'heavy_mobile',
    subscription_changes: [],
  },
];

// ─── Audit Counter ───────────────────────────────────────────────
const AUDIT: Record<string, number> = {};
function count(table: string, n = 1) {
  AUDIT[table] = (AUDIT[table] || 0) + n;
}

// ─── DB Config ───────────────────────────────────────────────────
const DB_CONFIG = {
  host: process.env.MASTER_DB_HOST || 'localhost',
  port: parseInt(process.env.MASTER_DB_PORT || '5434', 10),
  username: process.env.MASTER_DB_USERNAME || 'nivo_admin',
  password: process.env.MASTER_DB_PASSWORD || 'nivo_secret_2024',
};

const _masterCheck = { SuperAdmin, Tenant, Subscription, PlanConfig, TenantBillingProfile, BillingInvoice, Notification, SupportTicket, TicketMessage, SystemSetting };
for (const [name, ent] of Object.entries(_masterCheck)) {
  if (!ent) console.warn(`⚠️  Master entity "${name}" is undefined — will be skipped`);
}
const MASTER_ENTITIES = Object.values(_masterCheck).filter(Boolean);

const TENANT_ENTITIES = [
  Brand, Category, Collection, CollectionProduct, Color,
  Branch, Product, ProductVariant, Inventory,
  Employee, Permission, Role, RolePermission, EmployeePermission, BranchRoleEmployee,
  PosSession, CashRegister, CashTransaction,
  Customer, CustomerAuth, CustomerAddress,
  Sale, SaleItem, SalePayment, PaymentMethod, Tax,
  SaleReturn, SaleReturnItem, CancellationReason,
  Supplier, VariantSupplier,
  PurchaseOrder, PurchaseOrderItem,
  PurchaseRequisition, RequisitionItem,
  InventoryTransfer, InventoryTransferItem,
  InventoryAudit, InventoryAuditItem, InventoryAdjustment,
  Expense, ExpenseCategory,
  Layaway, LayawayItem, LayawayPayment,
  LoyaltyConfig, LoyaltyLedger,
  CreditAccount, CreditTransaction,
  PriceList, VariantPriceMargin, BranchVariantOverride, BranchSettingOverride,
  TenantSetting, TenantIntegration, IntegrationLog,
  StorageLocation, InventoryLocation,
  Order, OrderItem, OrderTracking, DeliveryProof,
  PreSale, PreSaleItem,
  AccountPayable,
  SizeGroup, SizeSystem, Size, SizeEquivalency, UnitOfMeasure,
  EmailDraft,
].filter(Boolean);

// ═══════════════════════════════════════════════════════════════════
// PHASE 1: MASTER DB
// ═══════════════════════════════════════════════════════════════════

async function seedMaster(ds: DataSource) {
  console.log('\n🏛️  PHASE 1: Seeding Master Database...');

  // Plans
  const planRepo = ds.getRepository(PlanConfig);
  const plans = [
    { plan_name: 'prueba', display_name: 'Prueba Gratis', monthly_price: 0, annual_price: 0, max_branches: 1, max_users: 2, sort_order: 0, is_active: true },
    { plan_name: 'basico', display_name: 'Básico', monthly_price: 499, annual_price: 4990, max_branches: 1, max_users: 3, sort_order: 1, is_active: true, mod_transfers: false },
    { plan_name: 'profesional', display_name: 'Profesional', monthly_price: 999, annual_price: 9990, max_branches: 3, max_users: 10, sort_order: 2, is_active: true, mod_transfers: true, mod_loyalty: true, mod_advanced_reports: true },
    { plan_name: 'corporativo', display_name: 'Corporativo', monthly_price: 2499, annual_price: 24990, max_branches: 0, max_users: 0, sort_order: 3, is_active: true, mod_transfers: true, mod_invoicing: true, mod_loyalty: true, mod_advanced_reports: true, mod_ecommerce: true, mod_custom_branding: true },
  ];
  for (const p of plans) {
    const exists = await planRepo.findOne({ where: { plan_name: p.plan_name } });
    if (!exists) await planRepo.save(planRepo.create(p));
  }
  count('plan_configs', plans.length);
  console.log('  ✅ Plans created');

  // Super Admins
  const saRepo = ds.getRepository(SuperAdmin);
  const admins = [
    { email: 'admin@nivo.com', password_hash: await bcrypt.hash('Admin123!', 12), role: 'super-admin' as const },
    { email: 'soporte@nivo.com', password_hash: await bcrypt.hash('Soporte123!', 12), role: 'soporte' as const },
  ];
  for (const a of admins) {
    const exists = await saRepo.findOne({ where: { email: a.email } });
    if (!exists) await saRepo.save(saRepo.create(a));
  }
  count('super_admins', admins.length);

  // System Settings
  const ssRepo = ds.getRepository(SystemSetting);
  const settings = [
    { key: 'platform_version', value: '2.4.0' },
    { key: 'maintenance_mode', value: 'false' },
    { key: 'default_trial_days', value: '14' },
    { key: 'max_tenants', value: '1000' },
  ];
  for (const s of settings) {
    const exists = await ssRepo.findOne({ where: { key: s.key } });
    if (!exists) await ssRepo.save(ssRepo.create(s));
  }
  count('system_settings', settings.length);

  // Tenants + Subscriptions
  const tenantRepo = ds.getRepository(Tenant);
  const subRepo = ds.getRepository(Subscription);
  const billingRepo = ds.getRepository(TenantBillingProfile);
  const invoiceRepo = ds.getRepository(BillingInvoice);
  const notifRepo = ds.getRepository(Notification);
  const ticketRepo = ds.getRepository(SupportTicket);
  const tmRepo = ds.getRepository(TicketMessage);

  const createdTenants: (Tenant & { _profile: typeof TENANT_PROFILES[0] })[] = [];

  for (const tp of TENANT_PROFILES) {
    let tenant = await tenantRepo.findOne({ where: { subdomain: tp.subdomain } });
    if (!tenant) {
      tenant = tenantRepo.create({
        name: tp.name,
        subdomain: tp.subdomain,
        database_name: `nivo_tenant_${tp.subdomain}`,
        logo_url: tp.logo,
        theme_settings: { primary_color: tp.primary_color },
        is_active: tp.profile !== 'churn',
        rfc: `RFC${tp.subdomain.toUpperCase()}260101XX${rand(0, 9)}`,
        razon_social: `${tp.name} S.A. de C.V.`,
        regimen_fiscal: '601',
        codigo_postal_fiscal: tp.branches[0].zip,
        created_at: tp.created_at,
      });
      await tenantRepo.save(tenant);
    }
    count('tenants');

    // Subscription
    const subStatus = tp.profile === 'churn' ? 'past_due' : 'active';
    let sub = await subRepo.findOne({ where: { tenant_id: tenant.id } });
    if (!sub) {
      sub = subRepo.create({
        tenant_id: tenant.id,
        plan_name: tp.plan,
        status: subStatus as any,
        stripe_subscription_id: `sub_sim_${tp.subdomain}_${Date.now()}`,
        current_period_end: tp.profile === 'churn' ? new Date('2026-04-30') : addDays(TODAY, 30),
        created_at: tp.created_at,
      });
      await subRepo.save(sub);
    }
    count('subscriptions');

    // Billing profile
    const bpExists = await billingRepo.findOne({ where: { tenant_id: tenant.id } });
    if (!bpExists) {
      await billingRepo.save(billingRepo.create({
        tenant_id: tenant.id,
        rfc: tenant.rfc || 'XAXX010101000',
        legal_name: tenant.razon_social || tp.name,
        zip_code: tp.branches[0].zip,
        tax_regime: '601',
        cfdi_use: 'G03',
        requires_invoice: tp.plan === 'corporativo',
      }));
    }
    count('tenant_billing_profiles');

    // Monthly invoices
    const monthsSinceCreation = daysBetween(tp.created_at, TODAY) / 30;
    const planPrice = plans.find(p => p.plan_name === tp.plan)?.monthly_price || 499;
    for (let m = 0; m < Math.floor(monthsSinceCreation); m++) {
      const invoiceId = `in_sim_${tp.subdomain}_${m}`;
      const existing = await invoiceRepo.findOne({ where: { stripe_invoice_id: invoiceId } });
      if (!existing) {
        const periodStart = addDays(tp.created_at, m * 30);
        const periodEnd = addDays(periodStart, 30);
        const subtotal = planPrice / 1.16;
        await invoiceRepo.save(invoiceRepo.create({
          tenant_id: tenant.id,
          stripe_invoice_id: invoiceId,
          amount_total: planPrice,
          amount_subtotal: parseFloat(subtotal.toFixed(2)),
          amount_tax: parseFloat((planPrice - subtotal).toFixed(2)),
          description: `Suscripción ${tp.plan} - Mes ${m + 1}`,
          period_start: periodStart,
          period_end: periodEnd,
          cfdi_status: m < Math.floor(monthsSinceCreation) - 1 ? 'stamped' : 'pending',
          created_at: periodStart,
        }));
      }
      count('billing_invoices');
    }

    // Notifications
    const notifMessages = [
      { title: `Bienvenido a Nivo, ${tp.name}!`, type: 'info' },
      { title: `Tu plan ${tp.plan} ha sido activado`, type: 'success' },
      { title: `Factura del mes generada`, type: 'billing' },
    ];
    for (const n of notifMessages) {
      await notifRepo.save(notifRepo.create({
        tenant_id: tenant.id,
        title: n.title,
        message: `Notificación automática para ${tp.name}`,
        type: n.type,
        is_read: Math.random() > 0.3,
        created_at: dateRange(tp.created_at, TODAY),
      }));
      count('notifications');
    }

    // Support tickets
    if (tp.profile === 'churn' || tp.profile === 'legacy') {
      const ticket = ticketRepo.create({
        tenant_id: tenant.id,
        tenant_name: tp.name,
        subject: tp.profile === 'churn' ? 'Problema con cobros duplicados' : 'Consulta sobre migración de plan',
        status: tp.profile === 'churn' ? 'open' : 'resolved',
        priority: tp.profile === 'churn' ? 'high' : 'medium',
        category: 'billing',
        created_at: dateRange(addDays(tp.created_at, 30), TODAY),
      });
      await ticketRepo.save(ticket);
      count('support_tickets');

      await tmRepo.save(tmRepo.create({
        ticket_id: ticket.id,
        sender_type: 'tenant',
        sender_name: tp.name,
        message: tp.profile === 'churn' ? 'Me cobraron dos veces este mes, necesito un reembolso urgente.' : '¿Cómo puedo cambiar al plan corporativo?',
        created_at: ticket.created_at,
      }));
      await tmRepo.save(tmRepo.create({
        ticket_id: ticket.id,
        sender_type: 'admin',
        sender_name: 'Soporte Nivo',
        message: 'Hemos recibido tu solicitud. Un agente revisará tu caso en las próximas 24 horas.',
        created_at: addHours(ticket.created_at as Date, 2),
      }));
      count('ticket_messages', 2);
    }

    (tenant as any)._profile = tp;
    createdTenants.push(tenant as any);
  }

  console.log(`  ✅ ${createdTenants.length} Tenants + subscriptions + billing`);
  return createdTenants;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2: TENANT DATABASE SETUP
// ═══════════════════════════════════════════════════════════════════

async function createTenantDb(dbName: string): Promise<DataSource> {
  const adminDs = new DataSource({
    type: 'postgres',
    ...DB_CONFIG,
    database: 'postgres',
  });
  await adminDs.initialize();

  const dbExists = await adminDs.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
  const isNew = dbExists.length === 0;
  if (isNew) {
    await adminDs.query(`CREATE DATABASE "${dbName}"`);
    console.log(`  📦 Created database: ${dbName}`);
  }
  await adminDs.destroy();

  const tenantDs = new DataSource({
    type: 'postgres',
    ...DB_CONFIG,
    database: dbName,
    entities: TENANT_ENTITIES,
    synchronize: isNew,
    logging: false,
  });
  await tenantDs.initialize();

  if (!isNew) {
    // Patch missing columns/tables on existing databases
    const patches = [
      `ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN DEFAULT false`,
      `CREATE TABLE IF NOT EXISTS email_drafts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        purchase_order_id UUID REFERENCES purchase_orders(id),
        supplier_id UUID REFERENCES suppliers(id),
        requisition_id UUID REFERENCES purchase_requisitions(id),
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        body_html TEXT NOT NULL,
        pdf_url TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    ];
    for (const sql of patches) {
      try { await tenantDs.query(sql); } catch (_) { /* ignore if already applied */ }
    }
  }

  return tenantDs;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 3: SEED TENANT CATALOGS + OPERATIONS
// ═══════════════════════════════════════════════════════════════════

async function seedTenant(ds: DataSource, tenant: Tenant & { _profile: typeof TENANT_PROFILES[0] }) {
  const tp = tenant._profile;
  console.log(`\n🏪 Seeding tenant: ${tp.name} (${tp.profile})...`);

  // ─── Tenant Settings ───────────────────────────────────────
  const tsRepo = ds.getRepository(TenantSetting);
  const tenantSettings = [
    { key: 'business_name', value: tp.name, label: 'Nombre del negocio', group: 'general' },
    { key: 'primary_color', value: tp.primary_color, label: 'Color primario', group: 'branding' },
    { key: 'logo_url', value: tp.logo, label: 'Logo URL', group: 'branding' },
    { key: 'currency', value: 'MXN', label: 'Moneda', group: 'general' },
    { key: 'tax_rate', value: '16', label: 'IVA %', group: 'fiscal' },
    { key: 'default_landed_cost_percentage', value: '5.00', label: 'Costo de internación', group: 'purchasing' },
    { key: 'auto_generate_sku', value: 'true', label: 'SKU automático', group: 'inventory' },
    { key: 'low_stock_threshold', value: '5', label: 'Umbral stock bajo', group: 'inventory' },
    { key: 'ticket_show_logo', value: 'true', label: 'Logo en ticket', group: 'pos' },
    { key: 'layaway_max_days', value: '30', label: 'Máx días apartado', group: 'layaway' },
    { key: 'loyalty_enabled', value: tp.plan !== 'basico' ? 'true' : 'false', label: 'Lealtad activa', group: 'loyalty' },
    { key: 'loyalty_points_per_peso', value: '1', label: 'Puntos por peso', group: 'loyalty' },
    { key: 'loyalty_peso_per_point', value: '0.10', label: 'Valor del punto', group: 'loyalty' },
  ];
  for (const s of tenantSettings) {
    const exists = await tsRepo.findOne({ where: { key: s.key } });
    if (!exists) await tsRepo.save(tsRepo.create(s));
  }
  count('tenant_settings', tenantSettings.length);

  // ─── Branches ──────────────────────────────────────────────
  const branchRepo = ds.getRepository(Branch);
  const branchIds: string[] = [];
  for (const b of tp.branches) {
    let branch = await branchRepo.findOne({ where: { code: b.code } });
    if (!branch) {
      branch = branchRepo.create({
        name: b.name, code: b.code, address: `Calle Principal #${rand(100, 999)}`,
        city: b.city, zip_code: b.zip, phone: `+52 ${rand(200, 999)} ${rand(100, 999)} ${rand(1000, 9999)}`,
        latitude: b.lat, longitude: b.lng, is_active: true,
        created_at: tp.created_at,
      });
      await branchRepo.save(branch);
    }
    branchIds.push(branch.id);
    count('branches');
  }

  // ─── Roles & Permissions ───────────────────────────────────
  const roleRepo = ds.getRepository(Role);
  const permRepo = ds.getRepository(Permission);
  const rpRepo = ds.getRepository(RolePermission);

  const roles: Record<string, Role> = {};
  for (const r of [
    { slug: 'admin', name: 'Administrador', is_system: true },
    { slug: 'manager', name: 'Gerente', is_system: true },
    { slug: 'cashier', name: 'Cajero', is_system: true },
  ]) {
    let role = await roleRepo.findOne({ where: { slug: r.slug } });
    if (!role) role = await roleRepo.save(roleRepo.create(r));
    roles[r.slug] = role;
    count('roles');
  }

  const permDefs = [
    { key: 'pos.vender', name: 'Vender en POS', module: 'Punto de Venta' },
    { key: 'pos.devolver', name: 'Hacer devoluciones', module: 'Punto de Venta' },
    { key: 'inventario.ver', name: 'Ver inventario', module: 'Inventario' },
    { key: 'inventario.editar', name: 'Editar inventario', module: 'Inventario' },
    { key: 'inventario.traspasar', name: 'Traspasar inventario', module: 'Inventario' },
    { key: 'reportes.ver', name: 'Ver reportes', module: 'Reportes' },
    { key: 'empleados.gestionar', name: 'Gestionar empleados', module: 'Empleados' },
    { key: 'config.editar', name: 'Editar configuración', module: 'Configuración' },
    { key: 'compras.crear', name: 'Crear órdenes de compra', module: 'Compras' },
    { key: 'compras.aprobar', name: 'Aprobar órdenes de compra', module: 'Compras' },
  ];
  const perms: Permission[] = [];
  for (const pd of permDefs) {
    let p = await permRepo.findOne({ where: { key: pd.key } });
    if (!p) p = await permRepo.save(permRepo.create(pd));
    perms.push(p);
    count('permissions');
  }

  for (const [slug, role] of Object.entries(roles)) {
    const assignPerms = slug === 'admin' ? perms : slug === 'manager' ? perms.slice(0, 7) : perms.slice(0, 4);
    for (const p of assignPerms) {
      const exists = await rpRepo.findOne({ where: { role_id: role.id, permission_id: p.id } });
      if (!exists) await rpRepo.save(rpRepo.create({ role_id: role.id, permission_id: p.id }));
      count('role_has_permissions');
    }
  }

  // ─── Cash Registers ────────────────────────────────────────
  const crRepo = ds.getRepository(CashRegister);
  const cashRegisters: Record<string, CashRegister> = {};
  for (const bid of branchIds) {
    for (let i = 1; i <= 2; i++) {
      const name = `Caja ${i}`;
      let cr = await crRepo.findOne({ where: { branch_id: bid, name } });
      if (!cr) cr = await crRepo.save(crRepo.create({ branch_id: bid, name, is_active: true }));
      cashRegisters[`${bid}_${i}`] = cr;
      count('cash_registers');
    }
  }

  // ─── Employees ─────────────────────────────────────────────
  const empRepo = ds.getRepository(Employee);
  const breRepo = ds.getRepository(BranchRoleEmployee);
  const employees: Employee[] = [];

  for (let bi = 0; bi < branchIds.length; bi++) {
    const bid = branchIds[bi];
    const empCount = bi === 0 ? 5 : 3;
    for (let ei = 0; ei < empCount; ei++) {
      const fn = pick(FIRST_NAMES);
      const ln = pick(LAST_NAMES);
      const empRole = ei === 0 ? 'admin' : ei === 1 ? 'manager' : 'cashier';
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${rand(1,99)}@${tp.subdomain}.nivo.mx`;
      let emp = await empRepo.findOne({ where: { email } });
      if (!emp) {
        emp = empRepo.create({
          name: `${fn} ${ln}`, email,
          password_hash: await bcrypt.hash('Nivo123!', 10),
          phone: `+52 ${rand(200, 999)} ${rand(100, 999)} ${rand(1000, 9999)}`,
          pin_hash: await bcrypt.hash(String(rand(1000, 9999)), 10),
          role: empRole as any,
          role_id: roles[empRole].id,
          branch_id: bid,
          is_owner: bi === 0 && ei === 0,
          is_active: true,
          created_at: tp.created_at,
        });
        await empRepo.save(emp);
      }
      employees.push(emp);
      count('employees');

      await breRepo.save(breRepo.create({ employee_id: emp.id, branch_id: bid, role_id: roles[empRole].id })).catch(() => {});
      count('branch_role_employees');
    }
  }

  // ─── Payment Methods ───────────────────────────────────────
  const pmRepo = ds.getRepository(PaymentMethod);
  const payMethods: PaymentMethod[] = [];
  for (const pm of [
    { name: 'Efectivo', requires_reference: false },
    { name: 'Tarjeta de Débito', requires_reference: true },
    { name: 'Tarjeta de Crédito', requires_reference: true },
    { name: 'Transferencia', requires_reference: true },
  ]) {
    let p = await pmRepo.findOne({ where: { name: pm.name } });
    if (!p) p = await pmRepo.save(pmRepo.create(pm));
    payMethods.push(p);
    count('payment_methods');
  }

  // ─── Taxes ─────────────────────────────────────────────────
  const taxRepo = ds.getRepository(Tax);
  let ivaTax = await taxRepo.findOne({ where: { name: 'IVA 16%' } });
  if (!ivaTax) ivaTax = await taxRepo.save(taxRepo.create({ name: 'IVA 16%', percentage: 16, is_active: true }));
  count('taxes');

  // ─── Cancellation Reasons ──────────────────────────────────
  const cancelRepo = ds.getRepository(CancellationReason);
  const cancelReasons: CancellationReason[] = [];
  for (const r of CANCELLATION_REASONS_DATA) {
    let cr = await cancelRepo.findOne({ where: { name: r } });
    if (!cr) cr = await cancelRepo.save(cancelRepo.create({ name: r }));
    cancelReasons.push(cr);
    count('cancellation_reasons');
  }

  // ─── Expense Categories ────────────────────────────────────
  const ecRepo = ds.getRepository(ExpenseCategory);
  const expCategories: ExpenseCategory[] = [];
  for (const c of EXPENSE_CATEGORIES_DATA) {
    let ec = await ecRepo.findOne({ where: { name: c } });
    if (!ec) ec = await ecRepo.save(ecRepo.create({ name: c, is_active: true }));
    expCategories.push(ec);
    count('expense_categories');
  }

  // ─── Size Systems ──────────────────────────────────────────
  const sgRepo = ds.getRepository(SizeGroup);
  const ssRepo2 = ds.getRepository(SizeSystem);
  const sRepo = ds.getRepository(Size);
  const seRepo = ds.getRepository(SizeEquivalency);
  let sizeGroup = await sgRepo.findOne({ where: { name: 'Calzado Adulto' } });
  if (!sizeGroup) sizeGroup = await sgRepo.save(sgRepo.create({ name: 'Calzado Adulto' }));
  count('size_groups');

  let sizeSysMx = await ssRepo2.findOne({ where: { name: 'MX' } });
  if (!sizeSysMx) sizeSysMx = await ssRepo2.save(ssRepo2.create({ name: 'MX', is_active: true }));
  count('size_systems');

  for (const sz of SHOE_SIZES_MX) {
    let size = await sRepo.findOne({ where: { size_group_id: sizeGroup.id, order_index: Math.round(parseFloat(sz) * 10) } });
    if (!size) size = await sRepo.save(sRepo.create({ size_group_id: sizeGroup.id, order_index: Math.round(parseFloat(sz) * 10) }));
    count('sizes');

    const eqExists = await seRepo.findOne({ where: { size_id: size.id, size_system_id: sizeSysMx.id } });
    if (!eqExists) await seRepo.save(seRepo.create({ size_id: size.id, size_system_id: sizeSysMx.id, value: sz }));
    count('size_equivalencies');
  }

  // ─── Colors ────────────────────────────────────────────────
  const colorRepo = ds.getRepository(Color);
  for (const c of SHOE_COLORS) {
    const exists = await colorRepo.findOne({ where: { name: c } });
    if (!exists) await colorRepo.save(colorRepo.create({ name: c, hex_code: SHOE_COLORS_MAP[c] || '#000000' } as any));
    count('colors');
  }

  // ─── Brands ────────────────────────────────────────────────
  const brandRepo = ds.getRepository(Brand);
  const brands: Record<string, Brand> = {};
  for (const b of SHOE_BRANDS) {
    let brand = await brandRepo.findOne({ where: { name: b.name } });
    if (!brand) brand = await brandRepo.save(brandRepo.create({ name: b.name, logo_url: b.logo, is_active: true }));
    brands[b.name] = brand;
    count('brands');
  }

  // ─── Categories ────────────────────────────────────────────
  const catRepo = ds.getRepository(Category);
  const categories: Record<string, Category> = {};
  for (const cn of ['Tenis', 'Running', 'Botas', 'Casual', 'Training', 'Sandalias']) {
    let cat = await catRepo.findOne({ where: { name: cn } });
    if (!cat) cat = await catRepo.save(catRepo.create({ name: cn }));
    categories[cn] = cat;
    count('categories');
  }

  // ─── Collections ───────────────────────────────────────────
  const collRepo = ds.getRepository(Collection);
  const cpRepo = ds.getRepository(CollectionProduct);
  const collections: Collection[] = [];
  for (const c of COLLECTIONS_DATA) {
    let coll = await collRepo.findOne({ where: { name: c.name } });
    if (!coll) coll = await collRepo.save(collRepo.create({ name: c.name, image_url: c.image, color: c.color, is_active: true }));
    collections.push(coll);
    count('collections');
  }

  // ─── Price Lists ───────────────────────────────────────────
  const plRepo = ds.getRepository(PriceList);
  let defaultPL = await plRepo.findOne({ where: { name: 'Precio General' } });
  if (!defaultPL) defaultPL = await plRepo.save(plRepo.create({ name: 'Precio General', default_margin_percentage: 0, is_default: true, is_active: true }));
  let wholesalePL = await plRepo.findOne({ where: { name: 'Mayoreo' } });
  if (!wholesalePL) wholesalePL = await plRepo.save(plRepo.create({ name: 'Mayoreo', default_margin_percentage: -15, is_default: false, is_active: true }));
  count('price_lists', 2);

  // ─── Suppliers ─────────────────────────────────────────────
  const supRepo = ds.getRepository(Supplier);
  const suppliers: Supplier[] = [];
  for (const s of SUPPLIER_DATA) {
    let sup = await supRepo.findOne({ where: { name: s.name } });
    if (!sup) sup = await supRepo.save(supRepo.create({ ...s, is_active: true }));
    suppliers.push(sup);
    count('suppliers');
  }

  // ─── Products & Variants ───────────────────────────────────
  const prodRepo = ds.getRepository(Product);
  const pvRepo = ds.getRepository(ProductVariant);
  const invRepo = ds.getRepository(Inventory);
  const vsRepo = ds.getRepository(VariantSupplier);
  const slRepo = ds.getRepository(StorageLocation);

  const productsToSeed = tp.profile === 'churn' ? SHOE_PRODUCTS.slice(0, 15) : SHOE_PRODUCTS;
  const allVariants: ProductVariant[] = [];
  const productIds: string[] = [];

  // Storage locations per branch
  for (const bid of branchIds) {
    const storageLocDefs = [
      { name: 'Bodega Principal', code: 'BOD-PRINC', type: 'zone' },
      { name: 'Exhibición Piso', code: 'EXH-PISO', type: 'shelf' },
      { name: 'Almacén Trasero', code: 'ALM-TRAS', type: 'shelf' },
    ];
    for (const loc of storageLocDefs) {
      const exists = await slRepo.findOne({ where: { branch_id: bid, code: loc.code } });
      if (!exists) await slRepo.save(slRepo.create({ branch_id: bid, name: loc.name, code: loc.code, type: loc.type, is_active: true } as any));
      count('storage_locations');
    }
  }

  for (const sp of productsToSeed) {
    const brand = brands[sp.brand];
    const cat = categories[sp.category];
    if (!brand || !cat) continue;

    let product = await prodRepo.findOne({ where: { name: sp.name } });
    if (!product) {
      product = prodRepo.create({
        name: sp.name, description: `${sp.name} - Calzado ${sp.category} de ${sp.brand}`,
        brand_id: brand.id, category_id: cat.id, base_price: sp.base_price,
        images: [pick(UNSPLASH_SHOES), pick(UNSPLASH_SHOES)],
        image_url: pick(UNSPLASH_SHOES),
        is_active: true,
        created_at: addDays(tp.created_at, rand(0, 14)),
      });
      await prodRepo.save(product);
    }
    productIds.push(product.id);
    count('products');

    // Assign to collections
    const assignColls = pickN(collections, rand(1, 2));
    for (const coll of assignColls) {
      const exists = await cpRepo.findOne({ where: { product_id: product.id, collection_id: coll.id } });
      if (!exists) await cpRepo.save(cpRepo.create({ product_id: product.id, collection_id: coll.id }));
      count('collection_products');
    }

    // Variants: 2-4 colors × 3-5 sizes
    const varColors = pickN(SHOE_COLORS, rand(2, 4));
    const varSizes = pickN(SHOE_SIZES_MX, rand(3, 5));

    for (const color of varColors) {
      for (const size of varSizes) {
        const sku = `${sp.brand.substring(0, 3).toUpperCase()}-${sp.name.replace(/\s+/g, '').substring(0, 6).toUpperCase()}-${color.substring(0, 3).toUpperCase()}-${size}`;
        let variant = await pvRepo.findOne({ where: { sku } });
        if (!variant) {
          variant = pvRepo.create({
            product_id: product.id, sku,
            attributes: { Color: color, 'Talla MX': size },
            price_override: sp.base_price + rand(-200, 200),
            cost: sp.cost,
            barcode: `780${rand(1000000000, 9999999999)}`,
            images: [pick(UNSPLASH_SHOES)],
            is_active: true,
          });
          await pvRepo.save(variant);
        }
        allVariants.push(variant);
        count('product_variants');

        // Inventory per branch
        for (const bid of branchIds) {
          const exists = await invRepo.findOne({ where: { variant_id: variant.id, branch_id: bid } });
          if (!exists) {
            const stockMax = rand(15, 30);
            await invRepo.save(invRepo.create({
              variant_id: variant.id, branch_id: bid,
              stock_available: rand(3, stockMax),
              stock_minimum: 5, stock_maximum: stockMax,
            }));
          }
          count('inventory');
        }

        // Supplier link
        const sup = pick(suppliers);
        const vsExists = await vsRepo.findOne({ where: { variant_id: variant.id, supplier_id: sup.id } });
        if (!vsExists) {
          await vsRepo.save(vsRepo.create({
            variant_id: variant.id, supplier_id: sup.id,
            supplier_sku: `${sup.name.substring(0, 3).toUpperCase()}-${sku}`,
            last_cost: sp.cost, is_default: true,
          }));
        }
        count('variant_suppliers');
      }
    }
  }
  console.log(`  ✅ ${productsToSeed.length} products, ${allVariants.length} variants`);

  // ─── Loyalty Config ────────────────────────────────────────
  const lcRepo = ds.getRepository(LoyaltyConfig);
  const lcExists = await lcRepo.find();
  if (lcExists.length === 0) {
    await lcRepo.save(lcRepo.create({
      is_active: tp.plan !== 'basico',
      spend_per_point: 100,
      point_value: 1,
      min_redemption_points: 100,
      expiration_days: 365,
      earn_on_layaway: true,
    }));
  }
  count('loyalty_configs');

  // ─── Customers ─────────────────────────────────────────────
  const custRepo = ds.getRepository(Customer);
  const caRepo = ds.getRepository(CustomerAuth);
  const caddrRepo = ds.getRepository(CustomerAddress);
  const customers: Customer[] = [];
  const customerCount = tp.profile === 'legacy' ? 80 : tp.profile === 'heavy_mobile' ? 60 : tp.profile === 'churn' ? 20 : 40;

  for (let ci = 0; ci < customerCount; ci++) {
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${rand(100, 999)}@gmail.com`;
    let cust = await custRepo.findOne({ where: { email } });
    if (!cust) {
      const loyaltyPts = rand(0, 5000);
      cust = custRepo.create({
        name: `${fn} ${ln}`, first_name: fn, last_name: ln, email,
        phone: `+52 ${rand(200, 999)} ${rand(100, 999)} ${rand(1000, 9999)}`,
        date_of_birth: new Date(`${rand(1970, 2005)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`),
        loyalty_points: loyaltyPts,
        membership_tier: loyaltyPts > 3000 ? 'gold' : loyaltyPts > 1000 ? 'silver' : loyaltyPts > 300 ? 'bronze' : null,
        tags: ci < 5 ? ['vip'] : ci % 10 === 0 ? ['wholesale'] : [],
        price_list_id: ci % 10 === 0 ? wholesalePL.id : null,
        is_active: true,
        created_at: dateRange(tp.created_at, addDays(TODAY, -7)),
      });
      await custRepo.save(cust);
    }
    customers.push(cust);
    count('customers');

    // CustomerAuth for mobile tenants
    if (tp.profile === 'heavy_mobile' || ci < 15) {
      const authExists = await caRepo.findOne({ where: { customer_id: cust.id } });
      if (!authExists) {
        await caRepo.save(caRepo.create({
          customer_id: cust.id, email: cust.email!,
          password_hash: await bcrypt.hash('Client123!', 10),
          phone: cust.phone, is_verified: Math.random() > 0.2,
          push_token: Math.random() > 0.5 ? `ExponentPushToken[sim_${uuid().substring(0, 8)}]` : null,
        }));
      }
      count('customer_auth');
    }

    // Addresses
    if (ci < 30) {
      const loc = pick(MEXICO_CITIES);
      const addrExists = await caddrRepo.findOne({ where: { customer_id: cust.id } });
      if (!addrExists) {
        await caddrRepo.save(caddrRepo.create({
          customer_id: cust.id, label: 'Casa',
          street: `Av. ${pick(LAST_NAMES)} #${rand(100, 2000)}`,
          neighborhood: `Col. ${pick(LAST_NAMES)}`,
          city: loc.city, state: loc.state, zip_code: loc.zip,
          country: 'Mexico', is_default: true,
        }));
      }
      count('customer_addresses');
    }
  }
  console.log(`  ✅ ${customers.length} customers`);

  // ─── Credit Accounts ───────────────────────────────────────
  const creditRepo = ds.getRepository(CreditAccount);
  const ctRepo = ds.getRepository(CreditTransaction);
  const vipCustomers = customers.slice(0, 5);
  for (const cust of vipCustomers) {
    const exists = await creditRepo.findOne({ where: { customer_id: cust.id } });
    if (!exists) {
      const limit = rand(5000, 20000);
      const used = rand(0, Math.floor(limit * 0.6));
      const ca = await creditRepo.save(creditRepo.create({
        customer_id: cust.id,
        credit_limit: limit,
        current_balance: used,
        is_active: true,
      }));
      count('credit_accounts');

      if (used > 0) {
        await ctRepo.save(ctRepo.create({
          credit_account_id: ca.id,
          type: 'charge',
          amount: used,
          balance_after: used,
          created_at: dateRange(tp.created_at, TODAY),
        }));
        count('credit_transactions');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CHRONOLOGICAL SIMULATION
  // ═══════════════════════════════════════════════════════════
  console.log(`  📅 Simulating daily operations from ${tp.created_at.toISOString().split('T')[0]} to 2026-05-18...`);

  const saleRepo = ds.getRepository(Sale);
  const siRepo = ds.getRepository(SaleItem);
  const spRepo = ds.getRepository(SalePayment);
  const srRepo = ds.getRepository(SaleReturn);
  const sriRepo = ds.getRepository(SaleReturnItem);
  const psRepo = ds.getRepository(PosSession);
  const ctxRepo = ds.getRepository(CashTransaction);
  const expRepo = ds.getRepository(Expense);
  const llRepo = ds.getRepository(LoyaltyLedger);
  const layRepo = ds.getRepository(Layaway);
  const liRepo = ds.getRepository(LayawayItem);
  const lpRepo = ds.getRepository(LayawayPayment);
  const orderRepo = ds.getRepository(Order);
  const oiRepo = ds.getRepository(OrderItem);
  const otRepo = ds.getRepository(OrderTracking);
  const dpRepo = ds.getRepository(DeliveryProof);
  const preSaleRepo = ds.getRepository(PreSale);
  const psiRepo = ds.getRepository(PreSaleItem);
  const itRepo = ds.getRepository(InventoryTransfer);
  const itiRepo = ds.getRepository(InventoryTransferItem);
  const iaRepo = ds.getRepository(InventoryAudit);
  const iaiRepo = ds.getRepository(InventoryAuditItem);
  const adjRepo = ds.getRepository(InventoryAdjustment);
  const poRepo = ds.getRepository(PurchaseOrder);
  const poiRepo = ds.getRepository(PurchaseOrderItem);
  const prRepo = ds.getRepository(PurchaseRequisition);
  const riRepo = ds.getRepository(RequisitionItem);
  const apRepo = ds.getRepository(AccountPayable);
  const tiRepo = ds.getRepository(TenantIntegration);
  const ilRepo = ds.getRepository(IntegrationLog);
  const edRepo = ds.getRepository(EmailDraft);

  // Tenant integration logs
  let stripeIntegration = await tiRepo.findOne({ where: { integration_type: 'clip' } });
  if (!stripeIntegration) {
    stripeIntegration = await tiRepo.save(tiRepo.create({
      integration_type: 'clip',
      display_name: 'Terminal Clip',
      credentials_encrypted: 'encrypted_sim_placeholder',
      is_active: true,
    }));
  }
  count('tenant_integrations');

  await ilRepo.save(ilRepo.create({
    integration_id: stripeIntegration.id,
    action: 'charge_terminal',
    status: 'success',
    request_payload: { amount: 2499 },
    created_at: TODAY,
  }));
  count('integration_logs');

  const startDate = new Date(tp.created_at);
  const endDate = tp.profile === 'churn' ? (tp as any).churn_date || addDays(TODAY, -30) : TODAY;
  const totalDays = daysBetween(startDate, endDate);

  let poFolioCounter = 0;
  let trFolioCounter = 0;
  let reqFolioCounter = 0;
  let audFolioCounter = 0;

  for (let day = 0; day <= totalDays; day++) {
    const currentDate = addDays(startDate, day);
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    const isLive = currentDate >= LIVE_CUTOFF;
    const dayOfMonth = currentDate.getDate();
    const monthIdx = currentDate.getMonth();

    // Seasonality: more sales in Dec, Jan, May
    const seasonMultiplier = [12, 11].includes(monthIdx) ? 1.5 : [4, 5].includes(monthIdx) ? 1.3 : monthIdx === 1 ? 0.7 : 1.0;
    const profileMultiplier = tp.profile === 'legacy' ? 1.4 : tp.profile === 'heavy_mobile' ? 1.1 : tp.profile === 'churn' ? 0.6 : 0.9;

    // ─── Daily POS Sessions ──────────────────────────────
    for (const bid of branchIds) {
      const branchEmployees = employees.filter(e => e.branch_id === bid);
      if (branchEmployees.length === 0) continue;

      const cashier = pick(branchEmployees.filter(e => e.role === 'cashier') || branchEmployees);
      const crKey = `${bid}_1`;
      const cr = cashRegisters[crKey];
      if (!cr) continue;

      const openingAmount = rand(1000, 3000);
      const sessionOpen = new Date(currentDate);
      sessionOpen.setHours(9, 0, 0, 0);
      const sessionClose = new Date(currentDate);
      sessionClose.setHours(isWeekend ? 16 : 21, 0, 0, 0);

      const session = await psRepo.save(psRepo.create({
        employee_id: cashier.id, branch_id: bid, cash_register_id: cr.id,
        opening_amount: openingAmount, status: 'closed',
        opened_at: sessionOpen, closed_at: sessionClose,
      }));
      count('pos_sessions');

      // ─── Sales for this session ────────────────────
      const dailySalesCount = Math.floor(rand(4, 12) * seasonMultiplier * profileMultiplier * (isWeekend ? 1.3 : 1));
      let sessionCashTotal = openingAmount;

      for (let si = 0; si < dailySalesCount; si++) {
        const saleTime = new Date(currentDate);
        saleTime.setHours(rand(9, isWeekend ? 15 : 20), rand(0, 59), rand(0, 59));

        const customer = Math.random() > 0.3 ? pick(customers) : null;
        const itemCount = rand(1, 3);
        const saleVariants = pickN(allVariants, itemCount);
        let totalAmount = 0;
        const saleItemsData: { variant: ProductVariant; qty: number; price: number; discount: number }[] = [];

        for (const v of saleVariants) {
          const qty = rand(1, 2);
          const price = Number(v.price_override) || 1500;
          const discount = Math.random() > 0.85 ? randDec(50, 300) : 0;
          totalAmount += (price * qty) - discount;
          saleItemsData.push({ variant: v, qty, price, discount });
        }

        const taxAmount = parseFloat((totalAmount * 0.16 / 1.16).toFixed(2));
        const payMethod = pick(['cash', 'card', 'mixed'] as const);

        const sale = await saleRepo.save(saleRepo.create({
          pos_session_id: session.id,
          customer_id: customer?.id || null,
          employee_id: cashier.id,
          branch_id: bid,
          total_amount: parseFloat(totalAmount.toFixed(2)),
          discount_amount: saleItemsData.reduce((a, i) => a + i.discount, 0),
          tax_amount: taxAmount,
          payment_method: payMethod,
          sale_type: 'in_store',
          status: 'completed',
          created_at: saleTime,
        }));
        count('sales');

        for (const item of saleItemsData) {
          await siRepo.save(siRepo.create({
            sale_id: sale.id,
            variant_id: item.variant.id,
            quantity: item.qty,
            unit_price: item.price,
            discount: item.discount,
            subtotal: (item.price * item.qty) - item.discount,
            unit_cost_at_sale: Number(item.variant.cost) || 800,
          }));
          count('sale_items');

          // Decrement stock
          await invRepo.decrement({ variant_id: item.variant.id, branch_id: bid }, 'stock_available', item.qty);
        }

        // Payment
        const pm = payMethod === 'cash' ? payMethods[0] : payMethod === 'card' ? payMethods[1] : payMethods[0];
        if (payMethod === 'mixed') {
          const cashPart = parseFloat((totalAmount * 0.6).toFixed(2));
          await spRepo.save(spRepo.create({ sale_id: sale.id, payment_method_id: payMethods[0].id, payment_method_name: 'Efectivo', amount: cashPart, created_at: saleTime }));
          await spRepo.save(spRepo.create({ sale_id: sale.id, payment_method_id: payMethods[1].id, payment_method_name: 'Tarjeta de Débito', amount: parseFloat((totalAmount - cashPart).toFixed(2)), reference: `REF${rand(100000, 999999)}`, created_at: saleTime }));
          count('sale_payments', 2);
          sessionCashTotal += cashPart;
        } else {
          await spRepo.save(spRepo.create({
            sale_id: sale.id, payment_method_id: pm.id, payment_method_name: pm.name,
            amount: parseFloat(totalAmount.toFixed(2)),
            reference: payMethod === 'card' ? `REF${rand(100000, 999999)}` : null,
            created_at: saleTime,
          }));
          count('sale_payments');
          if (payMethod === 'cash') sessionCashTotal += totalAmount;
        }

        // Cash transaction
        await ctxRepo.save(ctxRepo.create({
          session_id: session.id, type: 'sale', employee_id: cashier.id,
          amount: payMethod === 'cash' ? totalAmount : payMethod === 'mixed' ? totalAmount * 0.6 : 0,
          created_at: saleTime,
        } as any));
        count('cash_transactions');

        // Loyalty points
        if (customer && tp.plan !== 'basico') {
          const points = Math.floor(totalAmount);
          await llRepo.save(llRepo.create({
            customer_id: customer.id, type: 'earned',
            points_earned: points, points_spent: 0,
            balance_after: (customer.loyalty_points || 0) + points,
            description: `Venta ${sale.id.substring(0, 8)}`,
            sale_id: sale.id,
            created_at: saleTime,
          }));
          count('loyalty_ledgers');
        }
      }

      // ─── Returns (5% chance per day) ───────────────
      if (Math.random() < 0.05) {
        const recentSales = await saleRepo.find({ where: { branch_id: bid, status: 'completed' }, take: 10, order: { created_at: 'DESC' } });
        const saleToReturn = pick(recentSales);
        if (saleToReturn) {
          const saleItems = await siRepo.find({ where: { sale_id: saleToReturn.id } });
          if (saleItems.length > 0) {
            const returnItem = pick(saleItems);
            const returnQty = 1;
            const refundAmt = Number(returnItem.unit_price) * returnQty;
            const disposition = Math.random() > 0.7 ? 'shrinkage' : 'floor';

            const sr = await srRepo.save(srRepo.create({
              sale_id: saleToReturn.id,
              employee_id: cashier.id,
              branch_id: bid,
              pos_session_id: session.id,
              refund_amount: refundAmt,
              refund_method: 'cash',
              cancellation_reason_id: pick(cancelReasons).id,
              created_at: addHours(currentDate, rand(10, 18)),
            }));
            count('sale_returns');

            await sriRepo.save(sriRepo.create({
              sale_return_id: sr.id,
              sale_item_id: returnItem.id,
              variant_id: returnItem.variant_id,
              quantity: returnQty,
              unit_price: returnItem.unit_price,
              subtotal: refundAmt,
              disposition: disposition as any,
            }));
            count('sale_return_items');

            if (disposition === 'floor') {
              await invRepo.increment({ variant_id: returnItem.variant_id, branch_id: bid }, 'stock_available', returnQty);
            }

            await ctxRepo.save(ctxRepo.create({ session_id: session.id, type: 'return', amount: -refundAmt, employee_id: cashier.id, created_at: addHours(currentDate, rand(10, 18)) } as any));
            count('cash_transactions');
            sessionCashTotal -= refundAmt;
          }
        }
      }

      // ─── Expenses (daily) ──────────────────────────
      if (Math.random() < 0.3) {
        const expCat = pick(expCategories);
        const expAmount = randDec(50, 1500);
        await expRepo.save(expRepo.create({
          branch_id: bid, category_id: expCat.id, employee_id: cashier.id,
          pos_session_id: session.id, amount: expAmount,
          description: `${expCat.name} - ${currentDate.toISOString().split('T')[0]}`,
          payment_source: Math.random() > 0.5 ? 'cash' : 'bank',
          receipt_url: Math.random() > 0.5 ? `https://storage.nivo.mx/receipts/sim_${uuid().substring(0, 8)}.jpg` : null,
          date: currentDate.toISOString().split('T')[0], is_cancelled: false,
          created_at: addHours(currentDate, rand(9, 17)),
        } as any));
        count('expenses');

        if (Math.random() > 0.5) {
          await ctxRepo.save(ctxRepo.create({ session_id: session.id, type: 'withdrawal', amount: -expAmount, employee_id: cashier.id, created_at: addHours(currentDate, rand(9, 17)) } as any));
          count('cash_transactions');
          sessionCashTotal -= expAmount;
        }
      }

      // ─── Close session (Z-cut with possible discrepancy) ─
      const discrepancy = Math.random() < 0.15 ? randDec(-200, 200) : 0;
      const closingAmount = parseFloat((sessionCashTotal + discrepancy).toFixed(2));
      await psRepo.update(session.id, {
        closing_amount: closingAmount,
        expected_amount: parseFloat(sessionCashTotal.toFixed(2)),
        difference: parseFloat(discrepancy.toFixed(2)),
        status: 'closed',
        closed_at: sessionClose,
        closed_by: cashier.id,
      });

      // LIVE: WhatsApp alert for Z-cut discrepancy
      if (isLive && liveDispatcher && Math.abs(discrepancy) > 50) {
        await liveDispatcher.enqueueWhatsApp(
          LIVE_WHATSAPP_RECIPIENT, 'zcut_discrepancy',
          [tp.name, cashier.name || 'Cajero', `$${Math.abs(discrepancy).toFixed(2)}`],
        );
      }
    }

    // ─── Layaways (weekly) ───────────────────────────────
    if (currentDate.getDay() === 3 && Math.random() < 0.4) {
      const bid = pick(branchIds);
      const cust = pick(customers);
      const emp = pick(employees.filter(e => e.branch_id === bid) || employees);
      const layVariant = pick(allVariants);
      const price = Number(layVariant.price_override) || 1500;
      const downPay = parseFloat((price * 0.3).toFixed(2));

      const lay = await layRepo.save(layRepo.create({
        customer_id: cust.id, branch_id: bid, employee_id: emp.id,
        total_amount: price, down_payment: downPay,
        balance_due: parseFloat((price - downPay).toFixed(2)),
        status: Math.random() > 0.3 ? 'active' : 'paid_delivered',
        due_date: addDays(currentDate, 30),
        created_at: currentDate,
      }));
      count('layaways');

      await liRepo.save(liRepo.create({
        layaway_id: lay.id, variant_id: layVariant.id,
        quantity: 1, unit_price: price, discount: 0, subtotal: price,
      }));
      count('layaway_items');

      const layEmp = pick(employees.filter(e => e.branch_id === bid) || employees);
      await lpRepo.save(lpRepo.create({
        layaway_id: lay.id, amount: downPay,
        payment_method: 'cash',
        employee_id: layEmp.id,
        created_at: currentDate,
      } as any));
      count('layaway_payments');

      if (lay.status === 'paid_delivered') {
        await lpRepo.save(lpRepo.create({
          layaway_id: lay.id, amount: parseFloat((price - downPay).toFixed(2)),
          payment_method: 'card',
          employee_id: layEmp.id,
          created_at: addDays(currentDate, rand(7, 25)),
        } as any));
        count('layaway_payments');
      }

      // LIVE: Layaway reminder email for active layaways
      if (isLive && liveDispatcher && lay.status === 'active' && cust.email) {
        const dueStr = addDays(currentDate, 30).toISOString().split('T')[0];
        await liveDispatcher.emitLayawayReminderEmail(cust.name, cust.email, parseFloat((price - downPay).toFixed(2)), dueStr, tp.name);
      }
    }

    // ─── Online Orders (B2C) ─────────────────────────────
    if ((tp.profile === 'heavy_mobile' || tp.profile === 'legacy') && Math.random() < 0.25) {
      const cust = pick(customers.filter(c => c.email));
      const bid = pick(branchIds);
      const variant = pick(allVariants);
      const price = Number(variant.price_override) || 1500;
      const fulfillment = pick(['bopis', 'delivery'] as const);
      const statuses = fulfillment === 'bopis'
        ? ['paid', 'picking', 'packed', 'ready_for_pickup', 'picked_up']
        : ['paid', 'picking', 'packed', 'out_for_delivery', 'delivered'];
      const finalStatus = pick(statuses);

      const addr = await caddrRepo.findOne({ where: { customer_id: cust.id } });

      const order = await orderRepo.save(orderRepo.create({
        customer_id: cust.id, branch_id: bid,
        fulfillment_type: fulfillment, status: finalStatus,
        total_amount: price, discount_amount: 0, tax_amount: parseFloat((price * 0.16 / 1.16).toFixed(2)),
        stripe_payment_intent_id: `pi_sim_${uuid().substring(0, 12)}`,
        shipping_address: fulfillment === 'delivery' && addr ? { street: addr.street, city: addr.city, state: addr.state, zip: addr.zip_code } : null,
        pickup_branch_id: fulfillment === 'bopis' ? bid : null,
        paid_at: addHours(currentDate, rand(8, 14)),
        completed_at: ['picked_up', 'delivered'].includes(finalStatus) ? addHours(currentDate, rand(15, 22)) : null,
        created_at: addHours(currentDate, rand(7, 13)),
      }));
      count('orders');

      // LIVE: Order confirmation email
      if (isLive && liveDispatcher && cust.email) {
        const orderFolio = `ORD-${order.id.substring(0, 8).toUpperCase()}`;
        await liveDispatcher.emitOrderConfirmationEmail(cust.name, cust.email, orderFolio, price, tp.name);
      }

      await oiRepo.save(oiRepo.create({
        order_id: order.id, variant_id: variant.id,
        quantity: 1, unit_price: price, discount: 0, subtotal: price,
        is_picked: ['packed', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered'].includes(finalStatus),
      }));
      count('order_items');

      // GPS tracking for delivery orders
      if (fulfillment === 'delivery' && ['out_for_delivery', 'delivered'].includes(finalStatus)) {
        const loc = pick(MEXICO_CITIES);
        for (let t = 0; t < rand(3, 8); t++) {
          await otRepo.save(otRepo.create({
            order_id: order.id,
            latitude: loc.lat + (Math.random() - 0.5) * 0.02,
            longitude: loc.lng + (Math.random() - 0.5) * 0.02,
            timestamp: addHours(currentDate, 14 + t * 0.5),
          }));
          count('order_tracking');
        }

        if (finalStatus === 'delivered') {
          const emp = pick(employees);
          await dpRepo.save(dpRepo.create({
            order_id: order.id, employee_id: emp.id,
            latitude: loc.lat + (Math.random() - 0.5) * 0.005,
            longitude: loc.lng + (Math.random() - 0.5) * 0.005,
            photo_url: `https://storage.nivo.mx/delivery/proof_${uuid().substring(0, 8)}.jpg`,
            recipient_name: cust.name,
            status: 'delivered',
            delivered_at: addHours(currentDate, rand(16, 20)),
          }));
          count('delivery_proofs');

          // LIVE: WhatsApp delivery notification
          if (isLive && liveDispatcher) {
            const orderFolio = `ORD-${order.id.substring(0, 8).toUpperCase()}`;
            await liveDispatcher.emitDeliveryWhatsApp(cust.name, cust.phone || LIVE_WHATSAPP_RECIPIENT, orderFolio, tp.name);
          }
        }
      }
    }

    // ─── Pre-Sales (QR) ──────────────────────────────────
    if (Math.random() < 0.08) {
      const bid = pick(branchIds);
      const emp = pick(employees.filter(e => e.branch_id === bid) || employees);
      const variant = pick(allVariants);
      const price = Number(variant.price_override) || 1500;
      const status = pick(['open', 'converted', 'expired'] as const);

      const ps = await preSaleRepo.save(preSaleRepo.create({
        branch_id: bid, employee_id: emp.id,
        customer_id: Math.random() > 0.5 ? pick(customers).id : null,
        status, total_amount: price,
        qr_code: `QR-${uuid().substring(0, 12).toUpperCase()}`,
        expires_at: addHours(currentDate, 24),
        created_at: addHours(currentDate, rand(10, 18)),
      }));
      count('pre_sales');

      await psiRepo.save(psiRepo.create({
        pre_sale_id: ps.id, variant_id: variant.id,
        quantity: 1, unit_price: price, subtotal: price,
      }));
      count('pre_sale_items');
    }

    // ─── Inventory Transfers (biweekly) ──────────────────
    if (branchIds.length > 1 && dayOfMonth % 14 === 0) {
      trFolioCounter++;
      const originIdx = rand(0, branchIds.length - 1);
      let destIdx = rand(0, branchIds.length - 1);
      while (destIdx === originIdx) destIdx = rand(0, branchIds.length - 1);

      const transferVariants = pickN(allVariants, rand(3, 8));
      const status = pick(['completed', 'completed', 'completed', 'discrepancy', 'in_transit'] as const);
      const emp = pick(employees);

      const transfer = await itRepo.save(itRepo.create({
        folio_number: trFolioCounter,
        origin_branch_id: branchIds[originIdx],
        destination_branch_id: branchIds[destIdx],
        status, created_by_id: emp.id,
        received_by_id: status === 'completed' || status === 'discrepancy' ? pick(employees).id : null,
        shipped_at: addHours(currentDate, 10),
        received_at: status !== 'in_transit' ? addHours(currentDate, 16) : null,
        notes: `Transferencia programada semana ${Math.ceil(day / 7)}`,
        discrepancy_notes: status === 'discrepancy' ? 'Faltaron 2 pares en el envío' : null,
        created_at: currentDate,
      }));
      count('inventory_transfers');

      for (const v of transferVariants) {
        const sentQty = rand(2, 5);
        const recQty = status === 'discrepancy' ? sentQty - rand(1, 2) : status !== 'in_transit' ? sentQty : null;
        await itiRepo.save(itiRepo.create({
          transfer_id: transfer.id, variant_id: v.id,
          sent_quantity: sentQty, received_quantity: recQty,
        }));
        count('inventory_transfer_items');
      }
    }

    // ─── Inventory Audits (monthly) ──────────────────────
    if (dayOfMonth === 1 && day > 0) {
      audFolioCounter++;
      const bid = pick(branchIds);
      const emp = pick(employees.filter(e => e.branch_id === bid) || employees);
      const auditVariants = pickN(allVariants, rand(10, 25));

      const audit = await iaRepo.save(iaRepo.create({
        folio_number: audFolioCounter,
        branch_id: bid, type: pick(['full', 'partial'] as const),
        status: 'completed',
        created_by_id: emp.id, closed_by_id: emp.id,
        started_at: addHours(currentDate, 7),
        completed_at: addHours(currentDate, 12),
        notes: `Auditoría mensual ${currentDate.toISOString().split('T')[0]}`,
        created_at: currentDate,
      }));
      count('inventory_audits');

      for (const v of auditVariants) {
        const inv = await invRepo.findOne({ where: { variant_id: v.id, branch_id: bid } });
        const expected = inv?.stock_available || rand(5, 20);
        const counted = expected + rand(-3, 3);
        const diff = counted - expected;

        await iaiRepo.save(iaiRepo.create({
          audit_id: audit.id, variant_id: v.id,
          expected_quantity: expected, counted_quantity: counted,
          difference: diff,
          item_status: 'accepted',
          adjustment_reason: diff < 0 ? 'shrinkage' : diff > 0 ? 'surplus' : null,
          unit_cost: Number(v.cost) || 800,
        }));
        count('inventory_audit_items');

        // Generate adjustments for discrepancies
        if (diff !== 0) {
          await adjRepo.save(adjRepo.create({
            audit_id: audit.id, variant_id: v.id, branch_id: bid,
            reason: diff < 0 ? 'shrinkage' : 'surplus',
            quantity: diff,
            financial_impact: parseFloat((Math.abs(diff) * (Number(v.cost) || 800)).toFixed(2)),
            approved_by_id: emp.id,
            notes: diff < 0 ? 'Merma detectada en conteo' : 'Sobrante encontrado',
            created_at: addHours(currentDate, 13),
          }));
          count('inventory_adjustments');

          // Update stock
          if (inv) {
            await invRepo.update(inv.id, { stock_available: counted });
          }
        }
      }
    }

    // ─── Purchase Requisitions (every 20 days) ───────────
    if (day % 20 === 10 && day > 0) {
      reqFolioCounter++;
      const bid = pick(branchIds);
      const emp = pick(employees.filter(e => e.role === 'admin' || e.role === 'manager') || employees);
      const reqVariants = pickN(allVariants, rand(5, 15));

      const status = pick(['draft', 'locked', 'approved'] as const);
      const req = await prRepo.save(prRepo.create({
        folio_number: reqFolioCounter,
        branch_id: bid, status,
        locked_by_id: status !== 'draft' ? emp.id : null,
        locked_at: status !== 'draft' ? addHours(currentDate, 10) : null,
        approved_by_id: status === 'approved' ? emp.id : null,
        approved_at: status === 'approved' ? addHours(currentDate, 14) : null,
        created_by_ai: Math.random() < 0.3,
        notes: `Requisición ${status === 'approved' ? 'aprobada' : 'pendiente'}`,
        created_at: currentDate,
      }));
      count('purchase_requisitions');

      let totalEstimated = 0;
      for (const v of reqVariants) {
        const currentStock = rand(1, 5);
        const maxStock = rand(15, 25);
        const suggestedQty = maxStock - currentStock;
        const cost = Number(v.cost) || 800;
        totalEstimated += suggestedQty * cost;

        const vs = await vsRepo.findOne({ where: { variant_id: v.id } });
        await riRepo.save(riRepo.create({
          requisition_id: req.id, variant_id: v.id,
          suggested_quantity: suggestedQty, current_stock: currentStock,
          max_stock: maxStock, estimated_cost: cost,
          supplier_id: vs?.supplier_id || suppliers[0].id,
        }));
        count('requisition_items');
      }
      await prRepo.update(req.id, { total_estimated_cost: totalEstimated, total_items: reqVariants.length });

      // ─── Purchase Orders (from approved requisitions) ──
      if (status === 'approved') {
        const supplierGroups: Record<string, { variants: ProductVariant[]; costs: number[] }> = {};
        for (const v of reqVariants) {
          const vs = await vsRepo.findOne({ where: { variant_id: v.id } });
          const sid = vs?.supplier_id || suppliers[0].id;
          if (!supplierGroups[sid]) supplierGroups[sid] = { variants: [], costs: [] };
          supplierGroups[sid].variants.push(v);
          supplierGroups[sid].costs.push(Number(v.cost) || 800);
        }

        for (const [supplierId, group] of Object.entries(supplierGroups)) {
          poFolioCounter++;
          const poStatus = pick(['draft', 'ordered', 'received', 'received'] as const);
          let totalCost = 0;

          const poData = poRepo.create({
            folio_number: poFolioCounter, total_cost: 0,
            supplier_id: supplierId, branch_id: bid,
            status: poStatus as string, created_by_id: emp.id,
            received_by_id: poStatus === 'received' ? emp.id : null,
            expected_date: addDays(currentDate, rand(5, 15)) as any,
            received_at: poStatus === 'received' ? addDays(currentDate, rand(5, 12)) : null,
            requisition_id: req.id,
            notes: `OC generada desde REQ-${String(reqFolioCounter).padStart(4, '0')}`,
            created_at: addHours(currentDate, 15),
          } as any);
          const po = await poRepo.save(poData) as unknown as PurchaseOrder;
          count('purchase_orders');

          for (let gi = 0; gi < group.variants.length; gi++) {
            const v = group.variants[gi];
            const orderedQty = rand(5, 20);
            const unitCost = group.costs[gi];
            const receivedQty = poStatus === 'received' ? orderedQty + rand(-2, 0) : null;
            totalCost += orderedQty * unitCost;

            await poiRepo.save(poiRepo.create({
              purchase_order_id: po.id, variant_id: v.id,
              ordered_quantity: orderedQty, received_quantity: receivedQty,
              unit_cost: unitCost,
            }));
            count('purchase_order_items');

            // Restock on received
            if (poStatus === 'received' && receivedQty) {
              await invRepo.increment({ variant_id: v.id, branch_id: bid }, 'stock_available', receivedQty);
            }
          }

          await poRepo.update(po.id, { total_cost: totalCost });

          // Accounts payable
          const sup = suppliers.find(s => s.id === supplierId);
          await apRepo.save(apRepo.create({
            purchase_order_id: po.id, supplier_id: supplierId,
            amount: totalCost,
            paid_amount: poStatus === 'received' ? totalCost : 0,
            status: poStatus === 'received' ? 'paid' : 'pending',
            due_date: addDays(currentDate, sup?.credit_days || 30).toISOString().split('T')[0],
            created_at: addHours(currentDate, 16),
          }));
          count('accounts_payable');

          // Email drafts for recent orders
          if (day > totalDays - 10 && sup) {
            await edRepo.save(edRepo.create({
              purchase_order_id: po.id,
              supplier_id: supplierId,
              requisition_id: req.id,
              to_email: sup.email || 'proveedor@demo.mx',
              subject: `Orden de Compra OC-${String(poFolioCounter).padStart(4, '0')} - ${tp.name}`,
              body_html: `<p>Estimado ${sup.name},</p><p>Adjuntamos la orden de compra OC-${String(poFolioCounter).padStart(4, '0')}.</p><p>Saludos,<br/>${tp.name}</p>`,
              status: 'pending',
              created_at: addHours(currentDate, 17),
            }));
            count('email_drafts');
          }

          // LIVE: Real supplier PO email via BullMQ
          if (isLive && liveDispatcher && sup) {
            const poFolio = `OC-${String(poFolioCounter).padStart(4, '0')}`;
            await liveDispatcher.emitSupplierPOEmail(sup.name, sup.email || LIVE_EMAIL_RECIPIENT, poFolio, totalCost, tp.name);
          }
        }
      }

      // LIVE: Low stock WhatsApp alert after requisition
      if (isLive && liveDispatcher) {
        await liveDispatcher.emitLowStockWhatsApp(`Sucursal ${bid.substring(0, 6)}`, reqVariants.length, tp.name);
      }
    }

    // ─── LIVE: End-of-day sales report via BullMQ ────────
    if (isLive && liveDispatcher) {
      await liveDispatcher.emitDailySalesReport(tenant.id, tenant.database_name, currentDate, tp.name);
    }

    // Log progress every 30 days
    if (day % 30 === 0 && day > 0) {
      process.stdout.write(`  📊 Day ${day}/${totalDays} (${currentDate.toISOString().split('T')[0]}) — ${AUDIT['sales'] || 0} sales so far\r`);
    }
  }

  console.log(`\n  ✅ Chronological simulation complete for ${tp.name}`);
  return { branchIds, employees, customers, allVariants, suppliers, payMethods, cashRegisters, expCategories, cancelReasons };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    🚀 NIVO MASTER SIMULATION SCRIPT             ║');
  console.log('║    Populating 6 months of organic data          ║');
  console.log('║    Target: 2026-05-18                           ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const startTime = Date.now();

  // Master DB
  const masterDs = new DataSource({
    type: 'postgres',
    ...DB_CONFIG,
    database: process.env.MASTER_DB_NAME || 'nivo_master_db',
    entities: MASTER_ENTITIES,
    synchronize: true,
    logging: false,
  });
  await masterDs.initialize();
  console.log('✅ Connected to Master DB');

  const tenants = await seedMaster(masterDs);

  // Initialize live-run dispatcher for BullMQ jobs
  try {
    liveDispatcher = new LiveDispatcher();
    console.log('🔴 Live-Run Dispatcher connected to Redis (BullMQ)');
  } catch (err) {
    console.warn('⚠️  Could not connect to Redis — live-run jobs will be skipped:', (err as Error).message);
    liveDispatcher = null;
  }

  // Seed each tenant
  for (const tenant of tenants) {
    const dbName = tenant.database_name;
    const tenantDs = await createTenantDb(dbName);
    await seedTenant(tenantDs, tenant);
    await tenantDs.destroy();
  }

  // Clean up live dispatcher
  if (liveDispatcher) {
    const liveStats = {
      emails: AUDIT['live_email_jobs'] || 0,
      whatsapp: AUDIT['live_whatsapp_jobs'] || 0,
      reports: AUDIT['live_report_jobs'] || 0,
    };
    console.log(`\n🔴 Live-Run Summary: ${liveStats.emails} emails, ${liveStats.whatsapp} WhatsApp, ${liveStats.reports} report jobs enqueued`);
    await liveDispatcher.destroy();
  }

  await masterDs.destroy();

  // ─── Generate Audit Report ─────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalRecords = Object.values(AUDIT).reduce((a, b) => a + b, 0);

  const reportLines = [
    '# 📋 Nivo Simulation Audit Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Execution Time:** ${elapsed}s`,
    `**Total Records Created:** ${totalRecords.toLocaleString()}`,
    `**Tenants Simulated:** ${TENANT_PROFILES.length}`,
    `**Date Range:** 2025-12-01 → 2026-05-18`,
    '',
    '## Records by Table',
    '',
    '| Table | Records |',
    '|-------|---------|',
    ...Object.entries(AUDIT)
      .sort((a, b) => b[1] - a[1])
      .map(([table, count]) => `| ${table} | ${count.toLocaleString()} |`),
    '',
    '## Tenant Profiles',
    '',
    ...TENANT_PROFILES.map(t => `- **${t.name}** (${t.subdomain}): Plan ${t.plan}, Profile: ${t.profile}, Branches: ${t.branches.length}`),
    '',
    '## Coverage Checklist',
    '',
    '- [x] Master: tenants, subscriptions, plans, billing_profiles, invoices, notifications, support_tickets, ticket_messages, super_admins, system_settings',
    '- [x] Catalog: products, product_variants, brands, categories, collections, collection_products, colors, sizes, size_groups, size_systems',
    '- [x] Operations: branches, employees, roles, permissions, role_permissions, branch_role_employees, cash_registers, tenant_settings',
    '- [x] Sales: sales, sale_items, sale_payments, pos_sessions, cash_transactions',
    '- [x] Returns: sale_returns, sale_return_items, cancellation_reasons',
    '- [x] Customers: customers, customer_auth, customer_addresses, loyalty_ledgers, loyalty_configs',
    '- [x] Credit: credit_accounts, credit_transactions',
    '- [x] Layaways: layaways, layaway_items, layaway_payments',
    '- [x] Orders (B2C): orders, order_items, order_tracking, delivery_proofs',
    '- [x] Pre-Sales: pre_sales, pre_sale_items',
    '- [x] Purchasing: purchase_requisitions, requisition_items, purchase_orders, purchase_order_items, accounts_payable',
    '- [x] Suppliers: suppliers, variant_suppliers',
    '- [x] Inventory: inventory, inventory_transfers, inventory_transfer_items',
    '- [x] Audits: inventory_audits, inventory_audit_items, inventory_adjustments',
    '- [x] Finance: expenses, expense_categories, payment_methods, taxes',
    '- [x] Settings: tenant_settings, price_lists, storage_locations',
    '- [x] Integrations: tenant_integrations, integration_logs',
    '- [x] AI/Email: email_drafts',
    '- [x] Sizing: size_groups, size_systems, sizes, unit_of_measures',
    '',
    '## Phase 4: Live-Run Dispatcher (BullMQ)',
    '',
    `| Queue | Jobs Enqueued |`,
    `|-------|---------------|`,
    `| Email (notifications-queue) | ${AUDIT['live_email_jobs'] || 0} |`,
    `| WhatsApp (notifications-queue) | ${AUDIT['live_whatsapp_jobs'] || 0} |`,
    `| Reports (reports-queue) | ${AUDIT['live_report_jobs'] || 0} |`,
    '',
    `**Target Email:** ${LIVE_EMAIL_RECIPIENT}`,
    `**Target WhatsApp:** ${LIVE_WHATSAPP_RECIPIENT}`,
    `**Live Date Range:** 2026-05-15 → 2026-05-18`,
    '',
    '> Jobs are enqueued in BullMQ. The NestJS API server must be running to process them.',
    '> Email requires SMTP config (MAIL_HOST/MAIL_USER/MAIL_PASS).',
    '> WhatsApp requires Meta Cloud API config (WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN).',
    '',
    `---`,
    `🤖 Generated by Nivo Master Simulation Script`,
  ];

  const reportPath = path.resolve(__dirname, '../../../../.nivo-audit-report.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`\n📋 Audit report written to: ${reportPath}`);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  ✅ SIMULATION COMPLETE                          ║`);
  console.log(`║  📊 Total records: ${String(totalRecords).padEnd(30)}║`);
  console.log(`║  ⏱️  Elapsed: ${String(elapsed + 's').padEnd(35)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('\n❌ Simulation failed:', err);
  process.exit(1);
});
