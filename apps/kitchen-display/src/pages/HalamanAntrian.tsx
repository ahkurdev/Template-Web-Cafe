import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { OrderStatus, QueueOrder } from '@cafe/shared';
import { KartuOrder } from '../components/KartuOrder.js';
import { ambilToken, ambilUser, hapusSesi } from '../lib/api.js';
import { pasangReconnect, resetSocket } from '../lib/socket.js';
import { aktifkanBunyi, bunyiAktif } from '../lib/bunyi.js';
import { useAntrian, useUbahStatusDapur, type StatusDapur } from '../hooks/useAntrian.js';
import { useDetik, useWakeLock } from '../hooks/useLayar.js';

const KOLOM: { judul: string; status: OrderStatus[] }[] = [
  { judul: 'Baru', status: ['baru'] },
  { judul: 'Diproses', status: ['dikonfirmasi', 'diproses'] },
];

/** Kartu 'Siap' hilang setelah 5 menit — kolom ini konfirmasi, bukan riwayat. */
const TAHAN_SIAP_MS = 5 * 60_000;

export default function HalamanAntrian() {
  const qc = useQueryClient();
  const { data: antrian, isLoading, error } = useAntrian();
  const ubah = useUbahStatusDapur();
  const now = useDetik();
  const wakeLock = useWakeLock();
  const [tersambung, setTersambung] = useState(false);
  const [suara, setSuara] = useState(bunyiAktif());
  // GET /kitchen/queue hanya mengembalikan status aktif dapur, jadi order yang
  // ditandai selesai langsung hilang dari server. Ditahan sebentar di sisi
  // klien supaya barista lihat tapnya benar-benar tercatat.
  const [siap, setSiap] = useState<{ order: QueueOrder; pada: number }[]>([]);
  const user = ambilUser();

  useEffect(() => pasangReconnect(qc, setTersambung), [qc]);

  // Buang yang kedaluwarsa, dan yang muncul lagi di antrian (kasir mengembalikan status).
  useEffect(() => {
    setSiap((lama) => {
      const idAktif = new Set(antrian?.map((o) => o.id));
      const sisa = lama.filter((s) => now - s.pada < TAHAN_SIAP_MS && !idAktif.has(s.order.id));
      return sisa.length === lama.length ? lama : sisa;
    });
  }, [now, antrian]);

  if (!ambilToken() || !user) return <Navigate to="/login" replace />;

  // elapsedSeconds dari server hanya benar saat fetch. Umur dihitung ulang dari
  // createdAt supaya timer tetap jalan antar-refetch.
  const detikSejak = (o: QueueOrder) =>
    Math.max(0, Math.floor((now - new Date(o.createdAt).getTime()) / 1000));

  const terlama = antrian?.reduce((a, o) => Math.max(a, detikSejak(o)), 0) ?? 0;

  const aksi = (id: string, status: StatusDapur) => {
    if (status === 'selesai') {
      const o = antrian?.find((x) => x.id === id);
      if (o) setSiap((l) => [{ order: o, pada: Date.now() }, ...l]);
    }
    ubah.mutate({ id, status });
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">Dapur</h1>

        {/* Indikator koneksi besar: kalau socket mati, staf harus langsung tahu
            layar ini tidak bisa dipercaya. */}
        <span
          role="status"
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            tersambung ? 'bg-emerald-900/60 text-emerald-200' : 'bg-red-600 text-white'
          }`}
        >
          {tersambung ? '● Tersambung' : '○ TERPUTUS — data tidak terbaru'}
        </span>

        <span className="text-sm text-[var(--color-muted)] tabular-nums">
          {antrian?.length ?? 0} order
          {terlama > 0 && ` · terlama ${Math.floor(terlama / 60)} menit`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!suara && (
            <button
              type="button"
              onClick={() => void aktifkanBunyi().then(() => setSuara(true))}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-bold text-black"
            >
              🔔 Aktifkan suara
            </button>
          )}
          {!wakeLock && 'wakeLock' in navigator && (
            <span className="text-xs text-[var(--color-muted)]">layar bisa tidur</span>
          )}
          <button
            type="button"
            onClick={() => {
              hapusSesi();
              resetSocket();
              qc.clear();
              location.assign('/kds/login');
            }}
            className="rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] ring-1 ring-inset ring-[var(--color-border)]"
          >
            Keluar
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="m-3 rounded-lg bg-red-950/60 p-3 text-red-200 ring-1 ring-inset ring-red-800">
          Gagal memuat antrian. Cek koneksi ke server.
        </p>
      )}

      {isLoading && <p className="p-6 text-[var(--color-muted)]">Memuat antrian…</p>}

      {antrian?.length === 0 && siap.length === 0 && !isLoading && (
        <p className="p-16 text-center text-xl text-[var(--color-muted)]">
          Antrian kosong. Order baru muncul sendiri di sini.
        </p>
      )}

      <div className="grid gap-3 p-3 lg:grid-cols-3">
        {KOLOM.map((k) => {
          const isi = antrian?.filter((o) => k.status.includes(o.status)) ?? [];
          return (
            <Kolom key={k.judul} judul={k.judul} jumlah={isi.length}>
              {isi.map((o) => (
                <KartuOrder
                  key={o.id}
                  order={o}
                  detik={detikSejak(o)}
                  sedangKirim={ubah.isPending && ubah.variables?.id === o.id}
                  onAksi={aksi}
                />
              ))}
            </Kolom>
          );
        })}

        <Kolom judul="Siap" jumlah={siap.length}>
          {siap.map(({ order: o }) => (
            <KartuOrder key={o.id} order={{ ...o, status: 'selesai' }} detik={detikSejak(o)} sedangKirim={false} onAksi={aksi} />
          ))}
          {siap.length === 0 && (
            <li className="rounded-xl border-2 border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-muted)]">
              Order yang baru ditandai siap tampil di sini selama 5 menit.
            </li>
          )}
        </Kolom>
      </div>
    </div>
  );
}

function Kolom({
  judul,
  jumlah,
  children,
}: {
  judul: string;
  jumlah: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-2 text-lg font-bold">
        {judul}
        <span className="text-base font-normal text-[var(--color-muted)] tabular-nums">{jumlah}</span>
      </h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}
