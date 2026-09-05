import { reportRepository } from './report.repository.js';
import { AppError } from '../../lib/errors.js';

const SETAHUN_MS = 366 * 24 * 60 * 60 * 1000;

/** Default: hari ini. Maksimum rentang 1 tahun per request. */
export const rentang = (dateFrom?: Date, dateTo?: Date): { from: Date; to: Date } => {
  const now = new Date();
  const from = dateFrom ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = dateTo ?? now;
  if (to < from) throw new AppError('VALIDATION_FAILED', 400, 'dateTo lebih awal dari dateFrom');
  if (to.getTime() - from.getTime() > SETAHUN_MS) {
    throw new AppError('VALIDATION_FAILED', 400, 'Rentang maksimum 1 tahun');
  }
  return { from, to };
};

/** Kunci bucket untuk deret waktu. Dihitung di JS agar bebas dialek SQL. */
const bucket = (d: Date, groupBy: 'day' | 'week' | 'month'): string => {
  const iso = d.toISOString();
  if (groupBy === 'month') return iso.slice(0, 7);
  if (groupBy === 'day') return iso.slice(0, 10);
  // Minggu: Senin sebagai awal.
  const senin = new Date(d);
  const hari = (senin.getUTCDay() + 6) % 7;
  senin.setUTCDate(senin.getUTCDate() - hari);
  return senin.toISOString().slice(0, 10);
};

export const reportService = {
  async ringkasan(outletId: string, from: Date, to: Date) {
    const { agg, perMetode } = await reportRepository.ringkasan(outletId, from, to);
    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      jumlahOrder: agg._count,
      omzet: agg._sum.total ?? 0,
      subtotal: agg._sum.subtotal ?? 0,
      pajak: agg._sum.taxAmount ?? 0,
      service: agg._sum.serviceAmount ?? 0,
      diskon: agg._sum.discountAmount ?? 0,
      rataPerOrder: Math.round(agg._avg.total ?? 0),
      perMetode: perMetode.map((m) => ({
        method: m.paymentMethod,
        jumlah: m._count,
        nilai: m._sum.total ?? 0,
      })),
    };
  },

  async seriOmzet(outletId: string, from: Date, to: Date, groupBy: 'day' | 'week' | 'month') {
    const rows = await reportRepository.seriOmzet(outletId, from, to);
    const peta = new Map<string, { omzet: number; jumlah: number }>();

    for (const r of rows) {
      if (!r.paidAt) continue;
      const k = bucket(r.paidAt, groupBy);
      const ada = peta.get(k) ?? { omzet: 0, jumlah: 0 };
      ada.omzet += r.total;
      ada.jumlah += 1;
      peta.set(k, ada);
    }
    return [...peta.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periode, v]) => ({ periode, ...v }));
  },

  menuTerlaris: (outletId: string, from: Date, to: Date, limit: number) =>
    reportRepository.menuTerlaris(outletId, from, to, limit),

  csvOrder: (outletId: string, from: Date, to: Date) =>
    reportRepository.orderUntukExport(outletId, from, to),

  csvItem: (outletId: string, from: Date, to: Date) =>
    reportRepository.itemUntukExport(outletId, from, to),
};
