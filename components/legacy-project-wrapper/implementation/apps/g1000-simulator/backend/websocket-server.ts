// WebSocket server implementation for G1000 Simulator
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
    // Handle incoming messages
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Send initial message
  ws.send('Welcome to the G1000 Simulator WebSocket server');
});

console.log('WebSocket server is running on ws://localhost:8080');
