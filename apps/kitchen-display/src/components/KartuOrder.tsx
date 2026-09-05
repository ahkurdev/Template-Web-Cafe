import type { QueueOrder } from '@cafe/shared';
import { formatTimer, umurKartu, type Umur } from '../lib/umur.js';
import type { StatusDapur } from '../hooks/useAntrian.js';

/** Warna kartu menua. Merah harus terbaca dari 1,5 meter, bukan sekadar aksen. */
const RINGKAS: Record<Umur, string> = {
  baru: 'border-[var(--color-border)] bg-[var(--color-surface)]',
  kuning: 'border-amber-500/70 bg-amber-950/40',
  merah: 'border-red-500 bg-red-950/50',
};

const WARNA_TIMER: Record<Umur, string> = {
  baru: 'text-[var(--color-muted)]',
  kuning: 'text-amber-300',
  merah: 'text-red-300',
};

const AKSI: Record<string, { ke: StatusDapur; label: string } | undefined> = {
  baru: { ke: 'dikonfirmasi', label: 'Terima' },
  dikonfirmasi: { ke: 'diproses', label: 'Mulai Proses' },
  diproses: { ke: 'selesai', label: 'Siap' },
};

interface Props {
  order: QueueOrder;
  detik: number;
  sedangKirim: boolean;
  onAksi: (id: string, status: StatusDapur) => void;
}

export function KartuOrder({ order: o, detik, sedangKirim, onAksi }: Props) {
  const umur = umurKartu(detik);
  const aksi = AKSI[o.status];

  return (
    <li className={`rounded-xl border-2 p-3 ${RINGKAS[umur]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Nomor meja paling menonjol: itu yang dicari saat mengantar. */}
          <p className="text-2xl font-bold leading-none">
            {o.table ? `Meja ${o.table.number}` : 'Takeaway'}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)] tabular-nums">
            {o.orderCode}
            {o.customerName && ` · ${o.customerName}`}
          </p>
        </div>
        <span className={`shrink-0 text-2xl font-bold tabular-nums ${WARNA_TIMER[umur]}`}>
          {formatTimer(detik)}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {o.items.map((i) => (
          <li key={i.id}>
            <p className="text-lg leading-tight">
              <span className="font-bold tabular-nums">{i.qty}×</span> {i.nameSnapshot}
            </p>
            {/* Catatan per item paling sering terlewat — diberi latar, bukan italic tipis. */}
            {i.note && (
              <p className="mt-0.5 rounded bg-amber-500/20 px-2 py-0.5 text-base font-medium text-amber-200">
                {i.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      {o.note && (
        <p className="mt-2 rounded bg-amber-500/20 px-2 py-1 text-base font-medium text-amber-200">
          Catatan order: {o.note}
        </p>
      )}

      {aksi && (
        <button
          type="button"
          disabled={sedangKirim}
          onClick={() => onAksi(o.id, aksi.ke)}
          className="mt-3 w-full rounded-lg bg-[var(--color-accent)] py-3 text-lg font-bold text-black disabled:opacity-50"
        >
          {aksi.label}
        </button>
      )}
    </li>
  );
}
