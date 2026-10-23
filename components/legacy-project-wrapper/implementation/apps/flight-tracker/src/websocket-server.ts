import { WebSocketServer, WebSocket } from 'ws';

interface WebSocketMessage {
  type: string;
  payload: any;
}

export class FlightWebSocketServer {
  private wss: WebSocketServer;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupConnectionHandler();
  }

  private setupConnectionHandler() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected');

      ws.on('message', (message: string) => {
        console.log(`Received message => ${message}`);
        this.handleMessage(ws, JSON.parse(message));
      });

      ws.send(JSON.stringify({ type: 'SYSTEM_STATUS', message: 'Connected to Flight Tracker' }));
    });
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessage) {
    switch (message.type) {
      case 'FLIGHT_STATE':
        // Handle flight state message
        break;
      case 'PFD_UPDATE':
        // Handle PFD update message
        break;
      case 'MFD_UPDATE':
        // Handle MFD update message
        break;
      case 'NAV_UPDATE':
        // Handle NAV update message
        break;
      case 'SYSTEM_STATUS':
        // Handle system status message
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  public broadcast(data: any) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}
