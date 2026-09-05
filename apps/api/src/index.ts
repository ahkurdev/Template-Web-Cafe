import { buildApp } from './app.js';
import { env } from './env.js';
import { prisma } from './db/client.js';
const app = await buildApp();

const shutdown = async (signal: string): Promise<void> => {
  app.log.info(`${signal} diterima, menutup...`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error({ err }, 'gagal listen');
  process.exit(1);
}
