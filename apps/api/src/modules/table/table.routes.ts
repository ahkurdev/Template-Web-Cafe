import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import QRCode from 'qrcode';
import { QR_TOKEN_LENGTH, ROOM, tableInput, tablePatch } from '@cafe/shared';
import { tableService } from './table.service.js';
import { body, params, query } from '../../lib/validate.js';

const idParam = z.object({ id: z.string().length(21) });
const tokenParam = z.object({ qrToken: z.string().length(QR_TOKEN_LENGTH) });
const qrQuery = z.object({ size: z.coerce.number().int().min(128).max(2048).default(512) });

/** URL yang ditanam di QR. Pelanggan buka root, frontend baca ?t= lalu resolve. */
const urlQr = (req: { headers: Record<string, unknown> }, token: string): string => {
  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'http';
  const host = (req.headers['x-forwarded-host'] as string) ?? (req.headers['host'] as string) ?? 'localhost:5173';
  return `${proto}://${host}/?t=${token}`;
};

export const tableRoutes = async (app: FastifyInstance): Promise<void> => {
  // Publik: dipanggil customer-menu saat halaman dibuka dari QR.
  app.get(
    '/resolve/:qrToken',
    { preHandler: params(tokenParam), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req) => {
      const { qrToken } = req.params as { qrToken: string };
      const { outletId: _outletId, ...meja } = await tableService.resolveQr(qrToken);
      return { data: meja };
    },
  );

  app.get('/', { preHandler: app.autentikasi }, async (req) => ({
    data: await tableService.daftar(req.pengguna!.outletId),
  }));

  app.post('/', { preHandler: [app.wajibRole('admin'), body(tableInput)] }, async (req, reply) => {
    const meja = await tableService.buat(req.pengguna!.outletId, req.body as never);
    return reply.code(201).send({ data: { id: meja.id, number: meja.number, status: meja.status } });
  });

  app.patch(
    '/:id',
    { preHandler: [app.wajibRole('admin'), params(idParam), body(tablePatch)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const meja = await tableService.ubah(req.pengguna!.outletId, id, req.body as never);
      app.io.to(ROOM.kasir).emit('table:updated', { id, number: meja.number, status: meja.status });
      return { data: { id: meja.id, number: meja.number, status: meja.status } };
    },
  );

  app.post(
    '/:id/qr/regenerate',
    { preHandler: [app.wajibRole('admin'), params(idParam)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const meja = await tableService.regenerateQr(req.pengguna!.outletId, id);
      return { data: { id: meja.id, number: meja.number, qrUrl: urlQr(req, meja.qrToken) } };
    },
  );

  app.get(
    '/:id/qr.png',
    { preHandler: [app.wajibRole('admin'), params(idParam), query(qrQuery)] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { size } = req.query as { size: number };
      const token = await tableService.ambilQrToken(req.pengguna!.outletId, id);
      const png = await QRCode.toBuffer(urlQr(req, token), {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      return reply.type('image/png').send(png);
    },
  );

  app.get(
    '/:id/qr.svg',
    { preHandler: [app.wajibRole('admin'), params(idParam)] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const token = await tableService.ambilQrToken(req.pengguna!.outletId, id);
      const svg = await QRCode.toString(urlQr(req, token), { type: 'svg', margin: 2 });
      return reply.type('image/svg+xml').send(svg);
    },
  );

  app.delete('/:id', { preHandler: [app.wajibRole('admin'), params(idParam)] }, async (req) => {
    const { id } = req.params as { id: string };
    await tableService.hapus(req.pengguna!.outletId, id);
    return { data: { ok: true } };
  });
};
