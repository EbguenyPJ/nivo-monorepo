export type ReportType = 'sales' | 'profitability' | 'audits' | 'performance' | 'dashboard' | 'inventory';

export interface ReportJobData {
  tenantId: string;
  databaseName: string;
  reportType: ReportType;
  filters: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
  };
  distribution?: {
    channel: 'email' | 'whatsapp' | 'both';
    recipient: string;
    recipientName?: string;
  };
  requestedBy: string;
}

export interface ReportResult {
  pdfUrl: string;
  s3Key: string;
  sizeBytes: number;
  generatedAt: string;
}

export const REPORT_LABELS: Record<ReportType, string> = {
  sales: 'Reporte de Ventas',
  profitability: 'Reporte de Rentabilidad',
  audits: 'Reporte de Arqueos',
  performance: 'Reporte de Rendimiento',
  dashboard: 'Resumen del Dashboard',
  inventory: 'Reporte de Inventario',
};
