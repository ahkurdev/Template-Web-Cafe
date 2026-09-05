import { useState } from 'react';
import { formatRupiah, STATUS_AKTIF_DAPUR, type Order } from '@cafe/shared';
import { BadgeBayar, BadgeStatus } from '../components/Badge.js';
import { ModalBayar } from '../components/ModalBayar.js';
import { ModalStruk } from '../components/ModalStruk.js';
import { ModalDetailOrder } from '../components/ModalDetailOrder.js';
import { useOrderAktif } from '../hooks/useOrder.js';

const jam = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export default function HalamanOrderAktif() {
  const { data: order, isLoading, error } = useOrderAktif();
  const [detail, setDetail] = useState<string | null>(null);
  const [bayar, setBayar] = useState<Order | null>(null);
  const [struk, setStruk] = useState<string | null>(null);

  const belumBayar = order?.filter((o) => o.paymentStatus === 'belum_bayar').length ?? 0;
  const perluDilayani = order?.filter((o) => STATUS_AKTIF_DAPUR.includes(o.status)).length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Order Aktif</h1>
        <p className="text-sm text-[var(--color-muted)] tabular-nums">
          {perluDilayani} diproses · {belumBayar} belum bayar
        </p>
      </div>

      {isLoading && <Skeleton />}
      {error && <p className="mt-6 text-sm text-red-700">Gagal memuat order. Cek koneksi.</p>}

      {order?.length === 0 && (
        <p className="mt-16 text-center text-sm text-[var(--color-muted)]">
          Belum ada order aktif. Order baru muncul sendiri di sini.
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {order?.map((o) => (
          <li
            key={o.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold tabular-nums">{o.orderCode}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {o.table ? `Meja ${o.table.number}` : 'Takeaway'} · {jam(o.createdAt)}
                  {o.customerName && ` · ${o.customerName}`}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatRupiah(o.total)}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <BadgeStatus status={o.status} />
              <BadgeBayar status={o.paymentStatus} />
            </div>

            <ul className="mt-2 space-y-0.5 text-sm">
              {o.items.slice(0, 3).map((i) => (
                <li key={i.id} className="truncate">
                  <span className="tabular-nums text-[var(--color-muted)]">{i.qty}×</span> {i.nameSnapshot}
                </li>
              ))}
              {o.items.length > 3 && (
                <li className="text-xs text-[var(--color-muted)]">+{o.items.length - 3} item lain</li>
              )}
            </ul>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDetail(o.id)}
                className="flex-1 rounded-lg py-2 text-sm ring-1 ring-inset ring-[var(--color-border)]"
              >
                Detail
              </button>
              {o.paymentStatus === 'belum_bayar' ? (
                <button
                  type="button"
                  onClick={() => setBayar(o)}
                  className="flex-1 rounded-lg bg-[var(--color-accent)] py-2 text-sm font-medium text-white"
                >
                  Bayar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStruk(o.id)}
                  className="flex-1 rounded-lg py-2 text-sm ring-1 ring-inset ring-[var(--color-border)]"
                >
                  Struk
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {detail && (
        <ModalDetailOrder
          orderId={detail}
          onTutup={() => setDetail(null)}
          onBayar={(o) => {
            setDetail(null);
            setBayar(o);
          }}
          onCetak={(id) => {
            setDetail(null);
            setStruk(id);
          }}
        />
      )}

      {bayar && (
        <ModalBayar
          order={bayar}
          onTutup={() => setBayar(null)}
          onLunas={(o) => {
            // Langsung ke struk: alur nyata kasir adalah bayar lalu cetak.
            setBayar(null);
            setStruk(o.id);
          }}
        />
      )}

      {struk && <ModalStruk orderId={struk} onTutup={() => setStruk(null)} />}
    </>
  );
}

function Skeleton() {
  return (
    <ul className="mt-4 grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="h-44 rounded-xl bg-[var(--color-border)]" />
      ))}
    </ul>
  );
}
