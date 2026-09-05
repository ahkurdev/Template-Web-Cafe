import { subtotalItem } from '@cafe/shared';
import { conflict, notFound } from '../../lib/errors.js';

export interface ItemInput {
  menuItemId: string;
  qty: number;
  note?: string;
}

export interface MenuUntukOrder {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface BarisSiap {
  id: string;
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  subtotal: number;
  note: string | null;
}

/**
 * Bagian murni dari checkout: validasi + susun baris dari harga DB.
 * Dipisah dari service supaya bisa diuji tanpa database.
 *
 * `peta` HARUS berasal dari DB. Harga dari klien tidak pernah dipakai —
 * kalau ikut dari body request, siapa pun bisa memesan kopi seharga Rp 1.
 */
export const susunBaris = (
  items: readonly ItemInput[],
  hasil: { peta: Map<string, MenuUntukOrder>; hilang: readonly string[]; habis: readonly string[] },
  idBaru: () => string,
): BarisSiap[] => {
  if (hasil.hilang.length > 0) throw notFound('Beberapa menu');
  if (hasil.habis.length > 0) {
    throw conflict('ITEM_UNAVAILABLE', 'Beberapa item sudah habis', {
      items: hasil.habis.join(', '),
    });
  }

  // Gabung duplikat: klien bisa mengirim menu yang sama dua kali.
  // Catatan berbeda tetap jadi baris terpisah — dapur perlu melihat keduanya.
  const gabung = new Map<string, ItemInput>();
  for (const i of items) {
    const kunci = `${i.menuItemId}|${i.note ?? ''}`;
    const ada = gabung.get(kunci);
    if (ada) ada.qty += i.qty;
    else gabung.set(kunci, { ...i });
  }

  return [...gabung.values()].map((i) => {
    const menu = hasil.peta.get(i.menuItemId);
    if (!menu) throw notFound('Menu');
    return {
      id: idBaru(),
      menuItemId: menu.id,
      nameSnapshot: menu.name,
      priceSnapshot: menu.price,
      qty: i.qty,
      subtotal: subtotalItem(menu.price, i.qty),
      note: i.note ?? null,
    };
  });
};
