import { useState } from 'react';
import { formatRupiah, TRANSISI_SAH, type Order, type OrderStatus } from '@cafe/shared';
import { Modal } from './Modal.js';
import { BadgeBayar, BadgeStatus } from './Badge.js';
import { ApiFail } from '../lib/api.js';
import { useBatalkan, useOrderDetail, useUbahStatus } from '../hooks/useOrder.js';

const jam = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

interface Props {
  orderId: string;
  onTutup: () => void;
  onBayar: (order: Order) => void;
  onCetak: (orderId: string) => void;
}

export function ModalDetailOrder({ orderId, onTutup, onBayar, onCetak }: Props) {
  const { data: o, isLoading } = useOrderDetail(orderId);
  const ubahStatus = useUbahStatus();
  const batalkan = useBatalkan();
  const [alasan, setAlasan] = useState('');
  const [modeBatal, setModeBatal] = useState(false);

  const gagal = ubahStatus.error ?? batalkan.error;

  return (
    <Modal judul={o ? `Order ${o.orderCode}` : 'Order'} onTutup={onTutup} lebar="max-w-lg">
      {isLoading && <p className="py-8 text-center text-sm text-[var(--color-muted)]">Memuat…</p>}

      {o && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeStatus status={o.status} />
            <BadgeBayar status={o.paymentStatus} />
            <span className="text-sm text-[var(--color-muted)]">
              {o.table ? `Meja ${o.table.number}` : 'Takeaway'} · {jam(o.createdAt)}
            </span>
          </div>

          {o.customerName && <p className="mt-2 text-sm">Nama: {o.customerName}</p>}
          {o.note && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              Catatan: {o.note}
            </p>
          )}

          <ul className="mt-3 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p>
                    <span className="font-medium tabular-nums">{i.qty}×</span> {i.nameSnapshot}
                  </p>
                  {i.note && <p className="text-xs italic text-amber-800">* {i.note}</p>}
                </div>
                <span className="shrink-0 tabular-nums">{formatRupiah(i.subtotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1 text-sm tabular-nums">
            <Baris k="Subtotal" v={formatRupiah(o.subtotal)} />
            {o.taxAmount > 0 && <Baris k="Pajak" v={formatRupiah(o.taxAmount)} />}
            {o.serviceAmount > 0 && <Baris k="Servis" v={formatRupiah(o.serviceAmount)} />}
            {o.discountAmount > 0 && <Baris k="Diskon" v={`-${formatRupiah(o.discountAmount)}`} />}
            <div className="flex justify-between border-t border-[var(--color-border)] pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatRupiah(o.total)}</dd>
            </div>
            {o.paidAmount !== null && (
              <>
                <Baris k="Diterima" v={formatRupiah(o.paidAmount)} />
                <Baris k="Kembalian" v={formatRupiah(o.changeAmount ?? 0)} />
              </>
            )}
          </dl>

          {gagal && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200">
              {gagal instanceof ApiFail ? gagal.message : 'Aksi gagal'}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {TRANSISI_SAH[o.status]
              .filter((s) => s !== 'dibatalkan')
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={ubahStatus.isPending}
                  onClick={() => ubahStatus.mutate({ id: o.id, status: s })}
                  className="rounded-lg bg-[var(--color-fg)] px-4 text-sm font-medium capitalize text-[var(--color-bg)] disabled:opacity-50"
                >
                  → {s}
                </button>
              ))}

            {o.paymentStatus === 'belum_bayar' && o.status !== 'dibatalkan' && (
              <button
                type="button"
                onClick={() => onBayar(o)}
                className="rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
              >
                Bayar
              </button>
            )}

            <button
              type="button"
              onClick={() => onCetak(o.id)}
              className="rounded-lg px-4 text-sm ring-1 ring-inset ring-[var(--color-border)]"
            >
              Struk
            </button>

            {o.status !== 'dibatalkan' && o.paymentStatus !== 'lunas' && !modeBatal && (
              <button
                type="button"
                onClick={() => setModeBatal(true)}
                className="rounded-lg px-4 text-sm text-red-700 ring-1 ring-inset ring-red-200"
              >
                Batalkan
              </button>
            )}
          </div>

          {modeBatal && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 ring-1 ring-inset ring-red-200">
              <label className="block text-sm font-medium text-red-900">
                Alasan pembatalan (wajib)
                <input
                  type="text"
                  autoFocus
                  value={alasan}
                  maxLength={200}
                  onChange={(e) => setAlasan(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-red-200"
                />
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!alasan.trim() || batalkan.isPending}
                  onClick={() =>
                    batalkan.mutate({ id: o.id, reason: alasan.trim() }, { onSuccess: onTutup })
                  }
                  className="rounded-lg bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {batalkan.isPending ? 'Membatalkan…' : 'Konfirmasi batal'}
                </button>
                <button
                  type="button"
                  onClick={() => setModeBatal(false)}
                  className="rounded-lg px-4 text-sm ring-1 ring-inset ring-[var(--color-border)]"
                >
                  Jangan
                </button>
              </div>
            </div>
          )}

          {o.events.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-[var(--color-muted)]">Riwayat status</summary>
              <ol className="mt-2 space-y-1">
                {o.events.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="tabular-nums text-[var(--color-muted)]">{jam(e.createdAt)}</span>
                    <span className="capitalize">{e.status}</span>
                    {e.actorName && <span className="text-[var(--color-muted)]">· {e.actorName}</span>}
                    {e.note && <span className="italic text-[var(--color-muted)]">· {e.note}</span>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </Modal>
  );
}

const Baris = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between">
    <dt className="text-[var(--color-muted)]">{k}</dt>
    <dd>{v}</dd>
  </div>
);
