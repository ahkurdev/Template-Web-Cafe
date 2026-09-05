import { useEffect, useState } from 'react';
import type { Settings } from '@cafe/shared';
import { ApiFail } from '../lib/api.js';
import { useSettings, useSimpanSettings } from '../hooks/useMenu.js';

export default function HalamanPengaturan() {
  const { data, isLoading } = useSettings();
  const simpan = useSimpanSettings();
  const [f, setF] = useState<Settings | null>(null);
  const [tersimpan, setTersimpan] = useState(false);

  // Form diisi sekali setelah data tiba; menyalin di setiap render akan
  // menimpa apa yang sedang diketik saat query refetch.
  useEffect(() => {
    if (data && !f) setF(data);
  }, [data, f]);

  if (isLoading || !f) return <p className="text-sm text-[var(--color-muted)]">Memuat…</p>;

  return (
    <>
      <h1 className="text-xl font-semibold">Pengaturan</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Berlaku untuk order baru. Order yang sudah ada tidak dihitung ulang.
      </p>

      <div className="mt-4 max-w-lg space-y-4">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h2 className="font-semibold">Pajak & servis</h2>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-sm">
              Pajak (%)
              <input
                type="number"
                min={0}
                max={100}
                value={f.taxPercent}
                onChange={(e) => setF({ ...f, taxPercent: klemPersen(e.target.value) })}
                className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 text-right tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
              />
            </label>

            <label className="block text-sm">
              Servis (%)
              <input
                type="number"
                min={0}
                max={100}
                value={f.servicePercent}
                onChange={(e) => setF({ ...f, servicePercent: klemPersen(e.target.value) })}
                className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 text-right tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
              />
            </label>
          </div>

          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Persen bulat saja. Dihitung dari subtotal dan dibulatkan sekali di tingkat order, bukan per
            item — kalau tidak, total bisa selisih beberapa rupiah dari jumlah barisnya.
          </p>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h2 className="font-semibold">Struk</h2>

          <label className="mt-2 block text-sm">
            Simbol mata uang
            <input
              type="text"
              maxLength={5}
              value={f.currencySymbol}
              onChange={(e) => setF({ ...f, currencySymbol: e.target.value })}
              className="mt-1 w-24 rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
            />
          </label>

          <label className="mt-3 block text-sm">
            Teks footer struk
            <textarea
              rows={3}
              maxLength={500}
              value={f.receiptFooter ?? ''}
              onChange={(e) => setF({ ...f, receiptFooter: e.target.value })}
              placeholder="Terima kasih atas kunjungan Anda"
              className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
            />
          </label>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <h2 className="font-semibold">Alur order</h2>

          <label className="mt-2 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.autoConfirmOrder}
              onChange={(e) => setF({ ...f, autoConfirmOrder: e.target.checked })}
              className="mt-0.5 size-4"
            />
            <span>
              Konfirmasi order pelanggan otomatis
              <span className="block text-xs text-[var(--color-muted)]">
                Aktif: order langsung masuk kolom Diproses di dapur. Nonaktif: kasir/dapur menekan
                "Terima" dulu. Aktifkan kalau tidak ada yang memantau layar kasir.
              </span>
            </span>
          </label>
        </section>

        {simpan.error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200">
            {simpan.error instanceof ApiFail ? simpan.error.message : 'Gagal menyimpan'}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={simpan.isPending}
            onClick={() =>
              simpan.mutate(
                {
                  taxPercent: f.taxPercent,
                  servicePercent: f.servicePercent,
                  currencySymbol: f.currencySymbol.trim() || 'Rp',
                  receiptFooter: f.receiptFooter?.trim() ?? '',
                  autoConfirmOrder: f.autoConfirmOrder,
                },
                {
                  onSuccess: () => {
                    setTersimpan(true);
                    setTimeout(() => setTersimpan(false), 2500);
                  },
                },
              )
            }
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
          >
            {simpan.isPending ? 'Menyimpan…' : 'Simpan'}
          </button>

          {tersimpan && (
            <span role="status" className="text-sm text-emerald-700">
              Tersimpan.
            </span>
          )}
        </div>

        <p className="text-xs text-[var(--color-muted)]">
          Nama, alamat, dan telepon cafe belum bisa diubah dari sini — masih di tabel <code>outlets</code>,
          diisi saat seed.
        </p>
      </div>
    </>
  );
}

const klemPersen = (v: string): number => Math.min(100, Math.max(0, Math.trunc(Number(v) || 0)));
