import { useQuery } from '@tanstack/react-query';
import type { PaymentMethod } from '@cafe/shared';
import { api } from '../lib/api.js';

export interface Ringkasan {
  periode: { from: string; to: string };
  jumlahOrder: number;
  omzet: number;
  subtotal: number;
  pajak: number;
  service: number;
  diskon: number;
  rataPerOrder: number;
  perMetode: { method: PaymentMethod | null; jumlah: number; nilai: number }[];
}

export interface TitikOmzet {
  periode: string;
  omzet: number;
  jumlah: number;
}

export interface ItemTerlaris {
  name: string;
  qty: number;
  nilai: number;
}

export type GroupBy = 'day' | 'week' | 'month';

export interface Rentang {
  from: string;
  to: string;
}

const qs = (r: Rentang, extra: Record<string, string> = {}) =>
  new URLSearchParams({ dateFrom: r.from, dateTo: r.to, ...extra }).toString();

export const useRingkasan = (r: Rentang) =>
  useQuery<Ringkasan>({
    queryKey: ['reports', 'summary', r],
    queryFn: () => api.get<Ringkasan>(`/reports/summary?${qs(r)}`),
  });

export const useSeriOmzet = (r: Rentang, groupBy: GroupBy) =>
  useQuery<TitikOmzet[]>({
    queryKey: ['reports', 'revenue', r, groupBy],
    queryFn: () => api.get<TitikOmzet[]>(`/reports/revenue?${qs(r, { groupBy })}`),
  });

export const useTerlaris = (r: Rentang, limit = 10) =>
  useQuery<ItemTerlaris[]>({
    queryKey: ['reports', 'top', r, limit],
    queryFn: () => api.get<ItemTerlaris[]>(`/reports/top-items?${qs(r, { limit: String(limit) })}`),
  });

/** Rentang preset. Tanggal lokal → ISO, karena server memfilter pada `paidAt` UTC. */
export const preset = {
  hariIni: (): Rentang => {
    const now = new Date();
    return { from: awalHari(now).toISOString(), to: now.toISOString() };
  },
  tujuhHari: (): Rentang => {
    const now = new Date();
    const from = awalHari(now);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString(), to: now.toISOString() };
  },
  bulanIni: (): Rentang => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to: now.toISOString(),
    };
  },
  bulanLalu: (): Rentang => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Hari 0 bulan ini = hari terakhir bulan lalu, 23:59:59.
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { from: from.toISOString(), to: to.toISOString() };
  },
};

const awalHari = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** `<input type="date">` butuh yyyy-MM-dd waktu lokal, bukan potongan ISO UTC. */
export const keInputDate = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const dariInputDate = (nilai: string, akhirHari: boolean): string => {
  const [y, m, d] = nilai.split('-').map(Number) as [number, number, number];
  return akhirHari
    ? new Date(y, m - 1, d, 23, 59, 59).toISOString()
    : new Date(y, m - 1, d).toISOString();
};
