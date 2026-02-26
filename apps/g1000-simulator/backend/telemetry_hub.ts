// Telemetry Streaming Hub

import WebSocket from 'ws';

class TelemetryHub {
    private wss: WebSocket.Server;

    constructor(port: number) {
        this.wss = new WebSocket.Server({ port });
        this.setupConnectionHandling();
    }

    private setupConnectionHandling() {
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('Client connected');

            ws.on('message', (message: string) => {
                console.log('Received message:', message);
                // Handle subscription filters and other client messages
            });

            ws.on('close', () => {
                console.log('Client disconnected');
            });
        });
    }

    public broadcast(data: any) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

export default TelemetryHub;

// Example usage
const telemetryHub = new TelemetryHub(8080);
setInterval(() => {
    const flightState = { altitude: 10000, speed: 250 }; // Example data
    telemetryHub.broadcast(flightState);
}, 1000);