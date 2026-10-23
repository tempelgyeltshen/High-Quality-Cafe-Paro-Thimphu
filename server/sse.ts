import { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
  role?: string; // 'kitchen' | 'counter' | 'admin' | 'customer'
  tableId?: string;
  sessionId?: string;
}

class SSEHub {
  private clients: Map<string, SSEClient> = new Map();

  constructor() {
    // Keepalive ping every 25 seconds
    setInterval(() => {
      this.broadcast('ping', { timestamp: Date.now() });
    }, 25000);
  }

  addClient(id: string, res: Response, options: { role?: string; tableId?: string; sessionId?: string } = {}) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for NGINX/proxies
    res.flushHeaders?.();

    const client: SSEClient = {
      id,
      res,
      role: options.role,
      tableId: options.tableId,
      sessionId: options.sessionId
    };

    this.clients.set(id, client);

    // Send initial handshake
    this.sendToClient(id, 'connected', { clientId: id, timestamp: Date.now() });

    res.on('close', () => {
      this.clients.delete(id);
    });
  }

  sendToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        this.clients.delete(clientId);
      }
    }
  }

  broadcast(event: string, data: any, filter?: (client: SSEClient) => boolean) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (!filter || filter(client)) {
        try {
          client.res.write(payload);
        } catch (err) {
          this.clients.delete(id);
        }
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseHub = new SSEHub();
