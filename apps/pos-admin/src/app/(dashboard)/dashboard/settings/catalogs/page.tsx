'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@nivo/ui';
import { DataGridEditable, type ColumnDef } from './components/DataGridEditable';
import { ColorsGrid } from './components/ColorsGrid';
import { SizesMatrix } from './components/SizesMatrix';

// ─── Catalog Definitions ──────────────────────────────────────
interface CatalogConfig {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** 'datagrid' = DataGridEditable, 'colors' = ColorsGrid, 'sizes' = SizesMatrix */
  renderer: 'datagrid' | 'colors' | 'sizes';
  endpoint?: string;
  columns?: ColumnDef[];
  addLabel?: string;
}

const CATALOGS: CatalogConfig[] = [
  {
    id: 'colors',
    label: 'Colores',
    description: 'Catálogo visual de colores para tus zapatos',
    icon: '🎨',
    renderer: 'colors',
  },
  {
    id: 'sizes',
    label: 'Tallas y Equivalencias',
    description: 'Matriz de tallas con equivalencias MEX, US, EUR y más',
    icon: '📐',
    renderer: 'sizes',
  },
  {
    id: 'payment-methods',
    label: 'Métodos de Pago',
    description: 'Formas de pago aceptadas en tu punto de venta',
    icon: '💳',
    renderer: 'datagrid',
    endpoint: '/catalogs/payment-methods',
    columns: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        editable: true,
        placeholder: 'Ej: Efectivo, Tarjeta...',
      },
      {
        key: 'requires_reference',
        label: 'Requiere Referencia',
        type: 'boolean',
        editable: true,
        width: '180px',
      },
    ],
    addLabel: 'Añadir método de pago',
  },
  {
    id: 'taxes',
    label: 'Impuestos',
    description: 'Tasas de impuesto aplicables a tus productos',
    icon: '📊',
    renderer: 'datagrid',
    endpoint: '/catalogs/taxes',
    columns: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        editable: true,
        placeholder: 'Ej: IVA 16%',
      },
      {
        key: 'percentage',
        label: 'Porcentaje',
        type: 'number',
        editable: true,
        width: '140px',
        min: 0,
        step: 0.01,
        suffix: '%',
        placeholder: '16.00',
      },
    ],
    addLabel: 'Añadir impuesto',
  },
  {
    id: 'cancellation-reasons',
    label: 'Motivos de Cancelación',
    description: 'Razones para cancelar ventas, devoluciones o ajustes de inventario',
    icon: '❌',
    renderer: 'datagrid',
    endpoint: '/catalogs/cancellation-reasons',
    columns: [
      {
        key: 'name',
        label: 'Motivo',
        type: 'text',
        editable: true,
        placeholder: 'Ej: Cliente cambió de opinión',
      },
      {
        key: 'affects_inventory',
        label: 'Regresa a Stock',
        type: 'boolean',
        editable: true,
        width: '160px',
      },
    ],
    addLabel: 'Añadir motivo',
  },
  {
    id: 'price-lists',
    label: 'Listas de Precios',
    description: 'Define listas como Público General, Mayoreo o VIP con su margen',
    icon: '💰',
    renderer: 'datagrid',
    endpoint: '/catalogs/price-lists',
    columns: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        editable: true,
        placeholder: 'Ej: Público General, Mayoreo...',
      },
      {
        key: 'default_margin_percentage',
        label: 'Margen Default',
        type: 'number',
        editable: true,
        width: '160px',
        min: 0,
        step: 0.01,
        suffix: '%',
        placeholder: '30.00',
      },
      {
        key: 'is_default',
        label: 'Principal',
        type: 'boolean',
        editable: true,
        width: '120px',
      },
    ],
    addLabel: 'Añadir lista de precios',
  },
  {
    id: 'units-of-measure',
    label: 'Unidades de Medida',
    description: 'Unidades para medir y vender tus productos',
    icon: '📏',
    renderer: 'datagrid',
    endpoint: '/catalogs/units-of-measure',
    columns: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        editable: true,
        placeholder: 'Ej: Pieza, Par...',
      },
      {
        key: 'abbreviation',
        label: 'Abreviatura',
        type: 'text',
        editable: true,
        width: '140px',
        placeholder: 'Ej: pz, par...',
      },
    ],
    addLabel: 'Añadir unidad',
  },
];

// ─── Page Component ───────────────────────────────────────────
export default function CatalogsPage() {
  const [activeCatalog, setActiveCatalog] = useState<string>(CATALOGS[0].id);
  const selectedCatalog = CATALOGS.find((c) => c.id === activeCatalog)!;

  const renderContent = () => {
    switch (selectedCatalog.renderer) {
      case 'colors':
        return <ColorsGrid />;
      case 'sizes':
        return <SizesMatrix />;
      case 'datagrid':
        return (
          <DataGridEditable
            key={selectedCatalog.id}
            endpoint={selectedCatalog.endpoint!}
            columns={selectedCatalog.columns!}
            addLabel={selectedCatalog.addLabel!}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Catálogos del Sistema</h2>
        <p className="text-muted-foreground">
          Administra los catálogos base de tu zapatería. Haz clic en cualquier valor para editarlo.
        </p>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Catalog List (Master) */}
        <div className="col-span-12 lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Catálogos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="flex flex-col">
                {CATALOGS.map((catalog) => (
                  <button
                    key={catalog.id}
                    onClick={() => setActiveCatalog(catalog.id)}
                    className={`flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors border-l-2 hover:bg-muted/50 ${
                      activeCatalog === catalog.id
                        ? 'border-l-primary bg-muted/50 text-foreground font-medium'
                        : 'border-l-transparent text-muted-foreground'
                    }`}
                  >
                    <span className="text-lg">{catalog.icon}</span>
                    <div>
                      <div>{catalog.label}</div>
                    </div>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Right: Content (Detail) */}
        <div className="col-span-12 lg:col-span-9">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedCatalog.icon}</span>
                <div>
                  <CardTitle>{selectedCatalog.label}</CardTitle>
                  <CardDescription>{selectedCatalog.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderContent()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
