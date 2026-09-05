import { KDS_AMBANG_KUNING, KDS_AMBANG_MERAH } from '@cafe/shared';

export type Umur = 'baru' | 'kuning' | 'merah';

/** Ambang dari @cafe/shared — satu sumber, dipakai juga oleh /kitchen/stats. */
export const umurKartu = (detik: number): Umur =>
  detik >= KDS_AMBANG_MERAH ? 'merah' : detik >= KDS_AMBANG_KUNING ? 'kuning' : 'baru';

export const formatTimer = (detik: number): string => {
  const d = Math.max(0, Math.floor(detik));
  const m = Math.floor(d / 60);
  const s = d % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};
