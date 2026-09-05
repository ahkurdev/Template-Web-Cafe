import { describe, expect, it } from 'vitest';
import { hitungTotal, kembalian, persenDari, subtotalItem, subtotalOrder, formatRupiah } from './money.js';

describe('subtotalItem', () => {
  it('mengalikan harga integer dengan qty', () => {
    expect(subtotalItem(18000, 2)).toBe(36000);
  });
  it('menolak harga pecahan', () => {
    expect(() => subtotalItem(18000.5, 1)).toThrow();
  });
  it('menolak qty nol atau negatif', () => {
    expect(() => subtotalItem(18000, 0)).toThrow();
    expect(() => subtotalItem(18000, -1)).toThrow();
  });
});

describe('hitungTotal', () => {
  it('tanpa pajak & service, total = subtotal', () => {
    expect(hitungTotal({ subtotal: 45000 }).total).toBe(45000);
  });

  it('pajak 11% dibulatkan sekali di tingkat order', () => {
    const r = hitungTotal({ subtotal: 45000, taxPercent: 11 });
    expect(r.taxAmount).toBe(4950);
    expect(r.total).toBe(49950);
  });

  // Inti aturan: bulatkan sekali di order, bukan per item.
  // Per item, 3x round(3333*11/100)=3x367=1101. Di tingkat order, round(9999*11/100)=1100.
  it('pembulatan per order berbeda dari per item — yang benar adalah per order', () => {
    const items = [3333, 3333, 3333].map((p) => ({ subtotal: subtotalItem(p, 1) }));
    const subtotal = subtotalOrder(items);
    expect(subtotal).toBe(9999);
    const perOrder = persenDari(subtotal, 11);
    const perItem = items.reduce((a, i) => a + persenDari(i.subtotal, 11), 0);
    expect(perOrder).toBe(1100);
    expect(perItem).toBe(1101);
    expect(hitungTotal({ subtotal, taxPercent: 11 }).taxAmount).toBe(perOrder);
  });

  it('mengurangi diskon setelah pajak & service', () => {
    const r = hitungTotal({ subtotal: 100000, taxPercent: 10, servicePercent: 5, discountAmount: 15000 });
    expect(r).toMatchObject({ taxAmount: 10000, serviceAmount: 5000, total: 100000 });
  });

  it('menolak diskon melebihi total', () => {
    expect(() => hitungTotal({ subtotal: 10000, discountAmount: 20000 })).toThrow();
  });

  it('semua hasil tetap integer', () => {
    const r = hitungTotal({ subtotal: 33333, taxPercent: 11, servicePercent: 7 });
    for (const v of Object.values(r)) expect(Number.isInteger(v)).toBe(true);
  });
});

describe('kembalian', () => {
  it('menghitung selisih', () => {
    expect(kembalian(50000, 45000)).toBe(5000);
  });
  it('menolak uang kurang', () => {
    expect(() => kembalian(40000, 45000)).toThrow();
  });
});

describe('formatRupiah', () => {
  it('memakai pemisah ribuan Indonesia', () => {
    expect(formatRupiah(45000)).toBe('Rp 45.000');
  });
});
