import { G1000StreamingService } from './service';

const port = Number(process.env.G1000_STREAM_PORT ?? process.env.PORT ?? 9010);

const service = new G1000StreamingService({
  name: 'g1000-simulator-streaming',
  enabled: true,
  autoStart: true,
  port,
});

const shutdown = async () => {
  if (service.getStatus().status === 'running') {
    await service.stop();
  }
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

service.start().catch((error) => {
  console.error('Failed to start G1000 streaming service:', error);
  process.exit(1);
});
