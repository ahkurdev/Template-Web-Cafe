import { useState } from 'react';
import { formatRupiah, type PaymentMethod } from '@cafe/shared';
import { GrafikOmzet } from '../components/GrafikOmzet.js';
import { ambilToken, ambilUser } from '../lib/api.js';
import {
  dariInputDate,
  keInputDate,
  preset,
  useRingkasan,
  useSeriOmzet,
  useTerlaris,
  type GroupBy,
  type Rentang,
} from '../hooks/useLaporan.js';

const LABEL_METODE: Record<PaymentMethod, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
  qris_manual: 'QRIS',
};

const PRESET: { label: string; buat: () => Rentang }[] = [
  { label: 'Hari ini', buat: preset.hariIni },
  { label: '7 hari', buat: preset.tujuhHari },
  { label: 'Bulan ini', buat: preset.bulanIni },
  { label: 'Bulan lalu', buat: preset.bulanLalu },
];

export default function HalamanLaporan() {
  const [rentang, setRentang] = useState<Rentang>(() => preset.bulanIni());
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [aktif, setAktif] = useState('Bulan ini');

  const ringkasan = useRingkasan(rentang);
  const seri = useSeriOmzet(rentang, groupBy);
  const terlaris = useTerlaris(rentang);

  const bolehExport = ambilUser()?.role === 'admin';
  const r = ringkasan.data;

  return (
    <>
      <h1 className="text-xl font-semibold">Laporan</h1>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {PRESET.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setRentang(p.buat());
              setAktif(p.label);
              // Rentang panjang per hari menghasilkan ratusan batang.
              setGroupBy(p.label === 'Hari ini' ? 'day' : groupBy);
            }}
            aria-pressed={aktif === p.label}
            className={`rounded-lg px-3 text-sm ring-1 ring-inset ${
              aktif === p.label
                ? 'bg-[var(--color-accent)] font-medium text-white ring-transparent'
                : 'bg-[var(--color-surface)] ring-[var(--color-border)]'
            }`}
          >
            {p.label}
          </button>
        ))}

        <label className="text-sm">
          <span className="sr-only">Dari tanggal</span>
          <input
            type="date"
            value={keInputDate(rentang.from)}
            onChange={(e) => {
              if (!e.target.value) return;
              setRentang((v) => ({ ...v, from: dariInputDate(e.target.value, false) }));
              setAktif('Custom');
            }}
            className="rounded-lg bg-[var(--color-surface)] px-2 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>
        <span className="pb-2 text-sm text-[var(--color-muted)]">→</span>
        <label className="text-sm">
          <span className="sr-only">Sampai tanggal</span>
          <input
            type="date"
            value={keInputDate(rentang.to)}
            onChange={(e) => {
              if (!e.target.value) return;
              setRentang((v) => ({ ...v, to: dariInputDate(e.target.value, true) }));
              setAktif('Custom');
            }}
            className="rounded-lg bg-[var(--color-surface)] px-2 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>
      </div>

      {ringkasan.error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200">
          Gagal memuat laporan. Rentang maksimum 1 tahun.
        </p>
      )}

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Kartu label="Omzet" nilai={r ? formatRupiah(r.omzet) : '…'} utama />
        <Kartu label="Jumlah order" nilai={r ? String(r.jumlahOrder) : '…'} />
        <Kartu label="Rata-rata per order" nilai={r ? formatRupiah(r.rataPerOrder) : '…'} />
        <Kartu label="Diskon diberikan" nilai={r ? formatRupiah(r.diskon) : '…'} />
      </dl>

      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Hanya order berstatus <strong>lunas</strong>, dihitung pada waktu pembayaran. Order yang dibuat
        23.50 dan dibayar 00.10 masuk omzet hari pembayaran.
      </p>

      <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Omzet per periode</h2>
          <div className="flex gap-1.5">
            {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                aria-pressed={groupBy === g}
                className={`rounded-lg px-3 text-sm ring-1 ring-inset ${
                  groupBy === g
                    ? 'bg-[var(--color-fg)] text-[var(--color-bg)] ring-transparent'
                    : 'ring-[var(--color-border)]'
                }`}
              >
                {g === 'day' ? 'Harian' : g === 'week' ? 'Mingguan' : 'Bulanan'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          {seri.isLoading ? (
            <div className="h-52 animate-pulse rounded-lg bg-[var(--color-border)]" />
          ) : (
            <GrafikOmzet data={seri.data ?? []} />
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h2 className="font-semibold">Menu terlaris</h2>
          {terlaris.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--color-muted)]">Belum ada penjualan.</p>
          )}
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                <th className="py-1">Menu</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {terlaris.data?.map((i) => (
                <tr key={i.name} className="border-b border-[var(--color-border)]/60">
                  <td className="py-1.5">{i.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{i.qty}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatRupiah(i.nilai)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h2 className="font-semibold">Metode pembayaran</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                <th className="py-1">Metode</th>
                <th className="py-1 text-right">Order</th>
                <th className="py-1 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {r?.perMetode.map((m) => (
                <tr key={m.method ?? 'lain'} className="border-b border-[var(--color-border)]/60">
                  <td className="py-1.5">{m.method ? LABEL_METODE[m.method] : '—'}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.jumlah}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatRupiah(m.nilai)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {r && (
            <dl className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3 text-sm">
              <BarisKecil k="Subtotal" v={formatRupiah(r.subtotal)} />
              <BarisKecil k="Pajak" v={formatRupiah(r.pajak)} />
              <BarisKecil k="Servis" v={formatRupiah(r.service)} />
            </dl>
          )}
        </section>
      </div>

      {bolehExport && (
        <section className="mt-4">
          <h2 className="font-semibold">Export CSV</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Angka rupiah polos tanpa pemisah ribuan supaya bisa langsung di-SUM di spreadsheet.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <TombolCsv jenis="orders" label="Per order" rentang={rentang} />
            <TombolCsv jenis="items" label="Per item terjual" rentang={rentang} />
            <TombolCsv jenis="revenue" label={`Rekap ${groupBy}`} rentang={rentang} groupBy={groupBy} />
          </div>
        </section>
      )}
    </>
  );
}

/**
 * Unduhan CSV lewat fetch + blob, bukan `<a href>`: endpoint butuh header
 * Authorization yang tidak bisa dikirim oleh navigasi biasa.
 */
function TombolCsv({
  jenis,
  label,
  rentang,
  groupBy,
}: {
  jenis: 'orders' | 'items' | 'revenue';
  label: string;
  rentang: Rentang;
  groupBy?: GroupBy;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [gagal, setGagal] = useState(false);

  const unduh = async () => {
    setSibuk(true);
    setGagal(false);
    try {
      const q = new URLSearchParams({
        dateFrom: rentang.from,
        dateTo: rentang.to,
        ...(groupBy ? { groupBy } : {}),
      });
      const res = await fetch(`/api/reports/export/${jenis}.csv?${q}`, {
        headers: { authorization: `Bearer ${ambilToken() ?? ''}` },
      });
      if (!res.ok) throw new Error(String(res.status));

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? `${jenis}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setGagal(true);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <button
      type="button"
      disabled={sibuk}
      onClick={() => void unduh()}
      className={`rounded-lg px-4 text-sm ring-1 ring-inset disabled:opacity-50 ${
        gagal ? 'text-red-700 ring-red-200' : 'ring-[var(--color-border)]'
      }`}
    >
      {sibuk ? 'Menyiapkan…' : gagal ? `${label} — gagal, coba lagi` : label}
    </button>
  );
}

function Kartu({ label, nilai, utama }: { label: string; nilai: string; utama?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${utama ? 'text-2xl font-semibold' : 'text-lg font-medium'}`}>
        {nilai}
      </dd>
    </div>
  );
}

const BarisKecil = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between">
    <dt className="text-[var(--color-muted)]">{k}</dt>
    <dd className="tabular-nums">{v}</dd>
  </div>
);
