import type { OrderStatus, PaymentMethod, TableStatus } from './constants.js';
import type { Order, OrderPublic } from './types.js';

/**
 * Kontrak event Socket.io. Satu definisi dipakai server & 3 klien,
 * supaya salah tulis nama event ketahuan saat compile, bukan saat cafe ramai.
 */

export const ROOM = {
  menu: 'menu',
  kitchen: 'kitchen',
  kasir: 'kasir',
  order: (orderId: string) => `order:${orderId}`,
} as const;

export interface ServerToClient {
  'order:new': (order: Order) => void;
  'order:updated': (p: {
    id: string;
    orderCode: string;
    status: OrderStatus;
    total: number;
    updatedAt: string;
  }) => void;
  'order:paid': (p: {
    id: string;
    orderCode: string;
    paymentMethod: PaymentMethod;
    total: number;
    paidAt: string;
  }) => void;
  'order:status': (p: Pick<OrderPublic, 'orderCode' | 'status'> & { at: string }) => void;
  'order:cancelled': (p: { id: string; orderCode: string; reason: string }) => void;
  'menu:availability': (p: { menuItemId: string; isAvailable: boolean }) => void;
  'menu:updated': (p: {
    action: 'created' | 'updated' | 'deleted';
    menuItemId?: string;
    categoryId?: string;
  }) => void;
  'table:updated': (p: { id: string; number: string; status: TableStatus }) => void;
  error: (p: { code: string; message: string }) => void;
}

export interface ClientToServer {
  'order:subscribe': (p: { orderCode: string }) => void;
  'order:unsubscribe': (p: { orderCode: string }) => void;
}
