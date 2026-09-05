import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { formatRupiah, type Order } from '@cafe/shared';
import { api, ApiFail } from '../lib/api.js';
import { ambilQrToken, KUNCI_ORDER_TERAKHIR, useMeja } from '../hooks/useMenu.js';
import { subtotalKeranjang, useKeranjang } from '../store/keranjang.js';

export default function HalamanKeranjang() {
  const nav = useNavigate();
  const { data: meja } = useMeja();
  const { baris, ubahQty, setNote, hapus, hapusBanyak, kosongkan } = useKeranjang();
  const [nama, setNama] = useState('');
  const [catatan, setCatatan] = useState('');
  const [gagal, setGagal] = useState<{ pesan: string; itemHabis?: string[] } | null>(null);

  const subtotal = subtotalKeranjang(baris);
  const qrToken = ambilQrToken();

  const checkout = useMutation({
    mutationFn: () =>
      api.post<Order>('/orders', {
        qrToken,
        customerName: nama.trim() || undefined,
        note: catatan.trim() || undefined,
        items: baris.map((b) => ({ menuItemId: b.menuItemId, qty: b.qty, note: b.note })),
      }),
    onSuccess: (order) => {
      sessionStorage.setItem(KUNCI_ORDER_TERAKHIR, order.orderCode);
      kosongkan();
      nav(`/status/${order.orderCode}`, { replace: true });
    },
    onError: (e) => {
      if (e instanceof ApiFail && e.code === 'ITEM_UNAVAILABLE') {
        // Sebut item mana yang habis dan buang dari keranjang — jangan cuma "gagal".
        const habis = (e.fields?.['items'] ?? '').split(', ').filter(Boolean);
        hapusBanyak(habis);
        setGagal({ pesan: 'Item berikut baru saja habis dan sudah dihapus:', itemHabis: habis });
        return;
      }
      setGagal({ pesan: e instanceof ApiFail ? e.message : 'Gagal mengirim pesanan' });
    },
  });

  if (baris.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-medium">Keranjang kosong</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Pilih menu dulu.</p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center rounded-lg bg-[var(--color-accent)] px-5 font-medium text-white"
        >
          Lihat Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link to="/" aria-label="Kembali ke menu" className="flex items-center text-xl">
            ←
          </Link>
          <h1 className="font-semibold">Pesanan Anda</h1>
          {meja && (
            <span className="ml-auto rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs ring-1 ring-inset ring-[var(--color-border)]">
              Meja {meja.number}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {gagal && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200"
          >
            <p className="font-medium">{gagal.pesan}</p>
            {gagal.itemHabis && <p className="mt-1">{gagal.itemHabis.join(', ')}</p>}
          </div>
        )}

        <ul className="space-y-2">
          {baris.map((b) => (
            <li
              key={`${b.menuItemId}|${b.note ?? ''}`}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium leading-tight">{b.name}</h2>
                  <p className="mt-0.5 text-sm text-[var(--color-muted)] tabular-nums">
                    {formatRupiah(b.price)} × {b.qty} = {formatRupiah(b.price * b.qty)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Kurangi ${b.name}`}
                    onClick={() => ubahQty(b.menuItemId, b.note, -1)}
                    className="size-11 rounded-lg ring-1 ring-inset ring-[var(--color-border)]"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-medium tabular-nums">{b.qty}</span>
                  <button
                    type="button"
                    aria-label={`Tambah ${b.name}`}
                    onClick={() => ubahQty(b.menuItemId, b.note, 1)}
                    className="size-11 rounded-lg ring-1 ring-inset ring-[var(--color-border)]"
                  >
                    +
                  </button>
                </div>
              </div>

              <input
                type="text"
                defaultValue={b.note ?? ''}
                onBlur={(e) => setNote(b.menuItemId, b.note, e.target.value)}
                placeholder="Catatan (mis. tanpa gula)"
                maxLength={200}
                aria-label={`Catatan untuk ${b.name}`}
                className="mt-2 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--color-border)]"
              />

              <button
                type="button"
                onClick={() => hapus(b.menuItemId, b.note)}
                className="mt-1 text-xs text-[var(--color-muted)] underline"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <label className="block">
            <span className="text-sm font-medium">Nama (opsional)</span>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={80}
              placeholder="Untuk dipanggil saat siap"
              className="mt-1 w-full rounded-lg bg-[var(--color-surface)] px-3 py-2.5 ring-1 ring-inset ring-[var(--color-border)]"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Catatan pesanan (opsional)</span>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-lg bg-[var(--color-surface)] px-3 py-2.5 ring-1 ring-inset ring-[var(--color-border)]"
            />
          </label>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-lg p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[var(--color-muted)]">Subtotal</span>
            <span className="font-semibold tabular-nums">{formatRupiah(subtotal)}</span>
          </div>
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Total akhir dihitung kasir (pajak/servis bila ada).
          </p>
          <button
            type="button"
            disabled={checkout.isPending || !qrToken}
            onClick={() => {
              setGagal(null);
              checkout.mutate();
            }}
            className="w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
          >
            {checkout.isPending ? 'Mengirim…' : !qrToken ? 'Scan QR meja dulu' : 'Kirim Pesanan'}
          </button>
        </div>
      </div>
    </div>
  );
}
