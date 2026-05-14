export const SIM_START_DATE = new Date();
SIM_START_DATE.setMonth(SIM_START_DATE.getMonth() - 6);
SIM_START_DATE.setHours(0, 0, 0, 0);

export const SIM_END_DATE = new Date();
SIM_END_DATE.setHours(23, 59, 59, 999);

export const TOTAL_DAYS = Math.ceil(
  (SIM_END_DATE.getTime() - SIM_START_DATE.getTime()) / (1000 * 60 * 60 * 24)
);

export const DB_CONFIG = {
  host: process.env.DEMO_DB_HOST || 'localhost',
  port: parseInt(process.env.DEMO_DB_PORT || '5434'),
  user: 'nivo_admin',
  password: 'nivo_secret_2024',
  masterDb: 'nivo_master_db',
};

export const SHOE_BRANDS = [
  'Nike', 'Adidas', 'Flexi', 'Andrea', 'Caterpillar', 'Skechers',
  'Converse', 'Vans', 'Puma', 'New Balance', 'Reebok', 'Fila',
  'Hush Puppies', 'Timberland', 'Dr. Martens', 'Crocs',
];

export const SHOE_CATEGORIES = [
  'Deportivo', 'Casual', 'Formal', 'Botas', 'Sandalias',
  'Infantil', 'Escolar', 'Industrial', 'Plataforma', 'Tacón',
];

export const MEXICAN_CITIES = [
  { city: 'Puebla', state: 'Puebla', zip: '72000', lat: 19.0414, lng: -98.2063 },
  { city: 'CDMX Centro', state: 'CDMX', zip: '06000', lat: 19.4326, lng: -99.1332 },
  { city: 'CDMX Sur', state: 'CDMX', zip: '14000', lat: 19.3100, lng: -99.1650 },
  { city: 'Guadalajara', state: 'Jalisco', zip: '44100', lat: 20.6597, lng: -103.3496 },
  { city: 'Monterrey', state: 'Nuevo León', zip: '64000', lat: 25.6866, lng: -100.3161 },
  { city: 'Querétaro', state: 'Querétaro', zip: '76000', lat: 20.5888, lng: -100.3899 },
  { city: 'Tlaxcala', state: 'Tlaxcala', zip: '90000', lat: 19.3182, lng: -98.2375 },
  { city: 'Cholula', state: 'Puebla', zip: '72760', lat: 19.0634, lng: -98.3044 },
  { city: 'Atlixco', state: 'Puebla', zip: '74200', lat: 18.9068, lng: -98.4367 },
  { city: 'León', state: 'Guanajuato', zip: '37000', lat: 21.1221, lng: -101.6860 },
  { city: 'Mérida', state: 'Yucatán', zip: '97000', lat: 20.9674, lng: -89.5926 },
  { city: 'Oaxaca', state: 'Oaxaca', zip: '68000', lat: 17.0732, lng: -96.7266 },
];

export const FIRST_NAMES_M = [
  'Carlos', 'Miguel', 'José', 'Juan', 'Pedro', 'Luis', 'Fernando',
  'Roberto', 'Eduardo', 'Alejandro', 'Ricardo', 'Daniel', 'Sergio',
  'Francisco', 'Antonio', 'Manuel', 'Raúl', 'Arturo', 'Enrique', 'Óscar',
];

export const FIRST_NAMES_F = [
  'María', 'Ana', 'Laura', 'Carmen', 'Patricia', 'Rosa', 'Guadalupe',
  'Sofía', 'Fernanda', 'Lucía', 'Daniela', 'Mónica', 'Elena', 'Isabel',
  'Claudia', 'Adriana', 'Gabriela', 'Verónica', 'Leticia', 'Silvia',
];

export const LAST_NAMES = [
  'García', 'Hernández', 'López', 'Martínez', 'González', 'Rodríguez',
  'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera',
  'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Gutiérrez',
  'Ortiz', 'Mendoza', 'Ruiz', 'Aguilar', 'Muñoz', 'Romero',
];

export const SHOE_MODELS: Record<string, string[]> = {
  Deportivo: ['Air Runner Pro', 'Speed Max 3', 'Ultra Boost MX', 'Flex Stride', 'Cloud Run 2'],
  Casual: ['Urban Step', 'City Walk', 'Comfort Slip', 'Weekend Lace', 'Easy Go'],
  Formal: ['Oxford Classic', 'Derby Premium', 'Monk Strap Lux', 'Loafer Elite', 'Wingtip Pro'],
  Botas: ['Trail Master', 'Urban Boot', 'Chelsea Classic', 'Work Force 8"', 'Hiker Peak'],
  Sandalias: ['Beach Rider', 'Summer Slide', 'Comfort Sandal', 'Sport Strap', 'Casual Open'],
  Infantil: ['Kids Jump', 'Mini Runner', 'School Step', 'Play Time', 'Little Star'],
  Escolar: ['Scholar Pro', 'Campus Walk', 'Class Act', 'Study Mate', 'Uniform Fit'],
  Industrial: ['Safety First', 'Steel Toe Pro', 'Work Guard', 'Heavy Duty', 'Site Boss'],
  Plataforma: ['Elevate', 'Sky High', 'Platform Chic', 'Boost Up', 'Alto Trend'],
  Tacón: ['Stiletto Glam', 'Block Heel', 'Kitten Classic', 'Pump Elegant', 'Wedge Comfort'],
};

export const SIZE_SYSTEMS = {
  MX: ['22', '22.5', '23', '23.5', '24', '24.5', '25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5', '29', '30', '31'],
  US_M: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12', '13'],
  US_W: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14'],
  EUR: ['35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42', '43', '44'],
};

export const COLORS_CATALOG = [
  { name: 'Negro', hex: '#000000' },
  { name: 'Blanco', hex: '#FFFFFF' },
  { name: 'Café', hex: '#8B4513' },
  { name: 'Azul Marino', hex: '#000080' },
  { name: 'Rojo', hex: '#DC143C' },
  { name: 'Gris', hex: '#808080' },
  { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Rosa', hex: '#FF69B4' },
  { name: 'Verde', hex: '#228B22' },
  { name: 'Dorado', hex: '#FFD700' },
  { name: 'Plateado', hex: '#C0C0C0' },
  { name: 'Miel', hex: '#EB9605' },
  { name: 'Vino', hex: '#722F37' },
  { name: 'Nude', hex: '#E3BC9A' },
  { name: 'Azul Rey', hex: '#4169E1' },
];

export const EXPENSE_CATEGORIES_LIST = [
  'Renta del local', 'Luz eléctrica', 'Agua', 'Internet/Teléfono',
  'Nómina', 'Publicidad', 'Material de limpieza', 'Mantenimiento',
  'Papelería', 'Transporte', 'Comisiones bancarias', 'Seguros',
  'Impuestos', 'Varios',
];

export const PAYMENT_METHODS_LIST = [
  { name: 'Efectivo', requiresRef: false },
  { name: 'Tarjeta de débito', requiresRef: true },
  { name: 'Tarjeta de crédito', requiresRef: true },
  { name: 'Transferencia', requiresRef: true },
  { name: 'Mercado Pago', requiresRef: true },
];

export const CANCELLATION_REASONS_LIST = [
  { name: 'Defecto de fábrica', affectsInventory: false },
  { name: 'Talla incorrecta', affectsInventory: true },
  { name: 'No le gustó al cliente', affectsInventory: true },
  { name: 'Error del cajero', affectsInventory: true },
  { name: 'Producto dañado en tienda', affectsInventory: false },
];
