import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { availabilityInput, categoryInput, menuItemInput, menuItemPatch, ROOM } from '@cafe/shared';
import { menuService } from './menu.service.js';
import { body, params, query } from '../../lib/validate.js';
import { simpanGambarMenu } from '../../lib/image.js';
import { AppError } from '../../lib/errors.js';
import { OUTLET_DEFAULT } from '../../lib/outlet.js';

const idParam = z.object({ id: z.string().length(21) });
const itemQuery = z.object({
  categoryId: z.string().length(21).optional(),
  q: z.string().trim().max(100).optional(),
  isAvailable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const menuRoutes = async (app: FastifyInstance): Promise<void> => {
  // Publik: dibuka setiap pelanggan scan QR. Satu request, siap render.
  app.get('/', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async () => ({
    data: await menuService.katalog(OUTLET_DEFAULT),
  }));

  app.get('/categories', { preHandler: app.autentikasi }, async (req) => ({
    data: await menuService.daftarKategori(req.pengguna!.outletId),
  }));

  app.post(
    '/categories',
    { preHandler: [app.wajibRole('admin'), body(categoryInput)] },
    async (req, reply) => {
      const kategori = await menuService.buatKategori(req.pengguna!.outletId, req.body as never);
      app.io.to(ROOM.menu).emit('menu:updated', { action: 'created', categoryId: kategori.id });
      return reply.code(201).send({ data: kategori });
    },
  );

  app.patch(
    '/categories/:id',
    { preHandler: [app.wajibRole('admin'), params(idParam), body(categoryInput.partial())] },
    async (req) => {
      const { id } = req.params as { id: string };
      const kategori = await menuService.ubahKategori(req.pengguna!.outletId, id, req.body as never);
      app.io.to(ROOM.menu).emit('menu:updated', { action: 'updated', categoryId: id });
      return { data: kategori };
    },
  );

  app.delete(
    '/categories/:id',
    { preHandler: [app.wajibRole('admin'), params(idParam)] },
    async (req) => {
      const { id } = req.params as { id: string };
      await menuService.hapusKategori(req.pengguna!.outletId, id);
      app.io.to(ROOM.menu).emit('menu:updated', { action: 'deleted', categoryId: id });
      return { data: { ok: true } };
    },
  );

  app.get('/items', { preHandler: [app.autentikasi, query(itemQuery)] }, async (req) => ({
    data: await menuService.daftarItem(req.pengguna!.outletId, req.query as never),
  }));

  app.post(
    '/items',
    { preHandler: [app.wajibRole('admin'), body(menuItemInput)] },
    async (req, reply) => {
      const item = await menuService.buatItem(req.pengguna!.outletId, req.body as never);
      app.io.to(ROOM.menu).emit('menu:updated', { action: 'created', menuItemId: item.id });
      return reply.code(201).send({ data: item });
    },
  );

  app.patch(
    '/items/:id',
    { preHandler: [app.wajibRole('admin'), params(idParam), body(menuItemPatch)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const item = await menuService.ubahItem(req.pengguna!.outletId, id, req.body as never);
      app.io.to(ROOM.menu).emit('menu:updated', { action: 'updated', menuItemId: id });
      return { data: item };
    },
  );

  // Dibuka untuk kasir: barista tidak perlu memanggil admin saat stok habis di jam sibuk.
  app.patch(
    '/items/:id/availability',
    { preHandler: [app.wajibRole('admin', 'kasir'), params(idParam), body(availabilityInput)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { isAvailable } = req.body as { isAvailable: boolean };
      const item = await menuService.setKetersediaan(req.pengguna!.outletId, id, isAvailable);
      app.io.to(ROOM.menu).emit('menu:availability', { menuItemId: id, isAvailable });
      return { data: item };
    },
  );

  app.delete('/items/:id', { preHandler: [app.wajibRole('admin'), params(idParam)] }, async (req) => {
    const { id } = req.params as { id: string };
    await menuService.hapusItem(req.pengguna!.outletId, id);
    app.io.to(ROOM.menu).emit('menu:updated', { action: 'deleted', menuItemId: id });
    return { data: { ok: true } };
  });

  app.post(
    '/items/:id/image',
    { preHandler: [app.wajibRole('admin'), params(idParam)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const file = await req.file();
      if (!file) throw new AppError('VALIDATION_FAILED', 400, 'File tidak ada', { file: 'wajib' });

      const imageUrl = await simpanGambarMenu(await file.toBuffer(), file.mimetype, id);
      const item = await menuService.setGambar(req.pengguna!.outletId, id, imageUrl);
      app.io.to(ROOM.menu).emit('menu:updated', { action: 'updated', menuItemId: id });
      return { data: item };
    },
  );
};
