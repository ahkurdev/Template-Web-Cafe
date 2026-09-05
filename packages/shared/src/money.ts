/**
 * Aritmetika uang. Semua nilai integer rupiah penuh (Rp 15.000 -> 15000).
 * Ini satu-satunya tempat perhitungan uang di seluruh repo.
 * Dilarang parseFloat / Decimal / pembagian yang menghasilkan pecahan di luar sini.
 */

export const subtotalItem = (price: number, qty: number): number => {
  assertRupiah(price);
  if (!Number.isInteger(qty) || qty < 1) throw new Error(`qty tidak valid: ${qty}`);
  return price * qty;
};

export const subtotalOrder = (items: readonly { subtotal: number }[]): number =>
  items.reduce((acc, i) => acc + i.subtotal, 0);

/** Persen integer (11 = 11%). Bulatkan SEKALI di tingkat order, bukan per item. */
export const persenDari = (dasar: number, persen: number): number => {
  assertRupiah(dasar);
  if (!Number.isInteger(persen) || persen < 0 || persen > 100)
    throw new Error(`persen tidak valid: ${persen}`);
  return Math.round((dasar * persen) / 100);
};

export interface HitungTotalInput {
  subtotal: number;
  taxPercent?: number;
  servicePercent?: number;
  discountAmount?: number;
}

export interface HitungTotalHasil {
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  discountAmount: number;
  total: number;
}

export const hitungTotal = ({
  subtotal,
  taxPercent = 0,
  servicePercent = 0,
  discountAmount = 0,
}: HitungTotalInput): HitungTotalHasil => {
  assertRupiah(subtotal);
  assertRupiah(discountAmount);
  const taxAmount = persenDari(subtotal, taxPercent);
  const serviceAmount = persenDari(subtotal, servicePercent);
  const total = subtotal + taxAmount + serviceAmount - discountAmount;
  if (total < 0) throw new Error('Diskon melebihi total');
  return { subtotal, taxAmount, serviceAmount, discountAmount, total };
};

export const kembalian = (paidAmount: number, total: number): number => {
  assertRupiah(paidAmount);
  assertRupiah(total);
  if (paidAmount < total) throw new Error('Uang diterima kurang dari total');
  return paidAmount - total;
};

export const formatRupiah = (nilai: number, simbol = 'Rp'): string =>
  `${simbol} ${nilai.toLocaleString('id-ID')}`;

function assertRupiah(n: number): void {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Nilai rupiah tidak valid: ${n}`);
}
