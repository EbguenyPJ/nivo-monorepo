import pg from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { insert, insertMany, query } from '../../db/connection.js';
import { TenantProfile } from '../../config/tenants.js';
import { tenantCredentials } from '../../config/credentials.js';
import {
  SHOE_BRANDS, SHOE_CATEGORIES, COLORS_CATALOG, MEXICAN_CITIES,
  EXPENSE_CATEGORIES_LIST, PAYMENT_METHODS_LIST, CANCELLATION_REASONS_LIST,
  SHOE_MODELS, FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES,
} from '../../config/constants.js';
import {
  pick, pickN, randomInt, randomFloat, randomPhone, randomEmail, chance, shuffleArray,
} from '../../engine/probability.js';

export interface TenantSetupResult {
  branchIds: string[];
  employeeIds: string[];
  adminEmployeeId: string;
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
  variantIds: string[];
  supplierIds: string[];
  customerIds: string[];
  paymentMethodIds: Map<string, string>;
  cancellationReasonIds: string[];
  expenseCategoryIds: string[];
  cashRegisterIds: Map<string, string[]>; // branchId → registerIds
  priceListIds: string[];
  colorIds: string[];
  sizeGroupIds: string[];
  loyaltyConfigId?: string;
}

export async function setupTenantStaticData(
  pool: pg.Pool,
  profile: TenantProfile,
  createdAt: Date
): Promise<TenantSetupResult> {
  // ─── RBAC: Permissions & Roles ─────────────────────────────
  const PERMS = [
    { key: 'pos.vender', name: 'Realizar ventas', module: 'Punto de Venta', sort_order: 1 },
    { key: 'pos.devolver', name: 'Procesar devoluciones', module: 'Punto de Venta', sort_order: 2 },
    { key: 'pos.descuento', name: 'Aplicar descuentos', module: 'Punto de Venta', sort_order: 3 },
    { key: 'pos.cancelar_venta', name: 'Cancelar ventas', module: 'Punto de Venta', sort_order: 4 },
    { key: 'pos.apartados', name: 'Gestionar apartados', module: 'Punto de Venta', sort_order: 5 },
    { key: 'caja.abrir', name: 'Abrir caja', module: 'Caja', sort_order: 1 },
    { key: 'caja.cerrar', name: 'Cerrar caja (corte)', module: 'Caja', sort_order: 2 },
    { key: 'caja.retiro', name: 'Retiro de efectivo', module: 'Caja', sort_order: 3 },
    { key: 'caja.ingreso', name: 'Ingreso de efectivo', module: 'Caja', sort_order: 4 },
    { key: 'caja.ver_historial', name: 'Ver historial de cortes', module: 'Caja', sort_order: 5 },
    { key: 'catalogo.ver', name: 'Ver productos', module: 'Catálogo', sort_order: 1 },
    { key: 'catalogo.crear', name: 'Crear productos', module: 'Catálogo', sort_order: 2 },
    { key: 'catalogo.editar', name: 'Editar productos', module: 'Catálogo', sort_order: 3 },
    { key: 'catalogo.eliminar', name: 'Eliminar productos', module: 'Catálogo', sort_order: 4 },
    { key: 'catalogo.marcas', name: 'Gestionar marcas y categorías', module: 'Catálogo', sort_order: 5 },
    { key: 'inventario.ver', name: 'Ver stock', module: 'Inventario', sort_order: 1 },
    { key: 'inventario.ajustar', name: 'Ajustar stock manualmente', module: 'Inventario', sort_order: 2 },
    { key: 'inventario.traspasar', name: 'Realizar traspasos entre sucursales', module: 'Inventario', sort_order: 3 },
    { key: 'inventario.recibir', name: 'Recibir mercancía', module: 'Inventario', sort_order: 4 },
    { key: 'clientes.ver', name: 'Ver clientes', module: 'Clientes', sort_order: 1 },
    { key: 'clientes.crear', name: 'Crear clientes', module: 'Clientes', sort_order: 2 },
    { key: 'clientes.editar', name: 'Editar clientes', module: 'Clientes', sort_order: 3 },
    { key: 'clientes.puntos', name: 'Gestionar programa de lealtad', module: 'Clientes', sort_order: 4 },
    { key: 'reportes.ventas', name: 'Ver reporte de ventas', module: 'Reportes', sort_order: 1 },
    { key: 'reportes.inventario', name: 'Ver reporte de inventario', module: 'Reportes', sort_order: 2 },
    { key: 'reportes.empleados', name: 'Ver reporte de empleados', module: 'Reportes', sort_order: 3 },
    { key: 'reportes.financiero', name: 'Ver reporte financiero', module: 'Reportes', sort_order: 4 },
    { key: 'reportes.exportar', name: 'Exportar reportes', module: 'Reportes', sort_order: 5 },
    { key: 'admin.sucursales', name: 'Gestionar sucursales', module: 'Administración', sort_order: 1 },
    { key: 'admin.empleados', name: 'Gestionar empleados', module: 'Administración', sort_order: 2 },
    { key: 'admin.roles', name: 'Gestionar roles y permisos', module: 'Administración', sort_order: 3 },
    { key: 'admin.catalogos_sistema', name: 'Editar catálogos del sistema', module: 'Administración', sort_order: 4 },
    { key: 'admin.configuracion', name: 'Configuración general', module: 'Administración', sort_order: 5 },
    { key: 'admin.facturacion', name: 'Facturación electrónica', module: 'Administración', sort_order: 6 },
    { key: 'admin.suscripcion', name: 'Gestionar suscripción', module: 'Administración', sort_order: 7 },
    { key: 'gastos.ver', name: 'Ver gastos', module: 'Gastos', sort_order: 1 },
    { key: 'gastos.crear', name: 'Registrar gastos', module: 'Gastos', sort_order: 2 },
    { key: 'gastos.eliminar', name: 'Eliminar gastos', module: 'Gastos', sort_order: 3 },
  ];

  const permIds = await insertMany(pool, 'permissions', PERMS.map(p => ({
    key: p.key, name: p.name, module: p.module, submodule: null, sort_order: p.sort_order,
  })));
  const permKeyToId = new Map(PERMS.map((p, i) => [p.key, permIds[i]]));

  const adminRoleId = await insert(pool, 'roles', { slug: 'admin', name: 'Administrador', description: 'Acceso total', is_system: true });
  const managerRoleId = await insert(pool, 'roles', { slug: 'manager', name: 'Gerente de Sucursal', description: 'Operaciones de sucursal', is_system: true });
  const cashierRoleId = await insert(pool, 'roles', { slug: 'cashier', name: 'Cajero', description: 'Punto de venta básico', is_system: true });

  // Admin gets all permissions
  await insertMany(pool, 'role_has_permissions', permIds.map(pid => ({ role_id: adminRoleId, permission_id: pid })));

  // Manager gets most
  const managerPerms = PERMS.filter(p => !p.key.startsWith('admin.') && p.key !== 'catalogo.eliminar' && p.key !== 'reportes.financiero' && p.key !== 'reportes.exportar' && p.key !== 'gastos.eliminar');
  await insertMany(pool, 'role_has_permissions', managerPerms.map(p => ({ role_id: managerRoleId, permission_id: permKeyToId.get(p.key)! })));

  // Cashier gets basics
  const cashierPerms = ['pos.vender', 'pos.apartados', 'caja.abrir', 'caja.cerrar', 'catalogo.ver', 'inventario.ver', 'clientes.ver', 'clientes.crear'];
  await insertMany(pool, 'role_has_permissions', cashierPerms.map(k => ({ role_id: cashierRoleId, permission_id: permKeyToId.get(k)! })));

  // ─── Branches ──────────────────────────────────────────────
  const cities = shuffleArray([...MEXICAN_CITIES]);
  const branchIds: string[] = [];
  const branchCodes = ['PRINCIPAL', 'SUC-02', 'SUC-03', 'SUC-04', 'SUC-05', 'SUC-06', 'SUC-07', 'SUC-08', 'SUC-09', 'SUC-10'];
  const branchNames = [
    'Sucursal Principal', 'Sucursal Centro', 'Sucursal Norte', 'Sucursal Sur',
    'Sucursal Poniente', 'Sucursal Oriente', 'Sucursal Plaza', 'Sucursal Mall',
    'Sucursal Outlet', 'Sucursal Express',
  ];

  for (let i = 0; i < profile.initialBranches; i++) {
    const city = cities[i % cities.length];
    const id = await insert(pool, 'branches', {
      name: branchNames[i], code: branchCodes[i],
      address: `Calle ${randomInt(1, 50)} Sur #${randomInt(100, 9999)}, Col. ${pick(['Centro', 'La Paz', 'Reforma', 'Las Ánimas', 'Huexotitla'])}`,
      city: city.city, zip_code: city.zip, phone: randomPhone(),
      ticket_footer: `${profile.name} — ${branchNames[i]}\nGracias por su compra!`,
      latitude: city.lat + randomFloat(-0.02, 0.02), longitude: city.lng + randomFloat(-0.02, 0.02),
      is_active: true, created_at: createdAt.toISOString(),
    });
    branchIds.push(id);
  }

  // ─── Storage Locations per branch ─────────────────────────
  for (const bId of branchIds) {
    const aisles = ['A', 'B', 'C'];
    for (const aisle of aisles) {
      const aisleId = await insert(pool, 'storage_locations', {
        branch_id: bId, parent_id: null, name: `Pasillo ${aisle}`, code: aisle, type: 'aisle', is_active: true,
      });
      for (let s = 1; s <= 4; s++) {
        await insert(pool, 'storage_locations', {
          branch_id: bId, parent_id: aisleId, name: `Estante ${aisle}-${s}`, code: `${aisle}-${s}`, type: 'shelf', is_active: true,
        });
      }
    }
  }

  // ─── Cash Registers ────────────────────────────────────────
  const cashRegisterIds = new Map<string, string[]>();
  for (const bId of branchIds) {
    const regs: string[] = [];
    const regCount = profile.profile === 'giant' ? 3 : profile.profile === 'family' ? 1 : 2;
    for (let r = 1; r <= regCount; r++) {
      const rid = await insert(pool, 'cash_registers', {
        branch_id: bId, name: `Caja ${r}`, is_active: true,
      });
      regs.push(rid);
    }
    cashRegisterIds.set(bId, regs);
  }

  // ─── Employees ─────────────────────────────────────────────
  const employeeIds: string[] = [];
  const cred = tenantCredentials(profile.subdomain);
  const adminHash = bcrypt.hashSync(cred.password, 10);
  const pinHash = bcrypt.hashSync('1234', 10);

  const adminEmpId = await insert(pool, 'employees', {
    name: 'Administrador', email: cred.email, password_hash: adminHash,
    phone: randomPhone(), pin_hash: pinHash, role: 'admin', role_id: adminRoleId,
    branch_id: branchIds[0], is_owner: true, is_active: true, created_at: createdAt.toISOString(),
  });
  employeeIds.push(adminEmpId);

  // Managers: 1 per branch
  for (let b = 0; b < branchIds.length; b++) {
    const name = `${pick(FIRST_NAMES_M)} ${pick(LAST_NAMES)}`;
    const eid = await insert(pool, 'employees', {
      name, email: randomEmail(name, `${profile.subdomain}.nivo.com`),
      password_hash: adminHash, phone: randomPhone(), pin_hash: bcrypt.hashSync(String(1000 + b), 10),
      role: 'manager', role_id: managerRoleId, branch_id: branchIds[b],
      is_owner: false, is_active: true, created_at: createdAt.toISOString(),
    });
    employeeIds.push(eid);
    await insert(pool, 'branch_role_employees', {
      employee_id: eid, branch_id: branchIds[b], role_id: managerRoleId,
    });
  }

  // Cashiers: 2-4 per branch
  const cashiersPerBranch = profile.profile === 'giant' ? 4 : profile.profile === 'family' ? 1 : 2;
  for (const bId of branchIds) {
    for (let c = 0; c < cashiersPerBranch; c++) {
      const isFemale = chance(0.5);
      const name = `${pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M)} ${pick(LAST_NAMES)}`;
      const eid = await insert(pool, 'employees', {
        name, email: randomEmail(name, `${profile.subdomain}.nivo.com`),
        password_hash: adminHash, phone: randomPhone(),
        pin_hash: bcrypt.hashSync(String(2000 + randomInt(0, 999)), 10),
        role: 'cashier', role_id: cashierRoleId, branch_id: bId,
        is_owner: false, is_active: true, created_at: createdAt.toISOString(),
      });
      employeeIds.push(eid);
      await insert(pool, 'branch_role_employees', {
        employee_id: eid, branch_id: bId, role_id: cashierRoleId,
      });
    }
  }

  // ─── Catalogs ──────────────────────────────────────────────
  // Payment methods
  const paymentMethodIds = new Map<string, string>();
  for (const pm of PAYMENT_METHODS_LIST) {
    const pmId = await insert(pool, 'payment_methods', { name: pm.name, requires_reference: pm.requiresRef, is_active: true });
    paymentMethodIds.set(pm.name, pmId);
  }

  // Taxes
  await insertMany(pool, 'taxes', [
    { name: 'IVA 16%', percentage: 16.0, is_active: true },
    { name: 'IVA 8%', percentage: 8.0, is_active: true },
    { name: 'Exento', percentage: 0.0, is_active: true },
  ]);

  // Cancellation reasons
  const cancellationReasonIds = await insertMany(pool, 'cancellation_reasons',
    CANCELLATION_REASONS_LIST.map(r => ({ name: r.name, affects_inventory: r.affectsInventory, is_active: true }))
  );

  // Units of measure
  await insertMany(pool, 'units_of_measure', [
    { name: 'Pieza', abbreviation: 'pz', is_active: true },
    { name: 'Par', abbreviation: 'par', is_active: true },
    { name: 'Caja', abbreviation: 'cja', is_active: true },
  ]);

  // Expense categories
  const expenseCategoryIds = await insertMany(pool, 'expense_categories',
    EXPENSE_CATEGORIES_LIST.map(name => ({ name, is_active: true }))
  );

  // Colors
  const colorIds = await insertMany(pool, 'colors',
    COLORS_CATALOG.map(c => ({ name: c.name, hex_code: c.hex, branch_id: null, is_active: true }))
  );

  // Size groups, systems & sizes
  const sizeGroupIds: string[] = [];
  const hombreGroupId = await insert(pool, 'size_groups', { name: 'Hombre', is_active: true });
  const mujerGroupId = await insert(pool, 'size_groups', { name: 'Mujer', is_active: true });
  const infantilGroupId = await insert(pool, 'size_groups', { name: 'Infantil', is_active: true });
  sizeGroupIds.push(hombreGroupId, mujerGroupId, infantilGroupId);

  const mexSysId = await insert(pool, 'size_systems', { name: 'MEX', is_active: true });
  const usSysId = await insert(pool, 'size_systems', { name: 'US', is_active: true });
  const eurSysId = await insert(pool, 'size_systems', { name: 'EUR', is_active: true });

  // Hombre sizes
  const hombreMatrix = [
    { mex: '25', us: '7', eur: '39' }, { mex: '25.5', us: '7.5', eur: '39.5' },
    { mex: '26', us: '8', eur: '40' }, { mex: '26.5', us: '8.5', eur: '41' },
    { mex: '27', us: '9', eur: '42' }, { mex: '27.5', us: '9.5', eur: '42.5' },
    { mex: '28', us: '10', eur: '43' }, { mex: '28.5', us: '10.5', eur: '44' },
    { mex: '29', us: '11', eur: '44.5' }, { mex: '30', us: '12', eur: '46' },
  ];
  for (let i = 0; i < hombreMatrix.length; i++) {
    const sizeId = await insert(pool, 'sizes', { size_group_id: hombreGroupId, order_index: i });
    await insertMany(pool, 'size_equivalencies', [
      { size_id: sizeId, size_system_id: mexSysId, value: hombreMatrix[i].mex },
      { size_id: sizeId, size_system_id: usSysId, value: hombreMatrix[i].us },
      { size_id: sizeId, size_system_id: eurSysId, value: hombreMatrix[i].eur },
    ]);
  }

  // Mujer sizes
  const mujerMatrix = [
    { mex: '22', us: '5', eur: '35' }, { mex: '22.5', us: '5.5', eur: '35.5' },
    { mex: '23', us: '6', eur: '36' }, { mex: '23.5', us: '6.5', eur: '36.5' },
    { mex: '24', us: '7', eur: '37' }, { mex: '24.5', us: '7.5', eur: '38' },
    { mex: '25', us: '8', eur: '38.5' }, { mex: '26', us: '9', eur: '40' },
  ];
  for (let i = 0; i < mujerMatrix.length; i++) {
    const sizeId = await insert(pool, 'sizes', { size_group_id: mujerGroupId, order_index: i });
    await insertMany(pool, 'size_equivalencies', [
      { size_id: sizeId, size_system_id: mexSysId, value: mujerMatrix[i].mex },
      { size_id: sizeId, size_system_id: usSysId, value: mujerMatrix[i].us },
      { size_id: sizeId, size_system_id: eurSysId, value: mujerMatrix[i].eur },
    ]);
  }

  // Price lists
  const priceListIds: string[] = [];
  priceListIds.push(await insert(pool, 'price_lists', { name: 'Público General', default_margin_percentage: 30, is_default: true, is_active: true }));
  priceListIds.push(await insert(pool, 'price_lists', { name: 'Mayoreo', default_margin_percentage: 15, is_default: false, is_active: true }));
  if (profile.profile === 'premium' || profile.profile === 'giant') {
    priceListIds.push(await insert(pool, 'price_lists', { name: 'VIP', default_margin_percentage: 20, is_default: false, is_active: true }));
  }

  // Tenant settings
  const settings = [
    { key: 'operacion.default_landed_cost_percentage', value: '0', label: 'Margen de Costo Operativo (%)', group: 'operacion' },
    { key: 'operacion.auto_generate_sku', value: 'true', label: 'Generar SKU automáticamente', group: 'operacion' },
    { key: 'operacion.require_barcode', value: 'false', label: 'Requerir código de barras', group: 'operacion' },
    { key: 'ticket.show_logo', value: 'true', label: 'Mostrar logo en tickets', group: 'ticket' },
    { key: 'ticket.show_branch_address', value: 'true', label: 'Mostrar dirección en tickets', group: 'ticket' },
    { key: 'ticket.business_name', value: profile.name, label: 'Nombre del negocio', group: 'ticket' },
    { key: 'ticket.rfc', value: profile.rfc, label: 'RFC del negocio', group: 'ticket' },
    { key: 'ticket.footer_message', value: 'Gracias por tu compra!', label: 'Mensaje de pie de ticket', group: 'ticket' },
    { key: 'branding.primary_color', value: pick(['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']), label: 'Color principal', group: 'apariencia' },
    { key: 'branding.theme_mode', value: 'dark', label: 'Modo de tema', group: 'apariencia' },
  ];
  await insertMany(pool, 'tenant_settings', settings);

  // ─── Brands ────────────────────────────────────────────────
  const brandCount = profile.profile === 'premium' ? 3 : profile.profile === 'giant' ? 10 : randomInt(4, 8);
  const selectedBrands = pickN(SHOE_BRANDS, brandCount);
  const brandIds = await insertMany(pool, 'brands',
    selectedBrands.map(name => ({ name, logo_url: `/uploads/brands/${name.toLowerCase().replace(/\s/g, '-')}.png`, is_active: true }))
  );

  // ─── Categories ────────────────────────────────────────────
  const catCount = profile.profile === 'kids' ? 3 : profile.profile === 'formal' ? 4 : randomInt(5, 8);
  let selectedCats = pickN(SHOE_CATEGORIES, catCount);
  if (profile.profile === 'kids') selectedCats = ['Infantil', 'Escolar', 'Deportivo'];
  if (profile.profile === 'formal') selectedCats = ['Formal', 'Casual', 'Tacón', 'Plataforma'];
  const categoryIds = await insertMany(pool, 'categories',
    selectedCats.map(name => ({ name }))
  );

  // ─── Collections ───────────────────────────────────────────
  const collectionNames = ['Temporada Primavera-Verano', 'Temporada Otoño-Invierno', 'Liquidación', 'Nuevos Ingresos', 'Bestsellers'];
  const collColors = ['#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6'];
  for (let c = 0; c < Math.min(collectionNames.length, 4); c++) {
    await insert(pool, 'collections', {
      name: collectionNames[c], color: collColors[c], sort_order: c, is_active: true,
    });
  }

  // ─── Suppliers ─────────────────────────────────────────────
  const supplierNames = [
    'Distribuidora Nacional de Calzado SA de CV', 'Cueros y Suelas del Bajío',
    'Importadora Shoe Trade México', 'Grupo Calzado Industrial SA',
    'Proveedora Flexi Mayoreo', 'Materiales y Hormas del Centro',
  ];
  const supplierCount = profile.profile === 'giant' ? 6 : profile.profile === 'family' ? 2 : randomInt(3, 5);
  const supplierIds = await insertMany(pool, 'suppliers',
    supplierNames.slice(0, supplierCount).map(name => ({
      name, tax_id: `SUP${randomInt(100000, 999999)}`,
      contact_name: `${pick(FIRST_NAMES_M)} ${pick(LAST_NAMES)}`,
      email: randomEmail(name, 'proveedor.mx'), phone: randomPhone(),
      credit_days: pick([15, 30, 45, 60]), is_active: true,
    }))
  );

  // ─── Products & Variants ──────────────────────────────────
  const productCount = profile.profile === 'giant' ? 80 : profile.profile === 'family' ? 20 : profile.profile === 'kids' ? 30 : randomInt(35, 60);
  const productIds: string[] = [];
  const variantIds: string[] = [];

  for (let p = 0; p < productCount; p++) {
    const catName = selectedCats[p % selectedCats.length];
    const brandIdx = p % brandIds.length;
    const models = SHOE_MODELS[catName] || SHOE_MODELS.Casual;
    const modelName = models[p % models.length];
    const brandName = selectedBrands[brandIdx];

    const basePrice = catName === 'Formal' || catName === 'Botas'
      ? randomFloat(800, 2500)
      : catName === 'Industrial'
        ? randomFloat(600, 1800)
        : catName === 'Infantil' || catName === 'Escolar'
          ? randomFloat(250, 700)
          : randomFloat(400, 1500);

    const productId = await insert(pool, 'products', {
      name: `${brandName} ${modelName}`,
      description: `Zapato ${catName.toLowerCase()} ${brandName} modelo ${modelName}`,
      brand_id: brandIds[brandIdx],
      category_id: categoryIds[p % categoryIds.length],
      base_price: basePrice,
      images: JSON.stringify([`/uploads/products/shoe-${(p % 50) + 1}.jpg`]),
      image_url: `/uploads/products/shoe-${(p % 50) + 1}.jpg`,
      is_active: true,
      created_at: createdAt.toISOString(),
    });
    productIds.push(productId);

    // Generate variants: 2-4 colors × 4-8 sizes
    const variantColors = pickN(COLORS_CATALOG, randomInt(2, 4));
    const sizesPerVariant = randomInt(4, 8);
    const startSize = randomInt(0, 5);

    for (const color of variantColors) {
      for (let s = 0; s < sizesPerVariant; s++) {
        const sizeValue = String(22 + startSize + s * 0.5);
        const cost = randomFloat(basePrice * 0.35, basePrice * 0.55);
        const isLiquidation = chance(0.08);
        const margin = isLiquidation ? randomFloat(0.08, 0.15) : randomFloat(0.40, 0.75);

        const sku = `${brandName.substring(0, 3).toUpperCase()}-${modelName.replace(/\s/g, '').substring(0, 4).toUpperCase()}-${color.name.substring(0, 3).toUpperCase()}-${sizeValue.replace('.', '')}`;
        const barcode = `77${String(randomInt(10000000000, 99999999999))}`;

        const vid = await insert(pool, 'product_variants', {
          product_id: productId,
          sku: `${sku}-${uuid().substring(0, 4)}`,
          attributes: JSON.stringify({ color: color.name, talla: sizeValue, colorHex: color.hex }),
          price_override: isLiquidation ? randomFloat(basePrice * 0.5, basePrice * 0.7) : null,
          cost,
          barcode,
          images: JSON.stringify([]),
          is_active: true,
          created_at: createdAt.toISOString(),
        });
        variantIds.push(vid);

        // Link to default supplier
        if (supplierIds.length > 0) {
          await insert(pool, 'variant_suppliers', {
            variant_id: vid, supplier_id: supplierIds[p % supplierIds.length],
            supplier_sku: `PROV-${sku}`, last_cost: cost, is_default: true,
          });
        }
      }
    }
  }

  // ─── Inventory: distribute stock across branches ───────────
  for (const vid of variantIds) {
    for (const bId of branchIds) {
      const stock = randomInt(0, 15);
      await insert(pool, 'inventory', {
        variant_id: vid, branch_id: bId,
        stock_available: stock, stock_minimum: randomInt(2, 5), stock_maximum: randomInt(20, 50),
      });
    }
  }

  // ─── Customers ─────────────────────────────────────────────
  const customerCount = profile.profile === 'giant' ? 200 : profile.profile === 'b2c' ? 150 : profile.profile === 'family' ? 30 : randomInt(50, 120);
  const customerIds: string[] = [];

  for (let c = 0; c < customerCount; c++) {
    const isFemale = chance(0.55);
    const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M);
    const lastName1 = pick(LAST_NAMES);
    const lastName2 = pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName1} ${lastName2}`;
    const city = pick(MEXICAN_CITIES);

    const custId = await insert(pool, 'customers', {
      name: fullName, first_name: firstName, last_name: `${lastName1} ${lastName2}`,
      email: chance(0.7) ? randomEmail(fullName) : null,
      phone: chance(0.8) ? randomPhone() : null,
      rfc: chance(0.15) ? `${lastName1.substring(0, 2).toUpperCase()}${firstName.substring(0, 2).toUpperCase()}${randomInt(70, 99)}${String(randomInt(1, 12)).padStart(2, '0')}${String(randomInt(1, 28)).padStart(2, '0')}XX${randomInt(0, 9)}` : null,
      date_of_birth: chance(0.4) ? new Date(randomInt(1960, 2005), randomInt(0, 11), randomInt(1, 28)).toISOString().split('T')[0] : null,
      loyalty_points: profile.loyaltyActive ? randomInt(0, 500) : 0,
      membership_tier: profile.loyaltyActive && chance(0.3) ? pick(['bronce', 'plata', 'oro']) : null,
      is_active: true, tags: JSON.stringify([]),
      created_at: new Date(createdAt.getTime() + randomInt(0, 86400000 * 60)).toISOString(),
    });
    customerIds.push(custId);

    // Address for some customers
    if (chance(0.5)) {
      await insert(pool, 'customer_addresses', {
        customer_id: custId, label: 'Casa',
        street: `Calle ${randomInt(1, 100)} ${pick(['Norte', 'Sur', 'Poniente', 'Oriente'])} #${randomInt(100, 9999)}`,
        neighborhood: pick(['Centro', 'La Paz', 'Reforma', 'Las Ánimas', 'Huexotitla', 'San Manuel', 'Zavaleta']),
        city: city.city, state: city.state, zip_code: city.zip,
        country: 'México', is_default: true,
      });
    }

    // Mobile auth for B2C customers
    if (profile.onlinePercentage > 20 && chance(0.4)) {
      const email = randomEmail(fullName);
      await insert(pool, 'customer_auth', {
        customer_id: custId, email,
        password_hash: bcrypt.hashSync('cliente123!', 10),
        phone: randomPhone(), is_verified: chance(0.8),
      }).catch(() => {}); // skip if duplicate email
    }
  }

  // ─── Loyalty Config ────────────────────────────────────────
  let loyaltyConfigId: string | undefined;
  if (profile.loyaltyActive) {
    loyaltyConfigId = await insert(pool, 'loyalty_configs', {
      is_active: true, spend_per_point: 10, point_value: 0.10,
      min_redemption_points: 100, expiration_days: 365,
      earn_on_layaway: true, earn_on_credit: false,
    });
  }

  // ─── Credit Accounts (for credit-heavy tenants) ────────────
  if (profile.creditRate > 0.03) {
    const creditCustomers = pickN(customerIds, Math.floor(customerIds.length * 0.1));
    for (const custId of creditCustomers) {
      await insert(pool, 'credit_accounts', {
        customer_id: custId, credit_limit: randomFloat(3000, 15000),
        current_balance: 0, payment_terms: pick([15, 30, 45]),
        is_active: true,
      });
    }
  }

  // ─── Tenant Integrations ────────────────────────────────────
  const integrations = [
    { integration_type: 'whatsapp', display_name: 'WhatsApp Business', is_active: profile.plan !== 'free', status: profile.plan !== 'free' ? 'active' : 'inactive' },
    { integration_type: 'facturama', display_name: 'Facturama (CFDI)', is_active: profile.plan === 'pro' || profile.plan === 'enterprise', status: profile.plan === 'pro' || profile.plan === 'enterprise' ? 'active' : 'inactive' },
    { integration_type: 'email', display_name: 'Notificaciones por email', is_active: true, status: 'active' },
  ];

  for (const integ of integrations) {
    const integId = await insert(pool, 'tenant_integrations', {
      ...integ,
      credentials_encrypted: 'encrypted_demo_credentials',
      last_tested_at: integ.is_active ? createdAt.toISOString() : null,
    });

    if (integ.is_active) {
      await insert(pool, 'integration_logs', {
        integration_id: integId,
        action: 'test_connection',
        status: 'success',
        request_payload: JSON.stringify({ type: 'ping' }),
        response_payload: JSON.stringify({ ok: true }),
        duration_ms: randomInt(50, 300),
        created_at: createdAt.toISOString(),
      });
    }
  }

  console.log(`  Setup complete: ${branchIds.length} branches, ${employeeIds.length} employees, ${productIds.length} products (${variantIds.length} variants), ${customerIds.length} customers`);

  return {
    branchIds, employeeIds, adminEmployeeId: adminEmpId,
    categoryIds, brandIds, productIds, variantIds, supplierIds, customerIds,
    paymentMethodIds, cancellationReasonIds, expenseCategoryIds,
    cashRegisterIds, priceListIds, colorIds, sizeGroupIds,
    loyaltyConfigId,
  };
}
