import { describe, expect, it } from 'vitest';
import { KDS_AMBANG_KUNING, KDS_AMBANG_MERAH } from '@cafe/shared';
import { formatTimer, umurKartu } from './umur.js';

describe('umurKartu', () => {
  it('netral sebelum ambang kuning', () => {
    expect(umurKartu(0)).toBe('baru');
    expect(umurKartu(KDS_AMBANG_KUNING - 1)).toBe('baru');
  });

  it('kuning tepat di ambang, bukan sesudahnya', () => {
    expect(umurKartu(KDS_AMBANG_KUNING)).toBe('kuning');
    expect(umurKartu(KDS_AMBANG_MERAH - 1)).toBe('kuning');
  });

  it('merah tepat di ambang dan seterusnya', () => {
    expect(umurKartu(KDS_AMBANG_MERAH)).toBe('merah');
    expect(umurKartu(KDS_AMBANG_MERAH * 10)).toBe('merah');
  });
});

describe('formatTimer', () => {
  it('mm:ss dengan detik dua digit', () => {
    expect(formatTimer(0)).toBe('0:00');
    expect(formatTimer(9)).toBe('0:09');
    expect(formatTimer(60)).toBe('1:00');
    expect(formatTimer(605)).toBe('10:05');
  });

  it('jam lewat 60 menit tidak di-wrap — order 90 menit harus terlihat parah', () => {
    expect(formatTimer(5400)).toBe('90:00');
  });

  it('negatif (jam klien meleset) dijepit ke nol, bukan tampil -1:-5', () => {
    expect(formatTimer(-30)).toBe('0:00');
  });

  it('pecahan detik dibulatkan ke bawah', () => {
    expect(formatTimer(59.9)).toBe('0:59');
  });
});
