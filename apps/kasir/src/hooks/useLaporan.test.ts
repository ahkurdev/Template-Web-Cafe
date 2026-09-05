import { describe, expect, it } from 'vitest';
import { dariInputDate, keInputDate, preset } from './useLaporan.js';

/** Bug tanggal paling mahal: rentang meleset sehari karena UTC vs lokal. */
describe('rentang tanggal laporan', () => {
  it('keInputDate memakai tanggal lokal, bukan potongan ISO UTC', () => {
    // 2026-09-05 07:00 lokal. Di zona timur (WIB +7) ISO-nya masih 2026-09-05,
    // tapi di zona barat bisa jadi 2026-09-04 — yang diuji: nilainya sama
    // dengan tanggal lokal yang dilihat pengguna.
    const d = new Date(2026, 8, 5, 7, 0, 0);
    expect(keInputDate(d.toISOString())).toBe('2026-09-05');
  });

  it('bolak-balik input date tidak menggeser hari', () => {
    const awal = '2026-01-31';
    expect(keInputDate(dariInputDate(awal, false))).toBe(awal);
    expect(keInputDate(dariInputDate(awal, true))).toBe(awal);
  });

  it('akhirHari memberi 23:59:59 lokal, bukan 00:00 hari berikutnya', () => {
    const d = new Date(dariInputDate('2026-09-05', true));
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getDate()).toBe(5);
  });

  it('preset hariIni mulai tengah malam lokal', () => {
    const d = new Date(preset.hariIni().from);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('preset tujuhHari mencakup 7 hari kalender, bukan 6 atau 8', () => {
    const { from, to } = preset.tujuhHari();
    const hari = Math.round(
      (new Date(keInputDate(to)).getTime() - new Date(keInputDate(from)).getTime()) / 86_400_000,
    );
    expect(hari).toBe(6); // hari ini + 6 hari sebelumnya = 7 hari
  });

  it('preset bulanIni mulai tanggal 1', () => {
    expect(new Date(preset.bulanIni().from).getDate()).toBe(1);
  });

  it('preset bulanLalu berakhir di hari terakhir bulan lalu, bukan tanggal 1 bulan ini', () => {
    const { from, to } = preset.bulanLalu();
    const f = new Date(from);
    const t = new Date(to);
    expect(f.getDate()).toBe(1);
    // Hari berikutnya setelah `to` harus tanggal 1 — membuktikan `to` hari terakhir.
    const besok = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    expect(besok.getDate()).toBe(1);
    expect(t.getMonth()).toBe(f.getMonth());
  });

  it('semua preset punya from <= to', () => {
    for (const buat of Object.values(preset)) {
      const { from, to } = buat();
      expect(new Date(from).getTime()).toBeLessThanOrEqual(new Date(to).getTime());
    }
  });
});
