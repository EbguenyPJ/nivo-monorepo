import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType, Content, Part } from '@google/generative-ai';
import { DataSource } from 'typeorm';
import { NIBBIT_TOOLS, executeTool, ToolExecutionContext } from './nibbit.tools';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { PdfGeneratorService } from '../reports-export/services/pdf-generator.service';
import { S3Service } from '../reports-export/services/s3.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NibbitAction {
  type: 'requisition_draft' | 'email_drafts';
  label: string;
  payload: Record<string, any>;
}

const SYSTEM_PROMPT = `Eres Nibbit, el asistente inteligente de Nivo — una plataforma POS para zapaterías en México.

REGLAS ABSOLUTAS:
1. Tu ÚNICA fuente de verdad son las herramientas (tools) proporcionadas. NUNCA inventes, aproximes o estimes cifras financieras, cantidades de inventario, o métricas de negocio.
2. Si el usuario pregunta por un producto, modelo o marca y la herramienta de búsqueda devuelve vacío, DEBES responder textualmente: "No cuento con información registrada para ese modelo en este momento."
3. Si no tienes una herramienta para responder la pregunta, di honestamente: "No tengo acceso a esa información con mis herramientas actuales."
4. Siempre muestra los números exactos que devuelven las herramientas. No redondees a menos que el usuario lo pida.
5. Cuando muestres listas de productos o datos tabulares, usa formato de tabla Markdown.
6. Responde en español mexicano, con tono profesional pero amigable.
7. Cuando el usuario pregunte por "hoy", "ayer", "esta semana" o "este mes", calcula las fechas reales basándote en la fecha actual proporcionada.
8. Formatea cantidades monetarias con el símbolo $ y separadores de miles (ej: $1,234.56).

CONTEXTO:
- Fecha actual: {{CURRENT_DATE}}
- Negocio: {{TENANT_NAME}}
- Tipo de negocio: Zapatería / Calzado

RESOLUCIÓN DE SUCURSALES:
9. Cuando el usuario mencione una sucursal por nombre (ej: "Nova Reforma", "Sucursal Centro"), SIEMPRE usa list_branches primero para obtener el UUID. NUNCA pidas al usuario un ID o UUID — ellos no los conocen.
10. Si el usuario pide reabastecer pero no especifica sucursal, usa list_branches para mostrarle las opciones disponibles por nombre y PREGÚNTALE cuál sucursal desea.

HERRAMIENTAS DE ACCIÓN:
11. Puedes generar borradores de requisiciones de reabastecimiento usando draft_auto_requisition. Úsala cuando el usuario pida reabastecer, generar pedidos de compra, o revisar qué falta en inventario para pedir. Primero resuelve el branch_id usando list_branches.
12. Puedes redactar correos a proveedores usando draft_supplier_emails. Úsala cuando el usuario pida enviar o redactar correos después de aprobar una requisición.
13. Las herramientas de acción NUNCA ejecutan operaciones finales. Solo preparan borradores que el usuario debe revisar y confirmar manualmente.

FLUJO DE REDACCIÓN DE CORREOS A PROVEEDORES:
14. Cuando el usuario pida "redacta los correos", "envía los pedidos a proveedores" o similar, SIEMPRE sigue estos pasos:
    a) Si el usuario NO especifica sucursal, usa list_branches para mostrarle las sucursales y PREGÚNTALE: "¿Para qué sucursal deseas redactar los correos? ¿O para todas?"
    b) Si el usuario dice "todas", busca requisiciones aprobadas de todas las sucursales.
    c) Si el usuario da un nombre de sucursal, valida que exista con list_branches. Si no existe, informa: "No encontré una sucursal con ese nombre. Las sucursales disponibles son: [lista]."
    d) Una vez definida la sucursal, usa list_requisitions con status=approved y el branch_id correspondiente.
    e) De los resultados, identifica la requisición aprobada más reciente cuyo campo emails_drafted sea false.
    f) Si todas las requisiciones aprobadas ya tienen emails_drafted=true o emails_sent=true, informa al usuario: "Los correos de la requisición [folio] de [sucursal] ya fueron [redactados/enviados]. No es necesario redactarlos de nuevo."
    g) Solo entonces llama draft_supplier_emails con el requisition_id correcto.
15. Si el usuario especifica una requisición en particular (ej: "REQ-0015"), usa list_requisitions para encontrarla y verifica que esté aprobada y que no tenga emails ya redactados/enviados antes de llamar draft_supplier_emails.

GUÍA POST-ENVÍO DE CORREOS:
16. Después de que el usuario envíe los correos a proveedores (o cuando draft_supplier_emails se complete exitosamente), SIEMPRE informa al usuario sobre los siguientes pasos del flujo de compras:
    - "Los correos han sido redactados. Una vez que los revises y envíes, el siguiente paso es ir a **Compras** en el menú lateral para:"
    - "1. **Confirmar las órdenes** — cambiar el estado de las órdenes de compra de 'borrador' a 'ordenado' cuando el proveedor confirme."
    - "2. **Registrar recepción** — cuando llegue la mercancía, registrar qué productos y cantidades se recibieron."
    - "3. **Cuentas por pagar** — dar seguimiento a los pagos pendientes con cada proveedor."
    - Usa este mensaje como guía, adáptalo al contexto de la conversación (no lo repitas textual si ya lo mencionaste antes).

Eres conciso. Respondes directo al punto. Si puedes resolver con una herramienta, úsala inmediatamente sin pedir confirmación — EXCEPTO cuando necesites saber la sucursal para redactar correos: en ese caso PREGUNTA primero.`;

function convertSchemaType(type: string): SchemaType {
  switch (type) {
    case 'string': return SchemaType.STRING;
    case 'number': return SchemaType.NUMBER;
    case 'boolean': return SchemaType.BOOLEAN;
    case 'object': return SchemaType.OBJECT;
    case 'array': return SchemaType.ARRAY;
    default: return SchemaType.STRING;
  }
}

function convertProperties(props: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(props)) {
    const converted: any = {
      type: convertSchemaType(val.type),
      description: val.description,
    };
    if (val.enum) converted.enum = val.enum;
    result[key] = converted;
  }
  return result;
}

@Injectable()
export class NibbitService {
  private readonly logger = new Logger(NibbitService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly requisitionsService: RequisitionsService,
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly s3Service: S3Service,
  ) {
    this.genAI = new GoogleGenerativeAI(
      this.config.get('GEMINI_API_KEY', ''),
    );
  }

  async chat(
    connection: DataSource,
    messages: ChatMessage[],
    tenantName: string,
    tenantId?: string,
    databaseName?: string,
  ): Promise<{ reply: string; tool_calls?: { name: string; input: any; result: any }[]; actions?: NibbitAction[] }> {
    const now = new Date();
    const systemPrompt = SYSTEM_PROMPT
      .replace('{{CURRENT_DATE}}', now.toISOString().split('T')[0])
      .replace('{{TENANT_NAME}}', tenantName);

    const tools = [{
      functionDeclarations: NIBBIT_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties: convertProperties(t.input_schema.properties || {}),
          required: t.input_schema.required || [],
        },
      })),
    }];

    const model = this.genAI.getGenerativeModel({
      model: this.config.get('GEMINI_MODEL', 'gemini-2.0-flash'),
      systemInstruction: systemPrompt,
      tools,
    });

    const history: Content[] = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1]?.content || '';

    const toolCallLog: { name: string; input: any; result: any }[] = [];

    const toolCtx: ToolExecutionContext = {
      requisitionsService: this.requisitionsService,
      pdfGeneratorService: this.pdfGeneratorService,
      s3Service: this.s3Service,
      genAI: this.genAI,
      tenantId: tenantId || '',
      tenantName,
      databaseName: databaseName || '',
    };

    let response = await this.sendWithRetry(() => chat.sendMessage(lastMessage));
    let candidate = response.response.candidates?.[0];

    while (candidate) {
      const functionCalls = candidate.content?.parts?.filter(
        (p: Part) => 'functionCall' in p,
      ) || [];

      if (functionCalls.length === 0) break;

      const functionResponses: Part[] = [];

      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        this.logger.debug(`Tool call: ${fc.name}(${JSON.stringify(fc.args)})`);

        let resultStr: string;
        try {
          resultStr = await executeTool(connection, fc.name, fc.args || {}, toolCtx);
        } catch (err: any) {
          resultStr = JSON.stringify({ error: err.message });
        }

        toolCallLog.push({
          name: fc.name,
          input: fc.args,
          result: JSON.parse(resultStr),
        });

        const parsed = JSON.parse(resultStr);
        const responseObj = Array.isArray(parsed) ? { items: parsed } : parsed;
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: responseObj,
          },
        });
      }

      response = await this.sendWithRetry(() => chat.sendMessage(functionResponses));
      candidate = response.response.candidates?.[0];
    }

    const textParts = candidate?.content?.parts?.filter(
      (p: Part) => 'text' in p,
    ) || [];
    const reply = textParts.map((p: any) => p.text).join('\n');

    const actions: NibbitAction[] = [];
    for (const tc of toolCallLog) {
      if (tc.result?.__nibbit_action) {
        actions.push(tc.result.__nibbit_action as NibbitAction);
      }
    }

    return {
      reply: reply || 'No pude generar una respuesta. Intenta reformular tu pregunta.',
      tool_calls: toolCallLog.length > 0 ? toolCallLog : undefined,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  async draftSupplierEmails(
    connection: DataSource,
    requisitionId: string,
    tenantId: string,
    tenantName: string,
    databaseName: string,
  ): Promise<{ draft_count: number; drafts: { id: string; supplier_name: string; to_email: string }[]; error?: string }> {
    const ctx: ToolExecutionContext = {
      requisitionsService: this.requisitionsService,
      pdfGeneratorService: this.pdfGeneratorService,
      s3Service: this.s3Service,
      genAI: this.genAI,
      tenantId,
      tenantName,
      databaseName,
    };

    const result = await executeTool(connection, 'draft_supplier_emails', { requisition_id: requisitionId }, ctx);
    return JSON.parse(result);
  }

  private async sendWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        const isRetryable = err.message?.includes('503') || err.message?.includes('429');
        if (!isRetryable || i === maxRetries - 1) throw err;
        const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
        this.logger.warn(`Gemini API retry ${i + 1}/${maxRetries} after ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Unreachable');
  }
}
