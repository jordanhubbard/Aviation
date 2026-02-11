import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { MessageType, FlightStateUpdateMessage, DisplayUpdateMessage, NavigationUpdateMessage, SystemStatusMessage, AlertMessage, CommandMessage, isFlightStateUpdateMessage, isDisplayUpdateMessage, isNavigationUpdateMessage, isSystemStatusMessage, isAlertMessage, isCommandMessage } from './websocket/messages';

type ClientState = {
  id: string;
  subscriptions: Set<string>;
};

export class G1000StreamingService extends BackgroundService {
  private server?: WebSocketServer;
  private clients = new Map<WebSocket, ClientState>();
  private broadcastInterval?: NodeJS.Timeout;
  private clientCounter = 0;
  private secrets = createSecretLoader('g1000-simulator');

  constructor(config: ServiceConfig) {
    super(config);
  }

  protected async onStart(): Promise<void> {
    const streamToken =
      this.secrets.get('G1000_STREAM_API_KEY') ??
      this.secrets.get('G1000_SIMULATOR_API_KEY') ??
      process.env.G1000_STREAM_API_KEY ??
      process.env.G1000_SIMULATOR_API_KEY;
    if (!streamToken) {
      console.warn('No G1000 stream API key found; running without auth gating.');
    }
    const port = Number(process.env.G1000_STREAM_PORT ?? this.config.port ?? 9010);
    this.server = new WebSocketServer({ port, path: '/ws' });
    this.server.on('connection', (socket: WebSocket) => this.handleConnection(socket));
    this.broadcastInterval = setInterval(() => {
      this.broadcastFlightState();
    }, 1000);
    console.log(`G1000 streaming websocket listening on port ${port}`);
  }

  protected async onStop(): Promise<void> {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = undefined;
    }
    for (const client of this.clients.keys()) {
      client.close();
    }
    this.clients.clear();
    if (this.server) {
      await new Promise<void>((resolve) => this.server?.close(() => resolve()));
      this.server = undefined;
    }
  }

  private handleConnection(socket: WebSocket): void {
    const state: ClientState = {
      id: `client-${++this.clientCounter}`,
      subscriptions: new Set(['telemetry']),
    };
    this.clients.set(socket, state);

    socket.on('message', (data) => this.handleMessage(socket, data));
    socket.on('close', () => this.clients.delete(socket));
    socket.on('error', (error) => {
      console.warn(`WebSocket error from ${state.id}`, error);
    });

    socket.send(
      JSON.stringify({
        type: 'connected',
        clientId: state.id,
        subscriptions: Array.from(state.subscriptions),
      })
    );
  }

  private handleMessage(socket: WebSocket, data: RawData): void {
    const state = this.clients.get(socket);
    if (!state) {
      return;
    }
    const text = typeof data === 'string' ? data : data.toString();
    let payload: { type?: string; channel?: string } | null = null;
    try {
      payload = JSON.parse(text) as { type?: string; channel?: string };
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid_json' }));
      return;
    }

    if (!payload?.type) {
      socket.send(JSON.stringify({ type: 'error', message: 'missing_type' }));
      return;
    }

    if (payload.type === 'subscribe' && payload.channel) {
      state.subscriptions.add(payload.channel);
      socket.send(JSON.stringify({ type: 'subscribed', channel: payload.channel }));
      return;
    }

    if (payload.type === 'command') {
      socket.send(JSON.stringify({ type: 'command_ack', receivedAt: new Date().toISOString() }));
      return;
    }

    socket.send(JSON.stringify({ type: 'unhandled', receivedType: payload.type }));
  }

  private broadcastFlightState(): void {
    this.broadcast('telemetry', {
      position: {
        latitude_deg: 37.6188,
        longitude_deg: -122.3754,
        altitude_ft: 4500,
      },
      attitude: {
        heading_deg: 90,
        pitch_deg: 0,
        roll_deg: 0,
      },
      velocity: {
        airspeed_kt: 110,
        vertical_speed_fpm: 0,
      },
      updated_at: new Date().toISOString(),
    });
  }

  broadcast(channel: string, payload: unknown): void {
    const message = JSON.stringify({ type: channel, payload });
    for (const [client, state] of this.clients.entries()) {
      if (!state.subscriptions.has(channel)) {
        continue;
      }
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
