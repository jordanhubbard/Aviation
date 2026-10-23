import type { WebSocketEnvelope } from "./schema";

export type WebSocketClientState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface WebSocketClientOptions {
  url: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private url: string;
  private state: WebSocketClientState = "disconnected";
  private ws: WebSocket | null = null;

  constructor(options: WebSocketClientOptions | string) {
    this.url = typeof options === "string" ? options : options.url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.state = "connecting";
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.state = "connected";
          resolve();
        };
        this.ws.onerror = () => {
          this.state = "error";
          reject(new Error("WebSocket connection error"));
        };
        this.ws.onclose = () => {
          this.state = "disconnected";
        };
      } catch (err) {
        this.state = "error";
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state = "disconnected";
  }

  send(envelope: WebSocketEnvelope): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(envelope));
    }
  }

  onMessage(handler: (envelope: WebSocketEnvelope) => void): () => void {
    if (!this.ws) return () => {};
    const fn = (event: MessageEvent) => {
      try {
        const envelope = JSON.parse(event.data as string) as WebSocketEnvelope;
        handler(envelope);
      } catch {
        // ignore parse errors
      }
    };
    this.ws.addEventListener("message", fn);
    return () => this.ws?.removeEventListener("message", fn);
  }

  getState(): WebSocketClientState {
    return this.state;
  }
}
