import type { OrderStatus, PaymentStatus } from '@cafe/shared';

const WARNA_STATUS: Record<OrderStatus, string> = {
  baru: 'bg-blue-50 text-blue-900 ring-blue-200',
  dikonfirmasi: 'bg-indigo-50 text-indigo-900 ring-indigo-200',
  diproses: 'bg-amber-50 text-amber-900 ring-amber-200',
  selesai: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  diambil: 'bg-stone-100 text-stone-700 ring-stone-300',
  dibatalkan: 'bg-red-50 text-red-900 ring-red-200',
};

const WARNA_BAYAR: Record<PaymentStatus, string> = {
  belum_bayar: 'bg-red-50 text-red-900 ring-red-200',
  lunas: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  dibatalkan: 'bg-stone-100 text-stone-700 ring-stone-300',
};

const LABEL_BAYAR: Record<PaymentStatus, string> = {
  belum_bayar: 'Belum bayar',
  lunas: 'Lunas',
  dibatalkan: 'Dibatalkan',
};

const dasar = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

export function BadgeStatus({ status }: { status: OrderStatus }) {
  return <span className={`${dasar} ${WARNA_STATUS[status]} capitalize`}>{status}</span>;
}

export function BadgeBayar({ status }: { status: PaymentStatus }) {
  return <span className={`${dasar} ${WARNA_BAYAR[status]}`}>{LABEL_BAYAR[status]}</span>;
}
