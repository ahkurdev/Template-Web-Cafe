import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Role,
  TableStatus,
} from './constants.js';

export interface UserPublic {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CategoryWithItems extends Category {
  items: MenuItem[];
}

export interface CafeTable {
  id: string;
  number: string;
  capacity: number | null;
  location: string | null;
  status: TableStatus;
  isActive: boolean;
}

/** Hasil resolve QR — publik, tanpa qrToken agar token tidak bocor balik ke klien. */
export interface TableResolved {
  id: string;
  number: string;
  location: string | null;
}

export interface OrderItem {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  subtotal: number;
  note: string | null;
}

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderCode: string;
  table: { id: string; number: string } | null;
  type: OrderType;
  status: OrderStatus;
  customerName: string | null;
  note: string | null;
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  discountAmount: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paidAmount: number | null;
  changeAmount: number | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

/** Bentuk yang dikirim ke pelanggan (GET /orders/code/:code). Tanpa data staff & uang diterima. */
export interface OrderPublic {
  orderCode: string;
  status: OrderStatus;
  tableNumber: string | null;
  customerName: string | null;
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  total: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: Pick<OrderItem, 'nameSnapshot' | 'priceSnapshot' | 'qty' | 'subtotal' | 'note'>[];
}

export interface QueueOrder extends Order {
  elapsedSeconds: number;
}

export interface Settings {
  taxPercent: number;
  servicePercent: number;
  receiptFooter: string | null;
  currencySymbol: string;
  autoConfirmOrder: boolean;
}

export interface ApiOk<T> {
  data: T;
}

export interface ApiList<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string> };
}
