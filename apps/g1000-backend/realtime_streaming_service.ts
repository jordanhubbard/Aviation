// Real-Time Data Streaming Service

import WebSocket from 'ws';
import express from 'express';

const app = express();
const wss = new WebSocket.Server({ noServer: true });

interface FlightState {
  position: { lat: number; lon: number; alt: number };
  attitude: { pitch: number; roll: number; yaw: number };
  speed: { ias: number; tas: number; gs: number };
  altitude: number;
  heading: number;
}

class DataPublisher {
  private subscribers: Set<WebSocket> = new Set();

  subscribe(ws: WebSocket): void {
    this.subscribers.add(ws);
  }

  unsubscribe(ws: WebSocket): void {
    this.subscribers.delete(ws);
  }

  publishFlightState(state: FlightState): void {
    const message = JSON.stringify({
      type: 'FLIGHT_STATE',
      data: state,
      timestamp: Date.now()
    });

    this.subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  publishPFDUpdate(data: any): void {
    const message = JSON.stringify({
      type: 'PFD_UPDATE',
      data,
      timestamp: Date.now()
    });

    this.subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  publishMFDUpdate(data: any): void {
    const message = JSON.stringify({
      type: 'MFD_UPDATE',
      data,
      timestamp: Date.now()
    });

    this.subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  publishNavUpdate(data: any): void {
    const message = JSON.stringify({
      type: 'NAV_UPDATE',
      data,
      timestamp: Date.now()
    });

    this.subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  publishSystemStatus(data: any): void {
    const message = JSON.stringify({
      type: 'SYSTEM_STATUS',
      data,
      timestamp: Date.now()
    });

    this.subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

const publisher = new DataPublisher();

wss.on('connection', (ws: WebSocket) => {
  publisher.subscribe(ws);

  ws.on('close', () => {
    publisher.unsubscribe(ws);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export { app, wss, publisher };
