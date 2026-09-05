import { z } from 'zod';
import {
  ID_LENGTH,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  QR_TOKEN_LENGTH,
  ROLES,
  TABLE_STATUSES,
} from './constants.js';

/** Uang: SELALU integer >= 0. Rp 15.000,50 tidak ada. */
export const rupiah = z.number().int().nonnegative();
export const id = z.string().length(ID_LENGTH);

// ---------- auth ----------
export const loginInput = z.object({
  username: z.string().trim().min(3).max(50).toLowerCase(),
  password: z.string().min(6).max(200),
});

export const createUserInput = z.object({
  username: z.string().trim().min(3).max(50).toLowerCase(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
});

export const updateUserInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordInput = z.object({ password: z.string().min(8).max(200) });

// ---------- menu ----------
export const categoryInput = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const menuItemInput = z.object({
  categoryId: id,
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  price: rupiah,
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const menuItemPatch = menuItemInput.partial().extend({
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const availabilityInput = z.object({ isAvailable: z.boolean() });

// ---------- table ----------
export const tableInput = z.object({
  number: z.string().trim().min(1).max(20),
  capacity: z.number().int().min(1).max(50).optional(),
  location: z.string().trim().max(80).optional(),
});

export const tablePatch = tableInput.partial().extend({
  status: z.enum(TABLE_STATUSES).optional(),
  isActive: z.boolean().optional(),
});

// ---------- order ----------
export const orderItemInput = z.object({
  menuItemId: id,
  qty: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).optional(),
});

/** Checkout pelanggan. Harga TIDAK diterima dari klien — diambil dari DB. */
export const createOrderInput = z.object({
  qrToken: z.string().length(QR_TOKEN_LENGTH),
  customerName: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(500).optional(),
  items: z.array(orderItemInput).min(1, 'minimal 1 item').max(50),
});

export const createManualOrderInput = z.object({
  tableId: id.optional(),
  customerName: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(500).optional(),
  items: z.array(orderItemInput).min(1, 'minimal 1 item').max(50),
  payNow: z.boolean().default(false),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  paidAmount: rupiah.optional(),
});

export const statusInput = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(200).optional(),
});

export const paymentInput = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHODS),
    paidAmount: rupiah.optional(),
  })
  .refine((v) => v.paymentMethod !== 'cash' || v.paidAmount !== undefined, {
    message: 'paidAmount wajib untuk pembayaran cash',
    path: ['paidAmount'],
  });

export const discountInput = z.object({ discountAmount: rupiah });
export const cancelInput = z.object({ reason: z.string().trim().min(1).max(200) });

// ---------- settings ----------
export const settingsPatch = z.object({
  taxPercent: z.number().int().min(0).max(100).optional(),
  servicePercent: z.number().int().min(0).max(100).optional(),
  receiptFooter: z.string().trim().max(500).optional(),
  currencySymbol: z.string().trim().min(1).max(5).optional(),
  autoConfirmOrder: z.boolean().optional(),
});

// ---------- query ----------
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reportRangeQuery = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export type LoginInput = z.infer<typeof loginInput>;
export type CreateUserInput = z.infer<typeof createUserInput>;
export type MenuItemInput = z.infer<typeof menuItemInput>;
export type TableInput = z.infer<typeof tableInput>;
export type CreateOrderInput = z.infer<typeof createOrderInput>;
export type CreateManualOrderInput = z.infer<typeof createManualOrderInput>;
export type PaymentInput = z.infer<typeof paymentInput>;
export type SettingsPatch = z.infer<typeof settingsPatch>;
