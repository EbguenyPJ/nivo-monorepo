import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

export interface ExportEvent {
  jobId: string;
  status: 'started' | 'progress' | 'ready' | 'error';
  message?: string;
  downloadUrl?: string;
  progress?: number; // 0–100
}

@WebSocketGateway({
  namespace: '/api/v1/reports',
  cors: { origin: '*' },
})
export class ReportsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ReportsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Reports WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Reports WS disconnected: ${client.id}`);
  }

  /** Client joins its tenant room after auth */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string },
  ) {
    try {
      const payload = this.jwtService.verify(data.token);
      const room = `tenant:${payload.tenant_id}`;
      client.join(room);
      client.emit('subscribed', { room });
      this.logger.log(`Client ${client.id} joined room ${room}`);
    } catch {
      client.emit('error', { message: 'Invalid token' });
    }
  }

  /** Emit export event to all clients in the tenant room */
  emitToTenant(tenantId: string, event: ExportEvent) {
    this.server.to(`tenant:${tenantId}`).emit('export:update', event);
  }
}
