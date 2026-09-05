import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  cancelInput,
  createManualOrderInput,
  createOrderInput,
  discountInput,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  pageQuery,
  paymentInput,
  ROOM,
  statusInput,
  STATUS_AKTIF_DAPUR,
} from '@cafe/shared';
import { orderService } from './order.service.js';
import { orderRepository } from './order.repository.js';
import { keOrder, keOrderPublic } from './order.mapper.js';
import { body, params, query } from '../../lib/validate.js';
import { notFound } from '../../lib/errors.js';
import { OUTLET_DEFAULT } from '../../lib/outlet.js';
import { settingsRepository } from '../settings/settings.repository.js';

const idParam = z.object({ id: z.string().length(21) });
const codeParam = z.object({ orderCode: z.string().min(3).max(20) });

const listQuery = pageQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  tableId: z.string().length(21).optional(),
  q: z.string().trim().max(50).optional(),
});

export const orderRoutes = async (app: FastifyInstance): Promise<void> => {
  // Publik. Rate limit ketat: pintu masuk spam order paling nyata.
  app.post(
    '/',
    { preHandler: body(createOrderInput), config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const input = req.body as {
        qrToken: string;
        customerName?: string;
        note?: string;
        items: { menuItemId: string; qty: number; note?: string }[];
      };
      const order = await orderService.checkout({ ...input, outletId: OUTLET_DEFAULT });

      // Emit SETELAH transaksi commit.
      // Satu emit ke array room, bukan dua emit terpisah: admin/kasir ada di
      // room kitchen DAN kasir, jadi dua emit membuat mereka menerima 2x
      // (badge naik dobel, bunyi dua kali, kartu duplikat).
      app.io.to([ROOM.kitchen, ROOM.kasir]).emit('order:new', order);
      app.io.to(ROOM.order(order.id)).emit('order:status', {
        orderCode: order.orderCode,
        status: order.status,
        at: order.createdAt,
      });

      return reply.code(201).send({ data: order });
    },
  );

  app.post(
    '/manual',
    { preHandler: [app.wajibRole('kasir', 'admin'), body(createManualOrderInput)] },
    async (req, reply) => {
      const input = req.body as {
        tableId?: string;
        customerName?: string;
        note?: string;
        items: { menuItemId: string; qty: number; note?: string }[];
        payNow: boolean;
        paymentMethod?: 'cash' | 'transfer' | 'qris_manual';
        paidAmount?: number;
      };
      const aku = req.pengguna!;

      let order = await orderService.checkout({
        tableId: input.tableId,
        outletId: aku.outletId,
        customerName: input.customerName,
        note: input.note,
        items: input.items,
        createdById: aku.sub,
      });

      if (input.payNow && input.paymentMethod) {
        order = await orderService.bayar(
          aku.outletId,
          order.id,
          { paymentMethod: input.paymentMethod, paidAmount: input.paidAmount },
          aku.sub,
        );
      }

      app.io.to([ROOM.kitchen, ROOM.kasir]).emit('order:new', order);
      return reply.code(201).send({ data: order });
    },
  );

  app.get('/', { preHandler: [app.wajibRole('kasir', 'admin'), query(listQuery)] }, async (req) => {
    const { page, limit, ...filter } = req.query as z.infer<typeof listQuery>;
    const [rows, total] = await orderRepository.daftar(req.pengguna!.outletId, filter, page, limit);
    return { data: rows.map(keOrder), meta: { page, limit, total } };
  });

  app.get('/active', { preHandler: app.wajibRole('kasir', 'admin') }, async (req) => {
    const rows = await orderRepository.aktif(req.pengguna!.outletId, [
      ...STATUS_AKTIF_DAPUR,
      'selesai',
    ]);
    return { data: rows.map(keOrder) };
  });

  // Publik: halaman status pelanggan. Hanya field aman (tanpa data staff & isi kas).
  app.get(
    '/code/:orderCode',
    { preHandler: params(codeParam), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req) => {
      const { orderCode } = req.params as { orderCode: string };
      const order = await orderRepository.findByCode(orderCode);
      if (!order) throw notFound('Order');
      return { data: keOrderPublic(order) };
    },
  );

  app.get(
    '/:id',
    { preHandler: [app.wajibRole('kasir', 'admin'), params(idParam)] },
    async (req) => {
      const { id } = req.params as { id: string };
      await orderService.pastikanMilikOutlet(req.pengguna!.outletId, id);
      const order = await orderRepository.findLengkap(id);
      if (!order) throw notFound('Order');
      return {
        data: {
          ...keOrder(order),
          events: order.events.map((e) => ({
            id: e.id,
            status: e.status,
            note: e.note,
            actorName: e.actor?.name ?? null,
            createdAt: e.createdAt.toISOString(),
          })),
        },
      };
    },
  );

  app.patch(
    '/:id/status',
    { preHandler: [app.wajibRole('kasir', 'admin'), params(idParam), body(statusInput)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { status, note } = req.body as { status: never; note?: string };
      const aku = req.pengguna!;
      const order = await orderService.ubahStatus(aku.outletId, id, status, aku.sub, note);
      pancarkanPerubahan(app, order);
      return { data: order };
    },
  );

  app.patch(
    '/:id/payment',
    { preHandler: [app.wajibRole('kasir', 'admin'), params(idParam), body(paymentInput)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const aku = req.pengguna!;
      const order = await orderService.bayar(aku.outletId, id, req.body as never, aku.sub);

      app.io.to(ROOM.kasir).emit('order:paid', {
        id: order.id,
        orderCode: order.orderCode,
        paymentMethod: order.paymentMethod!,
        total: order.total,
        paidAt: order.paidAt!,
      });
      return { data: order };
    },
  );

  app.patch(
    '/:id/discount',
    { preHandler: [app.wajibRole('kasir', 'admin'), params(idParam), body(discountInput)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { discountAmount } = req.body as { discountAmount: number };
      const order = await orderService.setDiskon(req.pengguna!.outletId, id, discountAmount);
      pancarkanPerubahan(app, order);
      return { data: order };
    },
  );

  app.post(
    '/:id/cancel',
    { preHandler: [app.wajibRole('kasir', 'admin'), params(idParam), body(cancelInput)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason: string };
      const aku = req.pengguna!;
      const order = await orderService.batalkan(aku.outletId, id, reason, aku.sub);

      const payload = { id: order.id, orderCode: order.orderCode, reason };
      app.io.to([ROOM.kitchen, ROOM.kasir, ROOM.order(order.id)]).emit('order:cancelled', payload);
      return { data: order };
    },
  );

  app.get(
    '/:id/receipt',
    { preHandler: [app.wajibRole('kasir', 'admin'), params(idParam)] },
    async (req) => {
      const { id } = req.params as { id: string };
      const aku = req.pengguna!;
      await orderService.pastikanMilikOutlet(aku.outletId, id);

      const [order, settings, outlet] = await Promise.all([
        orderRepository.findLengkap(id),
        settingsRepository.ambil(aku.outletId),
        settingsRepository.outlet(aku.outletId),
      ]);
      if (!order) throw notFound('Order');

      return {
        data: {
          cafe: { name: outlet?.name ?? '', address: outlet?.address ?? null, phone: outlet?.phone ?? null },
          order: keOrder(order),
          kasir: order.createdBy?.name ?? null,
          footer: settings.receiptFooter,
          currencySymbol: settings.currencySymbol,
          printedAt: new Date().toISOString(),
        },
      };
    },
  );
};

/** order:updated ke staff + order:status ke pelanggan. Selalu berpasangan. */
const pancarkanPerubahan = (app: FastifyInstance, order: ReturnType<typeof keOrder>): void => {
  const staff = {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    total: order.total,
    updatedAt: new Date().toISOString(),
  };
  // Array room, bukan dua emit: admin/kasir anggota kedua room.
  app.io.to([ROOM.kitchen, ROOM.kasir]).emit('order:updated', staff);
  app.io.to(ROOM.order(order.id)).emit('order:status', {
    orderCode: order.orderCode,
    status: order.status,
    at: staff.updatedAt,
  });
};
