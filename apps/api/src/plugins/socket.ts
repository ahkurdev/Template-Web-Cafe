import fp from 'fastify-plugin';
import { Server, type Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { ROOM, type ClientToServer, type ServerToClient } from '@cafe/shared';
import { env, isProd } from '../env.js';
import { prisma } from '../db/client.js';
import type { TokenPayload } from './auth.js';

export type CafeServer = Server<ClientToServer, ServerToClient>;

declare module 'fastify' {
  interface FastifyInstance {
    io: CafeServer;
  }
}

export const socketPlugin = fp(async (app: FastifyInstance) => {
  const io: CafeServer = new Server(app.server, {
    cors: isProd ? undefined : { origin: true, credentials: true },
    // Fallback polling dipertahankan: HP pelanggan di jaringan/proxy jelek
    // sering gagal upgrade ke WebSocket.
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket<ClientToServer, ServerToClient>) => {
    // Room menu terbuka untuk semua, termasuk pelanggan tanpa login:
    // isi menu memang publik.
    void socket.join(ROOM.menu);

    const token = socket.handshake.auth?.['token'];
    if (typeof token === 'string' && token.length > 0) {
      try {
        const p = app.jwt.verify<TokenPayload>(token);
        // Room ditentukan dari role di JWT, BUKAN dari permintaan klien.
        // Kalau klien bebas memilih room, layar dapur bisa disadap dari luar.
        if (p.role === 'dapur' || p.role === 'kasir' || p.role === 'admin') {
          void socket.join(ROOM.kitchen);
        }
        if (p.role === 'kasir' || p.role === 'admin') {
          void socket.join(ROOM.kasir);
        }
      } catch {
        socket.emit('error', { code: 'UNAUTHENTICATED', message: 'Token tidak valid' });
        socket.disconnect(true);
        return;
      }
    }

    socket.on('order:subscribe', ({ orderCode }) => {
      // Verifikasi kode ada sebelum join, supaya klien tidak bisa
      // mendaftar ke room order milik orang lain dengan menebak.
      void prisma.order
        .findUnique({ where: { orderCode }, select: { id: true } })
        .then((order) => {
          if (!order) {
            socket.emit('error', { code: 'NOT_FOUND', message: 'Kode order tidak ditemukan' });
            return;
          }
          void socket.join(ROOM.order(order.id));
        })
        .catch(() => {
          socket.emit('error', { code: 'INTERNAL', message: 'Gagal berlangganan' });
        });
    });

    socket.on('order:unsubscribe', ({ orderCode }) => {
      void prisma.order
        .findUnique({ where: { orderCode }, select: { id: true } })
        .then((order) => {
          if (order) void socket.leave(ROOM.order(order.id));
        })
        .catch(() => undefined);
    });
  });

  app.decorate('io', io);
  app.addHook('onClose', async () => {
    await io.close();
  });

  app.log.info(`Socket.io siap (JWT ${env.JWT_SECRET.length} char)`);
});
