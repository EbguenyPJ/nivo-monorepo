import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType, Content, Part } from '@google/generative-ai';
import { DataSource } from 'typeorm';
import { NIBBIT_TOOLS, executeTool } from './nibbit.tools';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

Eres conciso. Respondes directo al punto. Si puedes resolver con una herramienta, úsala inmediatamente sin pedir confirmación.`;

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

  constructor(private readonly config: ConfigService) {
    this.genAI = new GoogleGenerativeAI(
      this.config.get('GEMINI_API_KEY', ''),
    );
  }

  async chat(
    connection: DataSource,
    messages: ChatMessage[],
    tenantName: string,
  ): Promise<{ reply: string; tool_calls?: { name: string; input: any; result: any }[] }> {
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
      model: 'gemini-2.0-flash',
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

    let response = await chat.sendMessage(lastMessage);
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
          resultStr = await executeTool(connection, fc.name, fc.args || {});
        } catch (err: any) {
          resultStr = JSON.stringify({ error: err.message });
        }

        toolCallLog.push({
          name: fc.name,
          input: fc.args,
          result: JSON.parse(resultStr),
        });

        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: JSON.parse(resultStr),
          },
        });
      }

      response = await chat.sendMessage(functionResponses);
      candidate = response.response.candidates?.[0];
    }

    const textParts = candidate?.content?.parts?.filter(
      (p: Part) => 'text' in p,
    ) || [];
    const reply = textParts.map((p: any) => p.text).join('\n');

    return {
      reply: reply || 'No pude generar una respuesta. Intenta reformular tu pregunta.',
      tool_calls: toolCallLog.length > 0 ? toolCallLog : undefined,
    };
  }
}
