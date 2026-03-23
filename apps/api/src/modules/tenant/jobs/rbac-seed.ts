/**
 * Master permission catalog + default role mappings.
 * Used during tenant provisioning to seed the RBAC tables.
 */

export interface PermissionSeed {
  key: string;
  name: string;
  module: string;
  submodule?: string;
  sort_order: number;
}

// ─── All permissions in the system ────────────────────────────────
export const SYSTEM_PERMISSIONS: PermissionSeed[] = [
  // Punto de Venta
  { key: 'pos.vender', name: 'Realizar ventas', module: 'Punto de Venta', sort_order: 1 },
  { key: 'pos.devolver', name: 'Procesar devoluciones', module: 'Punto de Venta', sort_order: 2 },
  { key: 'pos.descuento', name: 'Aplicar descuentos', module: 'Punto de Venta', sort_order: 3 },
  { key: 'pos.cancelar_venta', name: 'Cancelar ventas', module: 'Punto de Venta', sort_order: 4 },
  { key: 'pos.apartados', name: 'Gestionar apartados', module: 'Punto de Venta', sort_order: 5 },

  // Caja
  { key: 'caja.abrir', name: 'Abrir caja', module: 'Caja', sort_order: 1 },
  { key: 'caja.cerrar', name: 'Cerrar caja (corte)', module: 'Caja', sort_order: 2 },
  { key: 'caja.retiro', name: 'Retiro de efectivo', module: 'Caja', sort_order: 3 },
  { key: 'caja.ingreso', name: 'Ingreso de efectivo', module: 'Caja', sort_order: 4 },
  { key: 'caja.ver_historial', name: 'Ver historial de cortes', module: 'Caja', sort_order: 5 },

  // Catálogo
  { key: 'catalogo.ver', name: 'Ver productos', module: 'Catálogo', sort_order: 1 },
  { key: 'catalogo.crear', name: 'Crear productos', module: 'Catálogo', sort_order: 2 },
  { key: 'catalogo.editar', name: 'Editar productos', module: 'Catálogo', sort_order: 3 },
  { key: 'catalogo.eliminar', name: 'Eliminar productos', module: 'Catálogo', sort_order: 4 },
  { key: 'catalogo.marcas', name: 'Gestionar marcas y categorías', module: 'Catálogo', sort_order: 5 },

  // Inventario
  { key: 'inventario.ver', name: 'Ver stock', module: 'Inventario', sort_order: 1 },
  { key: 'inventario.ajustar', name: 'Ajustar stock manualmente', module: 'Inventario', sort_order: 2 },
  { key: 'inventario.traspasar', name: 'Realizar traspasos entre sucursales', module: 'Inventario', sort_order: 3 },
  { key: 'inventario.recibir', name: 'Recibir mercancía', module: 'Inventario', sort_order: 4 },

  // Clientes
  { key: 'clientes.ver', name: 'Ver clientes', module: 'Clientes', sort_order: 1 },
  { key: 'clientes.crear', name: 'Crear clientes', module: 'Clientes', sort_order: 2 },
  { key: 'clientes.editar', name: 'Editar clientes', module: 'Clientes', sort_order: 3 },
  { key: 'clientes.puntos', name: 'Gestionar programa de lealtad', module: 'Clientes', sort_order: 4 },

  // Reportes
  { key: 'reportes.ventas', name: 'Ver reporte de ventas', module: 'Reportes', sort_order: 1 },
  { key: 'reportes.inventario', name: 'Ver reporte de inventario', module: 'Reportes', sort_order: 2 },
  { key: 'reportes.empleados', name: 'Ver reporte de empleados', module: 'Reportes', sort_order: 3 },
  { key: 'reportes.financiero', name: 'Ver reporte financiero', module: 'Reportes', sort_order: 4 },
  { key: 'reportes.exportar', name: 'Exportar reportes', module: 'Reportes', sort_order: 5 },

  // Administración
  { key: 'admin.sucursales', name: 'Gestionar sucursales', module: 'Administración', sort_order: 1 },
  { key: 'admin.empleados', name: 'Gestionar empleados', module: 'Administración', sort_order: 2 },
  { key: 'admin.roles', name: 'Gestionar roles y permisos', module: 'Administración', sort_order: 3 },
  { key: 'admin.catalogos_sistema', name: 'Editar catálogos del sistema', module: 'Administración', sort_order: 4 },
  { key: 'admin.configuracion', name: 'Configuración general', module: 'Administración', sort_order: 5 },
  { key: 'admin.facturacion', name: 'Facturación electrónica', module: 'Administración', sort_order: 6 },
  { key: 'admin.suscripcion', name: 'Gestionar suscripción', module: 'Administración', sort_order: 7 },

  // Gastos
  { key: 'gastos.ver', name: 'Ver gastos', module: 'Gastos', sort_order: 1 },
  { key: 'gastos.crear', name: 'Registrar gastos', module: 'Gastos', sort_order: 2 },
  { key: 'gastos.eliminar', name: 'Eliminar gastos', module: 'Gastos', sort_order: 3 },
];

// ─── Default role definitions ─────────────────────────────────────

interface RoleSeed {
  slug: string;
  name: string;
  description: string;
  /** Permission keys assigned to this role */
  permissions: string[];
}

export const DEFAULT_ROLES: RoleSeed[] = [
  {
    slug: 'admin',
    name: 'Administrador',
    description: 'Acceso total al sistema. Gestiona sucursales, empleados, configuración y reportes.',
    permissions: SYSTEM_PERMISSIONS.map((p) => p.key), // ALL permissions
  },
  {
    slug: 'manager',
    name: 'Gerente de Sucursal',
    description: 'Gestiona operaciones de la sucursal: ventas, inventario, caja y reportes básicos.',
    permissions: [
      // POS
      'pos.vender', 'pos.devolver', 'pos.descuento', 'pos.cancelar_venta', 'pos.apartados',
      // Caja
      'caja.abrir', 'caja.cerrar', 'caja.retiro', 'caja.ingreso', 'caja.ver_historial',
      // Catálogo (ver + editar)
      'catalogo.ver', 'catalogo.crear', 'catalogo.editar', 'catalogo.marcas',
      // Inventario
      'inventario.ver', 'inventario.ajustar', 'inventario.traspasar', 'inventario.recibir',
      // Clientes
      'clientes.ver', 'clientes.crear', 'clientes.editar', 'clientes.puntos',
      // Reportes (ver, no exportar financiero)
      'reportes.ventas', 'reportes.inventario', 'reportes.empleados',
      // Gastos
      'gastos.ver', 'gastos.crear',
    ],
  },
  {
    slug: 'cashier',
    name: 'Cajero',
    description: 'Acceso al Punto de Venta y operaciones básicas de caja.',
    permissions: [
      'pos.vender', 'pos.apartados',
      'caja.abrir', 'caja.cerrar',
      'catalogo.ver',
      'inventario.ver',
      'clientes.ver', 'clientes.crear',
    ],
  },
];
