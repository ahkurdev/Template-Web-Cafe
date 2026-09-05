import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { env, isProd } from './env.js';
import { prisma } from './db/client.js';
import { registerErrorHandler } from './plugins/errors.js';
import { authPlugin } from './plugins/auth.js';
import { socketPlugin } from './plugins/socket.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { menuRoutes } from './modules/menu/menu.routes.js';
import { tableRoutes } from './modules/table/table.routes.js';
import { orderRoutes } from './modules/order/order.routes.js';
import { kitchenRoutes } from './modules/kitchen/kitchen.routes.js';
import { reportRoutes } from './modules/report/report.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: isProd
      ? { level: 'info' }
      : {
          level: 'info',
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } },
        },
    // Di belakang Caddy. Tanpa ini semua request terlihat dari 127.0.0.1
    // dan satu pelanggan menghabiskan kuota rate limit semua orang.
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  registerErrorHandler(app);

  await app.register(cors, { origin: isProd ? false : true, credentials: true });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  await app.register(authPlugin);
  await app.register(socketPlugin);

  const uploadDir = resolve(env.UPLOAD_DIR);
  await mkdir(uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
    maxAge: isProd ? '7d' : 0,
  });

  app.get('/api/health', async () => {
    let db = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
    };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(menuRoutes, { prefix: '/api/menu' });
  await app.register(tableRoutes, { prefix: '/api/tables' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(kitchenRoutes, { prefix: '/api/kitchen' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(settingsRoutes, { prefix: '/api/settings' });

  return app;
};
