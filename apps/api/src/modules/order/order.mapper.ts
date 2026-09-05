import type { Order, OrderPublic, OrderStatus } from '@cafe/shared';

type Row = {
  id: string;
  orderCode: string;
  table: { id: string; number: string } | null;
  type: 'dine_in' | 'takeaway';
  status: OrderStatus;
  customerName: string | null;
  note: string | null;
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  discountAmount: number;
  total: number;
  paymentStatus: 'belum_bayar' | 'lunas' | 'dibatalkan';
  paymentMethod: 'cash' | 'transfer' | 'qris_manual' | null;
  paidAmount: number | null;
  changeAmount: number | null;
  paidAt: Date | null;
  createdAt: Date;
  items: {
    id: string;
    menuItemId: string | null;
    nameSnapshot: string;
    priceSnapshot: number;
    qty: number;
    subtotal: number;
    note: string | null;
  }[];
};

export const keOrder = (r: Row): Order => ({
  id: r.id,
  orderCode: r.orderCode,
  table: r.table,
  type: r.type,
  status: r.status,
  customerName: r.customerName,
  note: r.note,
  subtotal: r.subtotal,
  taxAmount: r.taxAmount,
  serviceAmount: r.serviceAmount,
  discountAmount: r.discountAmount,
  total: r.total,
  paymentStatus: r.paymentStatus,
  paymentMethod: r.paymentMethod,
  paidAmount: r.paidAmount,
  changeAmount: r.changeAmount,
  paidAt: r.paidAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  items: r.items,
});

/**
 * Bentuk untuk pelanggan. Sengaja membuang paidAmount, changeAmount,
 * paymentMethod, dan data staff — pelanggan tidak perlu tahu isi kas.
 */
export const keOrderPublic = (r: Row): OrderPublic => ({
  orderCode: r.orderCode,
  status: r.status,
  tableNumber: r.table?.number ?? null,
  customerName: r.customerName,
  subtotal: r.subtotal,
  taxAmount: r.taxAmount,
  serviceAmount: r.serviceAmount,
  total: r.total,
  paymentStatus: r.paymentStatus,
  createdAt: r.createdAt.toISOString(),
  items: r.items.map((i) => ({
    nameSnapshot: i.nameSnapshot,
    priceSnapshot: i.priceSnapshot,
    qty: i.qty,
    subtotal: i.subtotal,
    note: i.note,
  })),
});
