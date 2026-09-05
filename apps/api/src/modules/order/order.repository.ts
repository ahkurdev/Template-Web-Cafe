import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { awalHariIni } from '../../lib/id.js';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@cafe/shared';

export const orderInclude = {
  table: { select: { id: true, number: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      menuItemId: true,
      nameSnapshot: true,
      priceSnapshot: true,
      qty: true,
      subtotal: true,
      note: true,
    },
  },
} satisfies Prisma.OrderInclude;

export const orderIncludeLengkap = {
  ...orderInclude,
  events: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

export const orderRepository = {
  find: (id: string) => prisma.order.findUnique({ where: { id }, include: orderInclude }),

  findDiOutlet: (outletId: string, id: string) =>
    prisma.order.findFirst({ where: { id, outletId }, include: orderInclude }),

  findLengkap: (id: string) =>
    prisma.order.findUnique({ where: { id }, include: orderIncludeLengkap }),

  findByCode: (orderCode: string) =>
    prisma.order.findUnique({ where: { orderCode }, include: orderInclude }),

  daftar: (
    outletId: string,
    filter: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      dateFrom?: Date;
      dateTo?: Date;
      tableId?: string;
      q?: string;
    },
    page: number,
    limit: number,
  ) => {
    const where: Prisma.OrderWhereInput = {
      outletId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.paymentStatus ? { paymentStatus: filter.paymentStatus } : {}),
      ...(filter.tableId ? { tableId: filter.tableId } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? { createdAt: { ...(filter.dateFrom ? { gte: filter.dateFrom } : {}), ...(filter.dateTo ? { lte: filter.dateTo } : {}) } }
        : {}),
      ...(filter.q
        ? { OR: [{ orderCode: { contains: filter.q } }, { customerName: { contains: filter.q } }] }
        : {}),
    };
    return prisma.$transaction([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);
  },

  aktif: (outletId: string, statuses: readonly OrderStatus[]) =>
    prisma.order.findMany({
      where: { outletId, status: { in: [...statuses] } },
      include: orderInclude,
      orderBy: { createdAt: 'asc' },
    }),

  /** Nomor urut harian untuk orderCode. Dihitung dari jumlah order hari ini. */
  hitungOrderHariIni: (outletId: string) =>
    prisma.order.count({ where: { outletId, createdAt: { gte: awalHariIni() } } }),

  updateStatus: (id: string, status: OrderStatus) =>
    prisma.order.update({ where: { id }, data: { status }, include: orderInclude }),

  updatePembayaran: (
    id: string,
    data: {
      paymentStatus: PaymentStatus;
      paymentMethod: PaymentMethod;
      paidAmount: number | null;
      changeAmount: number | null;
      paidAt: Date;
    },
  ) => prisma.order.update({ where: { id }, data, include: orderInclude }),

  updateTotal: (
    id: string,
    data: { discountAmount: number; taxAmount: number; serviceAmount: number; total: number },
  ) => prisma.order.update({ where: { id }, data, include: orderInclude }),

  catatEvent: (data: {
    id: string;
    orderId: string;
    status: OrderStatus;
    note?: string | null;
    actorId?: string | null;
  }) => prisma.orderEvent.create({ data }),
};
