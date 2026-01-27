import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';
import { WebSocket, WebSocketServer } from 'ws';

export class G1000StreamingService extends BackgroundService {
  private server?: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(config: ServiceConfig) {
    super(config);
  }

  protected async onStart(): Promise<void> {
    const port = Number(process.env.G1000_STREAM_PORT ?? this.config.port ?? 9010);
    this.server = new WebSocketServer({ port });
    this.server.on('connection', (socket: WebSocket) => {
      this.clients.add(socket);
      socket.on('close', () => this.clients.delete(socket));
      socket.send(
        JSON.stringify({
          type: 'hello',
          timestamp: new Date().toISOString(),
        })
      );
    });
    console.log(`G1000 streaming websocket listening on port ${port}`);
  }

  protected async onStop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    if (this.server) {
      await new Promise<void>((resolve) => this.server?.close(() => resolve()));
      this.server = undefined;
    }
  }

  broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
