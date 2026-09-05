import { describe, expect, it, beforeEach } from 'vitest';
import { subtotalKasir, useKeranjangKasir } from './keranjangKasir.js';

const state = () => useKeranjangKasir.getState();
const kopi = { menuItemId: 'a'.repeat(21), name: 'Kopi Susu', price: 18_000 };
const teh = { menuItemId: 'b'.repeat(21), name: 'Teh Tawar', price: 5_000 };

describe('keranjang kasir', () => {
  beforeEach(() => state().kosongkan());

  it('menggabungkan item yang sama, bukan menambah baris', () => {
    state().tambah(kopi);
    state().tambah(kopi);
    expect(state().baris).toHaveLength(1);
    expect(state().baris[0]?.qty).toBe(2);
  });

  it('memisahkan item berbeda', () => {
    state().tambah(kopi);
    state().tambah(teh);
    expect(state().baris).toHaveLength(2);
  });

  it('membuang baris saat qty turun ke nol', () => {
    state().tambah(kopi);
    state().ubahQty(kopi.menuItemId, -1);
    expect(state().baris).toHaveLength(0);
  });

  it('membatasi qty di 99 — server menolak di atas itu', () => {
    state().tambah(kopi);
    state().ubahQty(kopi.menuItemId, 500);
    expect(state().baris[0]?.qty).toBe(99);
  });

  it('menyimpan catatan yang di-trim, kosong jadi undefined', () => {
    state().tambah(kopi);
    state().setNote(kopi.menuItemId, '  tanpa gula  ');
    expect(state().baris[0]?.note).toBe('tanpa gula');

    state().setNote(kopi.menuItemId, '   ');
    expect(state().baris[0]?.note).toBeUndefined();
  });

  it('subtotal integer rupiah, tanpa pecahan', () => {
    state().tambah(kopi);
    state().ubahQty(kopi.menuItemId, 2);
    state().tambah(teh);
    const total = subtotalKasir(state().baris);
    expect(total).toBe(18_000 * 3 + 5_000);
    expect(Number.isInteger(total)).toBe(true);
  });

  it('subtotal keranjang kosong = 0, tidak melempar', () => {
    expect(subtotalKasir([])).toBe(0);
  });
});
