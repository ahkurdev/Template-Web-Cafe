import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { rentang, reportService } from './report.service.js';
import { keCsv, namaFileCsv } from '../../lib/csv.js';
import { query } from '../../lib/validate.js';

const rangeQuery = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
const revenueQuery = rangeQuery.extend({ groupBy: z.enum(['day', 'week', 'month']).default('day') });
const topQuery = rangeQuery.extend({ limit: z.coerce.number().int().min(1).max(50).default(10) });

export const reportRoutes = async (app: FastifyInstance): Promise<void> => {
  const baca = app.wajibRole('admin', 'kasir');
  const admin = app.wajibRole('admin');

  app.get('/summary', { preHandler: [baca, query(rangeQuery)] }, async (req) => {
    const q = req.query as z.infer<typeof rangeQuery>;
    const { from, to } = rentang(q.dateFrom, q.dateTo);
    return { data: await reportService.ringkasan(req.pengguna!.outletId, from, to) };
  });

  app.get('/revenue', { preHandler: [baca, query(revenueQuery)] }, async (req) => {
    const q = req.query as z.infer<typeof revenueQuery>;
    const { from, to } = rentang(q.dateFrom, q.dateTo);
    return { data: await reportService.seriOmzet(req.pengguna!.outletId, from, to, q.groupBy) };
  });

  app.get('/top-items', { preHandler: [baca, query(topQuery)] }, async (req) => {
    const q = req.query as z.infer<typeof topQuery>;
    const { from, to } = rentang(q.dateFrom, q.dateTo);
    return { data: await reportService.menuTerlaris(req.pengguna!.outletId, from, to, q.limit) };
  });

  app.get('/export/orders.csv', { preHandler: [admin, query(rangeQuery)] }, async (req, reply) => {
    const q = req.query as z.infer<typeof rangeQuery>;
    const { from, to } = rentang(q.dateFrom, q.dateTo);
    const rows = await reportService.csvOrder(req.pengguna!.outletId, from, to);

    // Angka rupiah integer polos tanpa pemisah ribuan supaya bisa di-SUM di spreadsheet.
    const csv = keCsv(
      [
        'kode_order', 'waktu_bayar', 'waktu_order', 'tipe', 'meja', 'pelanggan',
        'subtotal', 'pajak', 'service', 'diskon', 'total', 'metode', 'kasir',
      ],
      rows.map((r) => [
        r.orderCode,
        r.paidAt?.toISOString() ?? '',
        r.createdAt.toISOString(),
        r.type,
        r.table?.number ?? '',
        r.customerName ?? '',
        r.subtotal, r.taxAmount, r.serviceAmount, r.discountAmount, r.total,
        r.paymentMethod ?? '',
        r.createdBy?.name ?? 'pelanggan',
      ]),
    );
    return kirimCsv(reply, csv, namaFileCsv('order'));
  });

  app.get('/export/items.csv', { preHandler: [admin, query(rangeQuery)] }, async (req, reply) => {
    const q = req.query as z.infer<typeof rangeQuery>;
    const { from, to } = rentang(q.dateFrom, q.dateTo);
    const rows = await reportService.csvItem(req.pengguna!.outletId, from, to);

    const csv = keCsv(
      ['kode_order', 'waktu_bayar', 'menu', 'harga', 'qty', 'subtotal', 'catatan'],
      rows.map((r) => [
        r.order.orderCode,
        r.order.paidAt?.toISOString() ?? '',
        r.nameSnapshot,
        r.priceSnapshot,
        r.qty,
        r.subtotal,
        r.note ?? '',
      ]),
    );
    return kirimCsv(reply, csv, namaFileCsv('item-terjual'));
  });

  app.get('/export/revenue.csv', { preHandler: [admin, query(revenueQuery)] }, async (req, reply) => {
    const q = req.query as z.infer<typeof revenueQuery>;
    const { from, to } = rentang(q.dateFrom, q.dateTo);
    const rows = await reportService.seriOmzet(req.pengguna!.outletId, from, to, q.groupBy);

    const csv = keCsv(
      ['periode', 'jumlah_order', 'omzet'],
      rows.map((r) => [r.periode, r.jumlah, r.omzet]),
    );
    return kirimCsv(reply, csv, namaFileCsv(`omzet-${q.groupBy}`));
  });
};

const kirimCsv = (reply: FastifyReply, csv: string, nama: string) =>
  reply
    .type('text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${nama}"`)
    .send(csv);
