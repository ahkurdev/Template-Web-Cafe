import { customAlphabet, nanoid } from 'nanoid';
import { ID_LENGTH, QR_TOKEN_LENGTH } from '@cafe/shared';

export const newId = (): string => nanoid(ID_LENGTH);
export const newQrToken = (): string => nanoid(QR_TOKEN_LENGTH);

/** Huruf & angka tanpa karakter mirip (0/O, 1/I/l) — dibaca manual oleh staf. */
const kodeAcak = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 4);

/**
 * Kode order: <prefix><nomor 4 digit>. Prefix dari nomor meja, atau TA untuk takeaway.
 * Nomor urut harian; tabrakan unique ditangani dengan retry di service.
 */
export const buatOrderCode = (tableNumber: string | null, urutanHarian: number): string => {
  const prefix = tableNumber ? tableNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) : 'TA';
  return `${prefix}-${String(urutanHarian).padStart(4, '0')}`;
};

/** Dipakai kalau retry nomor urut masih tabrakan. */
export const buatOrderCodeAcak = (tableNumber: string | null): string => {
  const prefix = tableNumber ? tableNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) : 'TA';
  return `${prefix}-${kodeAcak()}`;
};

export const slugify = (teks: string): string =>
  teks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const awalHariIni = (d = new Date()): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
