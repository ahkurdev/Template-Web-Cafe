import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatRupiah, hitungTotal, PAYMENT_METHODS, type Order, type PaymentMethod } from '@cafe/shared';
import { api, ApiFail } from '../lib/api.js';
import { useKatalog, useMeja, useSettings } from '../hooks/useMenu.js';
import { subtotalKasir, useKeranjangKasir } from '../store/keranjangKasir.js';
import { ModalStruk } from '../components/ModalStruk.js';

const LABEL: Record<PaymentMethod, string> = { cash: 'Cash', transfer: 'Transfer', qris_manual: 'QRIS' };

export default function HalamanKasirManual() {
  const qc = useQueryClient();
  const { data: katalog, isLoading } = useKatalog();
  const { data: meja } = useMeja();
  const { data: settings } = useSettings();
  const { baris, tambah, ubahQty, setNote, hapus, kosongkan } = useKeranjangKasir();

  const [cari, setCari] = useState('');
  const [tableId, setTableId] = useState('');
  const [nama, setNama] = useState('');
  const [langsungBayar, setLangsungBayar] = useState(true);
  const [metode, setMetode] = useState<PaymentMethod>('cash');
  const [diterima, setDiterima] = useState(0);
  const [struk, setStruk] = useState<string | null>(null);

  const subtotal = subtotalKasir(baris);
  // Total dihitung ulang dengan helper yang sama dengan server. Server tetap
  // sumber kebenaran; ini supaya kasir tidak menekan "Buat & Lunas" dengan uang
  // kurang — order sudah tercatat sebelum pembayaran divalidasi.
  const total = hitungTotal({
    subtotal,
    taxPercent: settings?.taxPercent ?? 0,
    servicePercent: settings?.servicePercent ?? 0,
  }).total;
  const kurang = langsungBayar && metode === 'cash' && diterima < total;

  const hasilCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const semua = katalog?.flatMap((k) => k.items.map((i) => ({ ...i, kategori: k.name }))) ?? [];
    const tersedia = semua.filter((i) => i.isAvailable);
    return q ? tersedia.filter((i) => i.name.toLowerCase().includes(q)) : tersedia;
  }, [katalog, cari]);

  const buat = useMutation({
    mutationFn: () =>
      api.post<Order>('/orders/manual', {
        tableId: tableId || undefined,
        customerName: nama.trim() || undefined,
        items: baris.map((b) => ({ menuItemId: b.menuItemId, qty: b.qty, note: b.note })),
        payNow: langsungBayar,
        ...(langsungBayar
          ? { paymentMethod: metode, ...(metode === 'cash' ? { paidAmount: diterima } : {}) }
          : {}),
      }),
    onSuccess: (order) => {
      kosongkan();
      setNama('');
      setTableId('');
      setDiterima(0);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      setStruk(order.id);
    },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Kasir Manual</h1>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <section>
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari menu…"
            className="w-full rounded-lg bg-[var(--color-surface)] px-3 py-2.5 ring-1 ring-inset ring-[var(--color-border)]"
          />

          {isLoading && <p className="mt-4 text-sm text-[var(--color-muted)]">Memuat menu…</p>}

          {hasilCari.length === 0 && !isLoading && (
            <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
              Tidak ada menu tersedia yang cocok.
            </p>
          )}

          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {hasilCari.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => tambah({ menuItemId: i.id, name: i.name, price: i.price })}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left hover:border-[var(--color-accent)]"
                >
                  <p className="text-xs text-[var(--color-muted)]">{i.kategori}</p>
                  <p className="font-medium leading-tight">{i.name}</p>
                  <p className="mt-1 text-sm tabular-nums">{formatRupiah(i.price)}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h2 className="font-semibold">Pesanan</h2>

          {baris.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">
              Pilih menu di sebelah kiri.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--color-border)]">
              {baris.map((b) => (
                <li key={b.menuItemId} className="py-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{b.name}</p>
                      <p className="text-xs text-[var(--color-muted)] tabular-nums">
                        {formatRupiah(b.price)} × {b.qty} = {formatRupiah(b.price * b.qty)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Kurangi ${b.name}`}
                        onClick={() => ubahQty(b.menuItemId, -1)}
                        className="size-9 rounded-lg ring-1 ring-inset ring-[var(--color-border)]"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{b.qty}</span>
                      <button
                        type="button"
                        aria-label={`Tambah ${b.name}`}
                        onClick={() => ubahQty(b.menuItemId, 1)}
                        className="size-9 rounded-lg ring-1 ring-inset ring-[var(--color-border)]"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={`Hapus ${b.name}`}
                        onClick={() => hapus(b.menuItemId)}
                        className="size-9 rounded-lg text-[var(--color-muted)]"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    defaultValue={b.note ?? ''}
                    onBlur={(e) => setNote(b.menuItemId, e.target.value)}
                    placeholder="Catatan"
                    maxLength={200}
                    aria-label={`Catatan ${b.name}`}
                    className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-2 py-1.5 text-xs ring-1 ring-inset ring-[var(--color-border)]"
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
            <label className="block text-sm">
              Meja (opsional)
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-2 py-2 ring-1 ring-inset ring-[var(--color-border)]"
              >
                <option value="">Takeaway / tanpa meja</option>
                {meja
                  ?.filter((m) => m.isActive)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      Meja {m.number}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-sm">
              Nama pelanggan (opsional)
              <input
                type="text"
                value={nama}
                maxLength={80}
                onChange={(e) => setNama(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-2 py-2 ring-1 ring-inset ring-[var(--color-border)]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={langsungBayar}
                onChange={(e) => setLangsungBayar(e.target.checked)}
                className="size-4"
              />
              Langsung lunas
            </label>

            {langsungBayar && (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetode(m)}
                      aria-pressed={metode === m}
                      className={`rounded-lg py-2 text-sm ring-1 ring-inset ${
                        metode === m
                          ? 'bg-[var(--color-accent)] text-white ring-transparent'
                          : 'bg-[var(--color-bg)] ring-[var(--color-border)]'
                      }`}
                    >
                      {LABEL[m]}
                    </button>
                  ))}
                </div>

                {metode === 'cash' && (
                  <label className="block text-sm">
                    Uang diterima
                    <div className="mt-1 flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        step={500}
                        inputMode="numeric"
                        value={diterima || ''}
                        onChange={(e) => setDiterima(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                        className="w-full rounded-lg bg-[var(--color-bg)] px-2 py-2 text-right tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
                      />
                      <button
                        type="button"
                        onClick={() => setDiterima(total)}
                        className="shrink-0 rounded-lg px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
                      >
                        Pas
                      </button>
                    </div>
                  </label>
                )}
              </>
            )}

            <div className="space-y-1 border-t border-[var(--color-border)] pt-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[var(--color-muted)]">Subtotal</span>
                <span className="tabular-nums">{formatRupiah(subtotal)}</span>
              </div>
              {total !== subtotal && (
                <div className="flex items-baseline justify-between text-xs text-[var(--color-muted)]">
                  <span>
                    Pajak {settings?.taxPercent ?? 0}% + servis {settings?.servicePercent ?? 0}%
                  </span>
                  <span className="tabular-nums">{formatRupiah(total - subtotal)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-semibold tabular-nums">{formatRupiah(total)}</span>
              </div>
            </div>
            {kurang && (
              <p className="text-xs text-red-700">Uang kurang {formatRupiah(total - diterima)}.</p>
            )}

            {buat.error && (
              <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-900 ring-1 ring-inset ring-red-200">
                {buat.error instanceof ApiFail ? buat.error.message : 'Gagal membuat order'}
              </p>
            )}

            <button
              type="button"
              disabled={baris.length === 0 || buat.isPending || kurang}
              onClick={() => buat.mutate()}
              className="w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
            >
              {buat.isPending ? 'Menyimpan…' : langsungBayar ? 'Buat & Lunas' : 'Buat Order'}
            </button>
          </div>
        </aside>
      </div>

      {struk && <ModalStruk orderId={struk} onTutup={() => setStruk(null)} />}
    </>
  );
}
