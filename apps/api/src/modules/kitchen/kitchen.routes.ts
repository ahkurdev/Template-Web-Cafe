import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { KDS_AMBANG_KUNING, KDS_AMBANG_MERAH, ROOM, STATUS_AKTIF_DAPUR } from '@cafe/shared';
import { orderService } from '../order/order.service.js';
import { orderRepository } from '../order/order.repository.js';
import { keOrder } from '../order/order.mapper.js';
import { body, params } from '../../lib/validate.js';

const idParam = z.object({ id: z.string().length(21) });
// Dapur hanya boleh 3 status ini — tidak boleh membatalkan atau menandai lunas.
const kitchenStatus = z.object({ status: z.enum(['dikonfirmasi', 'diproses', 'selesai']) });

/**
 * Rute terpisah dari /orders walau menyentuh tabel sama: role `dapur` hanya
 * boleh mengubah status, tidak boleh melihat uang atau membatalkan order.
 * Batas kewenangan lebih mudah dijaga saat rutenya berbeda.
 */
export const kitchenRoutes = async (app: FastifyInstance): Promise<void> => {
  const staff = app.wajibRole('dapur', 'kasir', 'admin');

  app.get('/queue', { preHandler: staff }, async (req) => {
    const rows = await orderRepository.aktif(req.pengguna!.outletId, STATUS_AKTIF_DAPUR);
    const now = Date.now();
    return {
      data: rows.map((r) => ({
        ...keOrder(r),
        elapsedSeconds: Math.floor((now - r.createdAt.getTime()) / 1000),
      })),
    };
  });

  app.patch(
    '/orders/:id/status',
    { preHandler: [staff, params(idParam), body(kitchenStatus)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: 'dikonfirmasi' | 'diproses' | 'selesai' };
      const aku = req.pengguna!;
      const order = await orderService.ubahStatus(aku.outletId, id, status, aku.sub);

      const payload = {
        id: order.id,
        orderCode: order.orderCode,
        status: order.status,
        total: order.total,
        updatedAt: new Date().toISOString(),
      };
      // Array room, bukan dua emit: admin/kasir anggota kitchen DAN kasir,
      // dua emit terpisah membuat mereka menerima event dua kali.
      app.io.to([ROOM.kitchen, ROOM.kasir]).emit('order:updated', payload);
      app.io.to(ROOM.order(order.id)).emit('order:status', {
        orderCode: order.orderCode,
        status: order.status,
        at: payload.updatedAt,
      });
      return { data: order };
    },
  );

  app.get('/stats', { preHandler: staff }, async (req) => {
    const rows = await orderRepository.aktif(req.pengguna!.outletId, STATUS_AKTIF_DAPUR);
    const now = Date.now();
    const umur = rows.map((r) => Math.floor((now - r.createdAt.getTime()) / 1000));

    return {
      data: {
        total: rows.length,
        baru: rows.filter((r) => r.status === 'baru').length,
        dikonfirmasi: rows.filter((r) => r.status === 'dikonfirmasi').length,
        diproses: rows.filter((r) => r.status === 'diproses').length,
        menungguLama: umur.filter((s) => s >= KDS_AMBANG_MERAH).length,
        perluPerhatian: umur.filter((s) => s >= KDS_AMBANG_KUNING && s < KDS_AMBANG_MERAH).length,
        umurTerlamaSeconds: umur.length > 0 ? Math.max(...umur) : 0,
      },
    };
  });
};
