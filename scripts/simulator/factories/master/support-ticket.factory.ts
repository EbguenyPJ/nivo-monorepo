import pg from 'pg';
import { insert } from '../../db/connection.js';
import { pick } from '../../engine/probability.js';

const TICKET_SUBJECTS: Record<string, string[]> = {
  churn: [
    'Problemas con variantes de producto',
    'No puedo agregar tallas a un producto existente',
    'Error al guardar colores personalizados',
    'El sistema no me deja crear más de 2 variantes',
    'Necesito ayuda urgente con el inventario',
    'Los traspasos no se completan',
    'Cobro duplicado en mi suscripción',
    'Quiero cancelar mi cuenta',
  ],
  general: [
    '¿Cómo configuro los impuestos?',
    'Necesito exportar mis reportes en PDF',
    'Error al sincronizar ventas offline',
    'Pregunta sobre integración con Stripe',
    'No puedo cambiar el logo de mi tienda',
    'El reporte de ventas no coincide con la caja',
    '¿Cómo activo el programa de lealtad?',
    'Consulta sobre facturación electrónica',
  ],
};

const CATEGORIES = ['Productos', 'Inventario', 'Facturación', 'Suscripción', 'POS', 'Reportes', 'General'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export async function createSupportTicket(
  pool: pg.Pool,
  tenantId: string,
  tenantName: string,
  profile: string,
  createdAt: Date,
  status: string = 'open'
): Promise<string> {
  const subjects = profile === 'churn' ? TICKET_SUBJECTS.churn : TICKET_SUBJECTS.general;

  const ticketId = await insert(pool, 'support_tickets', {
    tenant_id: tenantId,
    tenant_name: tenantName,
    subject: pick(subjects),
    status,
    priority: profile === 'churn' ? pick(['high', 'urgent']) : pick(PRIORITIES),
    category: pick(CATEGORIES),
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
  });

  await insert(pool, 'ticket_messages', {
    ticket_id: ticketId,
    sender_type: 'tenant',
    sender_name: tenantName,
    message: `Hola, tengo un problema con mi cuenta. ${pick([
      'Necesito ayuda lo antes posible.',
      'Agradezco su pronta respuesta.',
      'Llevo varios días con este problema.',
      'Es urgente para mi operación.',
    ])}`,
    created_at: createdAt.toISOString(),
  });

  if (status !== 'open') {
    const responseDate = new Date(createdAt.getTime() + 3600000 * 4);
    await insert(pool, 'ticket_messages', {
      ticket_id: ticketId,
      sender_type: 'support',
      sender_name: 'Soporte Nivo',
      message: pick([
        'Hola, gracias por contactarnos. Estamos revisando tu caso y te responderemos a la brevedad.',
        'Buen día. Ya revisamos tu reporte y estamos trabajando en una solución.',
        'Hemos identificado el problema. Te enviaremos una actualización pronto.',
      ]),
      created_at: responseDate.toISOString(),
    });
  }

  return ticketId;
}
