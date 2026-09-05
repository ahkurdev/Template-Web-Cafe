import {
  bolehTransisi,
  hitungTotal,
  kembalian as hitungKembalian,
  subtotalOrder,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from '@cafe/shared';
import { prisma } from '../../db/client.js';
import { orderInclude, orderRepository } from './order.repository.js';
import { keOrder } from './order.mapper.js';
import { susunBaris, type BarisSiap, type ItemInput } from './order.pricing.js';
import { menuService } from '../menu/menu.service.js';
import { tableService } from '../table/table.service.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { buatOrderCode, buatOrderCodeAcak, newId } from '../../lib/id.js';
import { conflict, notFound } from '../../lib/errors.js';

export const orderService = {
  /**
   * Checkout. Harga SELALU dari DB — klien tidak mengirim harga.
   * Ketersediaan divalidasi di sini, bukan hanya saat menu dimuat: jeda antara
   * pelanggan membuka menu dan menekan bayar bisa beberapa menit.
   */
  async checkout(input: {
    qrToken?: string;
    tableId?: string;
    outletId: string;
    customerName?: string;
    note?: string;
    items: ItemInput[];
    createdById?: string;
  }): Promise<Order> {
    let tableId: string | null = null;
    let tableNumber: string | null = null;
    let outletId = input.outletId;

    if (input.qrToken) {
      const meja = await tableService.resolveQr(input.qrToken);
      tableId = meja.id;
      tableNumber = meja.number;
      outletId = meja.outletId;
    } else if (input.tableId) {
      const meja = await tableService.daftar(outletId).then((l) => l.find((m) => m.id === input.tableId));
      if (!meja) throw notFound('Meja');
      tableId = meja.id;
      tableNumber = meja.number;
    }

    const baris = await this.siapkanBaris(outletId, input.items);
    const settings = await settingsRepository.ambil(outletId);

    const subtotal = subtotalOrder(baris);
    const uang = hitungTotal({
      subtotal,
      taxPercent: settings.taxPercent,
      servicePercent: settings.servicePercent,
    });

    const statusAwal: OrderStatus = settings.autoConfirmOrder ? 'dikonfirmasi' : 'baru';
    const orderId = newId();

    // Satu transaksi: order + item + event. Kalau ada yang gagal, tidak ada
    // order setengah jadi yang muncul di layar dapur.
    const buat = (orderCode: string) =>
      prisma.$transaction(async (tx) => {
        await tx.order.create({
          data: {
            id: orderId,
            outletId,
            orderCode,
            tableId,
            type: tableId ? 'dine_in' : 'takeaway',
            status: statusAwal,
            customerName: input.customerName ?? null,
            note: input.note ?? null,
            subtotal: uang.subtotal,
            taxAmount: uang.taxAmount,
            serviceAmount: uang.serviceAmount,
            discountAmount: 0,
            total: uang.total,
            createdById: input.createdById ?? null,
          },
        });
        await tx.orderItem.createMany({ data: baris.map((b) => ({ ...b, orderId })) });
        await tx.orderEvent.create({
          data: { id: newId(), orderId, status: statusAwal, actorId: input.createdById ?? null },
        });
        return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
      });

    const urutan = (await orderRepository.hitungOrderHariIni(outletId)) + 1;
    try {
      return keOrder(await buat(buatOrderCode(tableNumber, urutan)));
    } catch (err) {
      // Dua checkout bersamaan bisa menghasilkan nomor urut sama.
      // Retry sekali dengan kode acak — lebih sederhana dan tahan-race
      // daripada tabel counter dengan lock.
      if (isUniqueViolation(err)) {
        return keOrder(await buat(buatOrderCodeAcak(tableNumber)));
      }
      throw err;
    }
  },

  /** Ambil harga & nama dari DB, tolak kalau ada yang habis atau tidak ada. */
  async siapkanBaris(outletId: string, items: ItemInput[]): Promise<BarisSiap[]> {
    const ids = items.map((i) => i.menuItemId);
    const hasil = await menuService.itemUntukOrder(outletId, ids);
    return susunBaris(items, hasil, newId);
  },

  async ubahStatus(
    outletId: string,
    id: string,
    status: OrderStatus,
    actorId: string | null,
    note?: string,
  ): Promise<Order> {
    const order = await this.pastikanMilikOutlet(outletId, id);

    if (!bolehTransisi(order.status, status)) {
      throw conflict(
        'INVALID_STATUS_TRANSITION',
        `Tidak bisa mengubah status dari "${order.status}" ke "${status}"`,
      );
    }

    const [hasil] = await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { status }, include: orderInclude }),
      prisma.orderEvent.create({
        data: { id: newId(), orderId: id, status, note: note ?? null, actorId },
      }),
    ]);
    return keOrder(hasil);
  },

  async bayar(
    outletId: string,
    id: string,
    input: { paymentMethod: PaymentMethod; paidAmount?: number },
    actorId: string,
  ): Promise<Order> {
    const order = await this.pastikanMilikOutlet(outletId, id);

    if (order.paymentStatus === 'lunas') {
      throw conflict('ORDER_ALREADY_PAID', `Order ${order.orderCode} sudah dibayar`);
    }
    if (order.status === 'dibatalkan') {
      throw conflict('VALIDATION_FAILED', 'Order dibatalkan, tidak bisa dibayar');
    }

    let paidAmount: number | null = input.paidAmount ?? null;
    let changeAmount: number | null = null;

    if (input.paymentMethod === 'cash') {
      const diterima = input.paidAmount ?? 0;
      if (diterima < order.total) {
        throw conflict(
          'PAYMENT_INSUFFICIENT',
          `Uang diterima kurang Rp ${(order.total - diterima).toLocaleString('id-ID')}`,
          { paidAmount: 'kurang dari total' },
        );
      }
      changeAmount = hitungKembalian(diterima, order.total);
    } else {
      // transfer / qris_manual: dianggap pas.
      paidAmount = input.paidAmount ?? order.total;
      changeAmount = 0;
    }

    return keOrder(
      await orderRepository.updatePembayaran(id, {
        paymentStatus: 'lunas',
        paymentMethod: input.paymentMethod,
        paidAmount,
        changeAmount,
        paidAt: new Date(),
      }),
    );
  },

  async setDiskon(outletId: string, id: string, discountAmount: number): Promise<Order> {
    const order = await this.pastikanMilikOutlet(outletId, id);
    if (order.paymentStatus === 'lunas') {
      throw conflict('ORDER_ALREADY_PAID', 'Order sudah dibayar, diskon tidak bisa diubah');
    }

    const settings = await settingsRepository.ambil(outletId);
    const uang = hitungTotal({
      subtotal: order.subtotal,
      taxPercent: settings.taxPercent,
      servicePercent: settings.servicePercent,
      discountAmount,
    });
    // hitungTotal sudah mengembalikan discountAmount yang tervalidasi.
    return keOrder(
      await orderRepository.updateTotal(id, {
        discountAmount: uang.discountAmount,
        taxAmount: uang.taxAmount,
        serviceAmount: uang.serviceAmount,
        total: uang.total,
      }),
    );
  },

  async batalkan(outletId: string, id: string, reason: string, actorId: string): Promise<Order> {
    const order = await this.pastikanMilikOutlet(outletId, id);
    if (order.status === 'dibatalkan') throw conflict('VALIDATION_FAILED', 'Order sudah dibatalkan');
    if (order.paymentStatus === 'lunas') {
      throw conflict('ORDER_ALREADY_PAID', 'Order sudah dibayar. Lakukan refund manual, catat di kasir.');
    }

    const [hasil] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: 'dibatalkan', paymentStatus: 'dibatalkan' },
        include: orderInclude,
      }),
      prisma.orderEvent.create({
        data: { id: newId(), orderId: id, status: 'dibatalkan', note: reason, actorId },
      }),
    ]);
    return keOrder(hasil);
  },

  async pastikanMilikOutlet(outletId: string, id: string) {
    const order = await orderRepository.findDiOutlet(outletId, id);
    if (!order) throw notFound('Order');
    return order;
  },
};

/** Prisma P2002 = unique constraint. Dipakai untuk retry orderCode. */
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
