import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Facturama-compatible CFDI 4.0 payload types ─────────────────────────────

export interface CfdiTax {
  Base: number;
  Impuesto: '002'; // IVA
  TipoFactor: 'Tasa';
  TasaOCuota: '0.160000';
  Importe: number;
}

export interface CfdiConcepto {
  ClaveProdServ: string;
  NoIdentificacion?: string;
  Cantidad: number;
  ClaveUnidad: string;
  Unidad: string;
  Descripcion: string;
  ValorUnitario: number;
  Importe: number;
  ObjetoImp: '02'; // objeto de impuesto — con impuestos
  Impuestos: {
    Traslados: CfdiTax[];
  };
}

export interface CfdiPayload {
  Serie?: string;
  Folio?: string;
  Fecha: string; // ISO 8601
  FormaPago: string; // "28" SPEI, "03" T. crédito
  CondicionesDePago?: string;
  Moneda: 'MXN';
  TipoDeComprobante: 'I'; // Ingreso
  MetodoPago: 'PUE'; // Pago en una sola exhibición
  LugarExpedicion: string; // CP del emisor
  Exportacion: '01'; // No aplica
  Emisor: {
    Rfc: string;
    Nombre: string;
    RegimenFiscal: string;
  };
  Receptor: {
    Rfc: string;
    Nombre: string;
    DomicilioFiscalReceptor: string;
    RegimenFiscalReceptor: string;
    UsoCFDI: string;
  };
  Conceptos: CfdiConcepto[];
  Impuestos: {
    TotalImpuestosTrasladados: number;
    Traslados: CfdiTax[];
  };
}

export interface PacStampResult {
  cfdiId: string;   // PAC internal ID to fetch XML/PDF
  satUuid: string;  // SAT folio fiscal UUID
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PacService {
  private readonly logger = new Logger(PacService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Submit a CFDI 4.0 payload to the PAC for stamping.
   * Facturama API: POST /api-lite/2/cfdis
   */
  async stamp(payload: CfdiPayload): Promise<PacStampResult> {
    const baseUrl = this.config.get<string>('PAC_API_URL', 'https://apisandbox.facturama.mx');
    const username = this.config.get<string>('PAC_USERNAME', '');
    const password = this.config.get<string>('PAC_PASSWORD', '');

    if (!username || !password) {
      throw new Error('PAC credentials not configured (PAC_USERNAME / PAC_PASSWORD)');
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const response = await fetch(`${baseUrl}/api-lite/2/cfdis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`PAC stamp error (${response.status}): ${errorText}`);
      throw new Error(this.parsePacError(errorText));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await response.json();
    // Facturama response: { Id, CfdiData: { Complemento: { TimbreFiscalDigital: { UUID } } } }
    const satUuid = result?.CfdiData?.Complemento?.TimbreFiscalDigital?.UUID
      || result?.uuid
      || result?.UUID
      || result?.Id; // fallback

    return {
      cfdiId: result.Id || result.id,
      satUuid,
    };
  }

  /**
   * Download the timbrado XML from the PAC.
   * Facturama API: GET /api-lite/2/cfdis/{type}/{id}
   */
  async downloadXml(cfdiId: string): Promise<Buffer> {
    return this.downloadFile(cfdiId, 'xml');
  }

  /**
   * Download the generated PDF from the PAC.
   * Facturama API: GET /api-lite/2/cfdis/{type}/{id}
   */
  async downloadPdf(cfdiId: string): Promise<Buffer> {
    return this.downloadFile(cfdiId, 'pdf');
  }

  private async downloadFile(cfdiId: string, type: 'xml' | 'pdf'): Promise<Buffer> {
    const baseUrl = this.config.get<string>('PAC_API_URL', 'https://apisandbox.facturama.mx');
    const username = this.config.get<string>('PAC_USERNAME', '');
    const password = this.config.get<string>('PAC_PASSWORD', '');
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const response = await fetch(`${baseUrl}/api-lite/2/cfdis/${type}/${cfdiId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${type.toUpperCase()} for CFDI ${cfdiId}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Build the CFDI payload from invoice data + billing profile */
  buildPayload(params: {
    totalMxn: number;
    description: string;
    periodLabel: string; // "Mayo 2026"
    emisorRfc: string;
    emisorNombre: string;
    emisorRegimen: string;
    emisorCp: string;
    receptorRfc: string;
    receptorNombre: string;
    receptorCp: string;
    receptorRegimen: string;
    receptorCfdiUse: string;
  }): CfdiPayload {
    const total = Math.round(params.totalMxn * 100) / 100;
    const subtotal = Math.round((total / 1.16) * 100) / 100;
    const iva = Math.round((total - subtotal) * 100) / 100;

    const now = new Date();
    const fecha = now.toISOString().replace('Z', '').slice(0, 19); // "2026-04-17T10:00:00"

    const tax: CfdiTax = {
      Base: subtotal,
      Impuesto: '002',
      TipoFactor: 'Tasa',
      TasaOCuota: '0.160000',
      Importe: iva,
    };

    return {
      Fecha: fecha,
      FormaPago: '28', // SPEI (most common for SaaS subscriptions via Stripe)
      Moneda: 'MXN',
      TipoDeComprobante: 'I',
      MetodoPago: 'PUE',
      LugarExpedicion: params.emisorCp,
      Exportacion: '01',
      Emisor: {
        Rfc: params.emisorRfc,
        Nombre: params.emisorNombre,
        RegimenFiscal: params.emisorRegimen,
      },
      Receptor: {
        Rfc: params.receptorRfc,
        Nombre: params.receptorNombre,
        DomicilioFiscalReceptor: params.receptorCp,
        RegimenFiscalReceptor: params.receptorRegimen,
        UsoCFDI: params.receptorCfdiUse,
      },
      Conceptos: [
        {
          ClaveProdServ: '81112101', // Servicios de software en la nube
          Cantidad: 1,
          ClaveUnidad: 'E48', // Unidad de servicio
          Unidad: 'Servicio',
          Descripcion: params.description,
          ValorUnitario: subtotal,
          Importe: subtotal,
          ObjetoImp: '02',
          Impuestos: { Traslados: [tax] },
        },
      ],
      Impuestos: {
        TotalImpuestosTrasladados: iva,
        Traslados: [tax],
      },
    };
  }

  private parsePacError(raw: string): string {
    try {
      const obj = JSON.parse(raw);
      // Facturama returns { ModelState: { '': ['error msg'] } } or { Message: '...' }
      if (obj.ModelState) {
        const msgs = Object.values(obj.ModelState).flat() as string[];
        return msgs.join(' | ') || raw;
      }
      return obj.Message || obj.message || raw;
    } catch {
      return raw;
    }
  }
}
