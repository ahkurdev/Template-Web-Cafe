import { describe, expect, it } from 'vitest';
import { bolehTransisi, ORDER_STATUSES, TRANSISI_SAH, type OrderStatus } from '@cafe/shared';

/**
 * Transisi status dijaga di sini, bukan di DB. Test ini yang mencegah
 * order "selesai" ditarik balik ke "diproses" oleh dua tablet yang bertabrakan.
 */
describe('transisi status order', () => {
  it('alur normal sah', () => {
    expect(bolehTransisi('baru', 'dikonfirmasi')).toBe(true);
    expect(bolehTransisi('dikonfirmasi', 'diproses')).toBe(true);
    expect(bolehTransisi('diproses', 'selesai')).toBe(true);
    expect(bolehTransisi('selesai', 'diambil')).toBe(true);
  });

  it('dapur boleh melompati dikonfirmasi', () => {
    // Barista sering langsung mengerjakan tanpa menekan "terima".
    expect(bolehTransisi('baru', 'diproses')).toBe(true);
  });

  it('mundur dilarang', () => {
    expect(bolehTransisi('diproses', 'baru')).toBe(false);
    expect(bolehTransisi('selesai', 'diproses')).toBe(false);
    expect(bolehTransisi('diambil', 'selesai')).toBe(false);
  });

  it('status final tidak punya lanjutan', () => {
    expect(TRANSISI_SAH.diambil).toHaveLength(0);
    expect(TRANSISI_SAH.dibatalkan).toHaveLength(0);
  });

  it('order aktif bisa dibatalkan, order final tidak', () => {
    for (const s of ['baru', 'dikonfirmasi', 'diproses', 'selesai'] as OrderStatus[]) {
      expect(bolehTransisi(s, 'dibatalkan')).toBe(true);
    }
    expect(bolehTransisi('diambil', 'dibatalkan')).toBe(false);
    expect(bolehTransisi('dibatalkan', 'dibatalkan')).toBe(false);
  });

  it('tidak ada status yang bisa transisi ke dirinya sendiri', () => {
    for (const s of ORDER_STATUSES) expect(bolehTransisi(s, s)).toBe(false);
  });

  it('setiap status punya entri di tabel transisi', () => {
    for (const s of ORDER_STATUSES) expect(TRANSISI_SAH[s]).toBeDefined();
  });
});
