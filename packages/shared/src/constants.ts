export const ROLES = ['admin', 'kasir', 'dapur'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = [
  'baru',
  'dikonfirmasi',
  'diproses',
  'selesai',
  'diambil',
  'dibatalkan',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = ['dine_in', 'takeaway'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PAYMENT_STATUSES = ['belum_bayar', 'lunas', 'dibatalkan'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'transfer', 'qris_manual'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TABLE_STATUSES = ['tersedia', 'terisi', 'nonaktif'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

/** Status yang masih tampil di antrian dapur. */
export const STATUS_AKTIF_DAPUR: readonly OrderStatus[] = ['baru', 'dikonfirmasi', 'diproses'];

/** Transisi status yang sah. Ditegakkan di order.service, bukan di DB. */
export const TRANSISI_SAH: Record<OrderStatus, readonly OrderStatus[]> = {
  baru: ['dikonfirmasi', 'diproses', 'dibatalkan'],
  dikonfirmasi: ['diproses', 'dibatalkan'],
  diproses: ['selesai', 'dibatalkan'],
  selesai: ['diambil', 'dibatalkan'],
  diambil: [],
  dibatalkan: [],
};

export const bolehTransisi = (dari: OrderStatus, ke: OrderStatus): boolean =>
  TRANSISI_SAH[dari].includes(ke);

export const ID_LENGTH = 21;
export const QR_TOKEN_LENGTH = 32;

/** Ambang warna kartu KDS (detik). */
export const KDS_AMBANG_KUNING = 5 * 60;
export const KDS_AMBANG_MERAH = 10 * 60;

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'ITEM_UNAVAILABLE',
  'INVALID_STATUS_TRANSITION',
  'ORDER_ALREADY_PAID',
  'PAYMENT_INSUFFICIENT',
  'RATE_LIMITED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
