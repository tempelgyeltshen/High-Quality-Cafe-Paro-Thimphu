import { Response } from 'express';
import { Role } from '../src/types/index.ts';

export interface SSEClient {
  id: string;
  res: Response;
  isStaff: boolean;
  staffRole?: Role;
  isVerifiedTableGuest: boolean;
  verifiedTableId?: string;
}

class SSEHub {
  private clients: Map<string, SSEClient> = new Map();

  constructor() {
    // Keepalive ping every 25 seconds
    setInterval(() => {
      this.broadcastPublic('ping', { timestamp: Date.now() });
    }, 25000);
  }

  addClient(
    id: string,
    res: Response,
    options: {
      isStaff?: boolean;
      staffRole?: Role;
      isVerifiedTableGuest?: boolean;
      verifiedTableId?: string;
    } = {}
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const client: SSEClient = {
      id,
      res,
      isStaff: Boolean(options.isStaff),
      staffRole: options.staffRole,
      isVerifiedTableGuest: Boolean(options.isVerifiedTableGuest),
      verifiedTableId: options.verifiedTableId
    };

    this.clients.set(id, client);

    this.sendToClient(id, 'connected', {
      clientId: id,
      scope: client.isStaff ? 'staff' : client.isVerifiedTableGuest ? 'table_guest' : 'public_menu',
      timestamp: Date.now()
    });

    res.on('close', () => {
      this.clients.delete(id);
    });
  }

  sendToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Broadcast strictly public menu/catalog updates to all connected clients
   */
  broadcastPublic(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  /**
   * Broadcast strictly to authenticated staff (optionally restricted by role)
   */
  broadcastToStaff(event: string, data: any, allowedRoles?: Role[]) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (!client.isStaff) continue;
      if (allowedRoles && client.staffRole && client.staffRole !== 'admin' && !allowedRoles.includes(client.staffRole)) {
        continue;
      }
      try {
        client.res.write(payload);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  /**
   * Broadcast full operational payload to staff, and strictly table-scoped sanitized payload ONLY to verified guests at that specific table
   */
  broadcastToTableAndStaff(tableId: string, event: string, staffData: any, guestData: any) {
    const staffPayload = `event: ${event}\ndata: ${JSON.stringify(staffData)}\n\n`;
    const guestPayload = `event: ${event}\ndata: ${JSON.stringify(guestData)}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      try {
        if (client.isStaff) {
          client.res.write(staffPayload);
        } else if (client.isVerifiedTableGuest && client.verifiedTableId === tableId) {
          client.res.write(guestPayload);
        }
      } catch {
        this.clients.delete(id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseHub = new SSEHub();
