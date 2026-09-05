import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRupiah, type OrderPublic, type OrderStatus } from '@cafe/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

const LANGKAH: { status: OrderStatus; label: string; deskripsi: string }[] = [
  { status: 'baru', label: 'Diterima', deskripsi: 'Pesanan masuk ke kasir' },
  { status: 'dikonfirmasi', label: 'Dikonfirmasi', deskripsi: 'Menunggu dibuat' },
  { status: 'diproses', label: 'Dibuat', deskripsi: 'Barista sedang mengerjakan' },
  { status: 'selesai', label: 'Siap', deskripsi: 'Silakan diambil' },
  { status: 'diambil', label: 'Selesai', deskripsi: 'Terima kasih' },
];

export default function HalamanStatus() {
  const { orderCode = '' } = useParams();
  const qc = useQueryClient();

  const { data: order, isLoading, error } = useQuery<OrderPublic>({
    queryKey: ['order', orderCode],
    queryFn: () => api.get<OrderPublic>(`/orders/code/${orderCode}`),
    retry: false,
  });

  // Push, bukan polling. Server memverifikasi orderCode sebelum join room.
  useEffect(() => {
    if (!orderCode) return;
    const s = getSocket();

    const subscribe = () => s.emit('order:subscribe', { orderCode });
    const onStatus = (p: { orderCode: string; status: OrderStatus }) => {
      if (p.orderCode !== orderCode) return;
      qc.setQueryData<OrderPublic>(['order', orderCode], (lama) =>
        lama ? { ...lama, status: p.status } : lama,
      );
    };
    const onCancelled = () => void qc.invalidateQueries({ queryKey: ['order', orderCode] });

    subscribe();
    s.on('connect', subscribe); // join ulang setelah reconnect
    s.on('order:status', onStatus);
    s.on('order:cancelled', onCancelled);

    return () => {
      s.emit('order:unsubscribe', { orderCode });
      s.off('connect', subscribe);
      s.off('order:status', onStatus);
      s.off('order:cancelled', onCancelled);
    };
  }, [orderCode, qc]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg animate-pulse space-y-3 px-4 pt-8">
        <div className="h-8 w-40 rounded bg-[var(--color-border)]" />
        <div className="h-48 rounded-xl bg-[var(--color-border)]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-medium">Pesanan tidak ditemukan</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Kode <strong>{orderCode}</strong> tidak ada. Tanya kasir bila perlu.
        </p>
        <Link to="/" className="mt-5 inline-flex rounded-lg bg-[var(--color-accent)] px-5 py-3 font-medium text-white">
          Kembali ke Menu
        </Link>
      </div>
    );
  }

  const dibatalkan = order.status === 'dibatalkan';
  const indeksAktif = LANGKAH.findIndex((l) => l.status === order.status);

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
      <div className="text-center">
        <p className="text-sm text-[var(--color-muted)]">Kode pesanan</p>
        <p className="text-3xl font-bold tracking-tight tabular-nums">{order.orderCode}</p>
        {order.tableNumber && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">Meja {order.tableNumber}</p>
        )}
      </div>

      {dibatalkan ? (
        <div
          role="status"
          className="mt-6 rounded-xl bg-red-50 p-4 text-center text-red-900 ring-1 ring-inset ring-red-200"
        >
          <p className="font-medium">Pesanan dibatalkan</p>
          <p className="mt-1 text-sm">Hubungi kasir untuk informasi lebih lanjut.</p>
        </div>
      ) : (
        <ol className="mt-6 space-y-0" aria-label="Status pesanan">
          {LANGKAH.map((l, i) => {
            const lewat = i < indeksAktif;
            const aktif = i === indeksAktif;
            return (
              <li key={l.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      lewat || aktif
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-surface)] text-[var(--color-muted)] ring-1 ring-inset ring-[var(--color-border)]'
                    }`}
                  >
                    {lewat ? '✓' : i + 1}
                  </span>
                  {i < LANGKAH.length - 1 && (
                    <span
                      aria-hidden
                      className={`w-0.5 flex-1 ${lewat ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
                    />
                  )}
                </div>

                <div className={`pb-6 ${aktif ? '' : 'opacity-60'}`}>
                  <p className="font-medium leading-7">
                    {l.label}
                    {aktif && <span className="sr-only"> (status saat ini)</span>}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">{l.deskripsi}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-sm font-semibold">Rincian</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span className="min-w-0">
                {i.qty}× {i.nameSnapshot}
                {i.note && <em className="block text-xs text-[var(--color-muted)]">{i.note}</em>}
              </span>
              <span className="shrink-0 tabular-nums">{formatRupiah(i.subtotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3 text-sm">
          <Baris label="Subtotal" nilai={order.subtotal} />
          {order.taxAmount > 0 && <Baris label="Pajak" nilai={order.taxAmount} />}
          {order.serviceAmount > 0 && <Baris label="Servis" nilai={order.serviceAmount} />}
          <div className="flex justify-between pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatRupiah(order.total)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-[var(--color-muted)]">
          {order.paymentStatus === 'lunas' ? 'Sudah dibayar' : 'Bayar di kasir'}
        </p>
      </div>

      <Link
        to="/"
        className="mt-4 flex w-full items-center justify-center rounded-lg bg-[var(--color-surface)] py-3 font-medium ring-1 ring-inset ring-[var(--color-border)]"
      >
        Pesan Lagi
      </Link>
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="flex justify-between text-[var(--color-muted)]">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatRupiah(nilai)}</dd>
    </div>
  );
}
