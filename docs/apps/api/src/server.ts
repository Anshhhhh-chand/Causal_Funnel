import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { MongoEventRepository } from './repository.js';

const config = loadConfig();
const repository = new MongoEventRepository(config.mongodbUri, config.mongodbDb);
const app = createApp({ repository, clientOrigins: config.clientOrigins, maxEventAgeHours: config.maxEventAgeHours });

repository.connect().then(() => {
  console.log(`MongoDB connected: ${config.mongodbDb}`);
}).catch((error) => {
  console.error('MongoDB unavailable. The API will remain online and report a degraded health status:', error instanceof Error ? error.message : error);
});

const server = app.listen(config.port, () => {
  console.log(`CausalFunnel API listening on http://localhost:${config.port}`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await repository.close();
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
