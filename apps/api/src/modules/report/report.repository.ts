import { prisma } from '../../db/client.js';

/**
 * Semua laporan: hanya order `lunas`, basis tanggal `paidAt` (bukan createdAt).
 * Order dibuat 23.50 dan dibayar 00.10 masuk omzet hari pembayaran.
 */
const lunas = (outletId: string, from: Date, to: Date) => ({
  outletId,
  paymentStatus: 'lunas' as const,
  paidAt: { gte: from, lte: to },
});

export const reportRepository = {
  async ringkasan(outletId: string, from: Date, to: Date) {
    const where = lunas(outletId, from, to);
    const [agg, perMetode] = await Promise.all([
      prisma.order.aggregate({
        where,
        _sum: { total: true, subtotal: true, taxAmount: true, serviceAmount: true, discountAmount: true },
        _count: true,
        _avg: { total: true },
      }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { total: true },
        _count: true,
      }),
    ]);
    return { agg, perMetode };
  },

  /** Deret waktu. Agregasi di JS, bukan SQL: menghindari fungsi tanggal spesifik dialek. */
  seriOmzet: (outletId: string, from: Date, to: Date) =>
    prisma.order.findMany({
      where: lunas(outletId, from, to),
      select: { paidAt: true, total: true },
      orderBy: { paidAt: 'asc' },
    }),

  async menuTerlaris(outletId: string, from: Date, to: Date, limit: number) {
    const rows = await prisma.orderItem.groupBy({
      by: ['nameSnapshot'],
      where: { order: lunas(outletId, from, to) },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({
      name: r.nameSnapshot,
      qty: r._sum.qty ?? 0,
      nilai: r._sum.subtotal ?? 0,
    }));
  },

  orderUntukExport: (outletId: string, from: Date, to: Date) =>
    prisma.order.findMany({
      where: lunas(outletId, from, to),
      orderBy: { paidAt: 'asc' },
      select: {
        orderCode: true,
        paidAt: true,
        createdAt: true,
        type: true,
        status: true,
        customerName: true,
        subtotal: true,
        taxAmount: true,
        serviceAmount: true,
        discountAmount: true,
        total: true,
        paymentMethod: true,
        table: { select: { number: true } },
        createdBy: { select: { name: true } },
      },
    }),

  itemUntukExport: (outletId: string, from: Date, to: Date) =>
    prisma.orderItem.findMany({
      where: { order: lunas(outletId, from, to) },
      orderBy: { createdAt: 'asc' },
      select: {
        nameSnapshot: true,
        priceSnapshot: true,
        qty: true,
        subtotal: true,
        note: true,
        order: { select: { orderCode: true, paidAt: true } },
      },
    }),
};
