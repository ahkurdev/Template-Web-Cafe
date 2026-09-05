import { PrismaClient } from '@prisma/client';
import { isProd } from '../env.js';

/**
 * Singleton. Tanpa ini, tsx watch membuat PrismaClient baru setiap reload
 * dan pool koneksi MariaDB cepat habis (connection_limit=5).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: isProd ? ['warn', 'error'] : ['warn', 'error'] });

if (!isProd) globalForPrisma.prisma = prisma;
