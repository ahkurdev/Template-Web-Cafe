import { useState } from 'react';
import { formatRupiah, type Category, type MenuItem } from '@cafe/shared';
import { Modal } from '../components/Modal.js';
import { ApiFail } from '../lib/api.js';
import {
  useHapusItem,
  useHapusKategori,
  useItem,
  useKategori,
  useSimpanItem,
  useSimpanKategori,
  useToggleKetersediaan,
  useUploadFoto,
  type ItemForm,
} from '../hooks/useMenu.js';

export default function HalamanMenu() {
  const { data: kategori } = useKategori();
  const { data: item, isLoading } = useItem();
  const toggle = useToggleKetersediaan();
  const hapusItem = useHapusItem();
  const upload = useUploadFoto();

  const [formItem, setFormItem] = useState<Partial<ItemForm> | null>(null);
  const [kelolaKategori, setKelolaKategori] = useState(false);
  const [filter, setFilter] = useState('');

  const namaKategori = (id: string) => kategori?.find((k) => k.id === id)?.name ?? '—';
  const terlihat = item?.filter((i) => !filter || i.categoryId === filter) ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Menu</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKelolaKategori(true)}
            className="rounded-lg px-4 text-sm ring-1 ring-inset ring-[var(--color-border)]"
          >
            Kategori
          </button>
          <button
            type="button"
            disabled={!kategori?.length}
            onClick={() => setFormItem({ categoryId: kategori?.[0]?.id ?? '', sortOrder: 0 })}
            className="rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
          >
            + Menu
          </button>
        </div>
      </div>

      {!kategori?.length && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          Buat kategori dulu sebelum menambah menu.
        </p>
      )}

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mt-4 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--color-border)]"
      >
        <option value="">Semua kategori</option>
        {kategori?.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>

      {isLoading && <p className="mt-4 text-sm text-[var(--color-muted)]">Memuat…</p>}

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {terlihat.map((i) => (
          <li
            key={i.id}
            className={`flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ${
              i.isAvailable ? '' : 'opacity-70'
            }`}
          >
            {i.imageUrl ? (
              <img src={i.imageUrl} alt="" width={64} height={64} className="size-16 shrink-0 rounded-lg object-cover" />
            ) : (
              <div aria-hidden className="size-16 shrink-0 rounded-lg bg-[var(--color-bg)] ring-1 ring-inset ring-[var(--color-border)]" />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--color-muted)]">{namaKategori(i.categoryId)}</p>
              <p className="truncate font-medium leading-tight">{i.name}</p>
              <p className="text-sm tabular-nums">{formatRupiah(i.price)}</p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {/* Aksi paling sering dipakai saat ramai: paling menonjol. */}
                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: i.id, isAvailable: !i.isAvailable })}
                  aria-pressed={!i.isAvailable}
                  className={`rounded-lg px-3 text-sm font-medium ring-1 ring-inset ${
                    i.isAvailable
                      ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                      : 'bg-red-50 text-red-900 ring-red-200'
                  }`}
                >
                  {i.isAvailable ? 'Tersedia' : 'Habis'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormItem({
                      id: i.id,
                      categoryId: i.categoryId,
                      name: i.name,
                      description: i.description ?? undefined,
                      price: i.price,
                      sortOrder: i.sortOrder,
                    })
                  }
                  className="rounded-lg px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
                >
                  Ubah
                </button>

                <label className="cursor-pointer rounded-lg px-3 py-2 text-sm ring-1 ring-inset ring-[var(--color-border)]">
                  {upload.isPending && upload.variables?.id === i.id ? 'Unggah…' : 'Foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) upload.mutate({ id: i.id, file });
                      e.target.value = '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Hapus "${i.name}" dari menu?`)) hapusItem.mutate(i.id);
                  }}
                  className="rounded-lg px-3 text-sm text-red-700"
                >
                  Hapus
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {upload.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {upload.error instanceof ApiFail ? upload.error.message : 'Gagal mengunggah foto'}
        </p>
      )}

      {formItem && kategori && (
        <FormItem awal={formItem} kategori={kategori} onTutup={() => setFormItem(null)} />
      )}
      {kelolaKategori && <PanelKategori onTutup={() => setKelolaKategori(false)} />}
    </>
  );
}

function FormItem({
  awal,
  kategori,
  onTutup,
}: {
  awal: Partial<ItemForm>;
  kategori: Category[];
  onTutup: () => void;
}) {
  const simpan = useSimpanItem();
  const [f, setF] = useState<Partial<ItemForm>>(awal);

  const valid = Boolean(f.categoryId && f.name?.trim() && typeof f.price === 'number' && f.price >= 0);

  return (
    <Modal judul={awal.id ? 'Ubah Menu' : 'Menu Baru'} onTutup={onTutup}>
      <div className="space-y-3">
        <label className="block text-sm">
          Kategori
          <select
            value={f.categoryId ?? ''}
            onChange={(e) => setF({ ...f, categoryId: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          >
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Nama
          <input
            type="text"
            autoFocus
            maxLength={150}
            value={f.name ?? ''}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <label className="block text-sm">
          Harga (rupiah, tanpa titik)
          <input
            type="number"
            min={0}
            step={500}
            inputMode="numeric"
            value={f.price ?? ''}
            onChange={(e) => setF({ ...f, price: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 text-right tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <label className="block text-sm">
          Deskripsi (opsional)
          <textarea
            rows={2}
            maxLength={1000}
            value={f.description ?? ''}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <label className="block text-sm">
          Urutan
          <input
            type="number"
            min={0}
            max={9999}
            value={f.sortOrder ?? 0}
            onChange={(e) => setF({ ...f, sortOrder: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        {simpan.error && (
          <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-900 ring-1 ring-inset ring-red-200">
            {simpan.error instanceof ApiFail ? simpan.error.message : 'Gagal menyimpan'}
          </p>
        )}

        <button
          type="button"
          disabled={!valid || simpan.isPending}
          onClick={() =>
            simpan.mutate(
              {
                id: f.id,
                categoryId: f.categoryId!,
                name: f.name!.trim(),
                description: f.description?.trim() || undefined,
                price: f.price!,
                sortOrder: f.sortOrder ?? 0,
              },
              { onSuccess: onTutup },
            )
          }
          className="w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
        >
          {simpan.isPending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </Modal>
  );
}

function PanelKategori({ onTutup }: { onTutup: () => void }) {
  const { data: kategori } = useKategori();
  const simpan = useSimpanKategori();
  const hapus = useHapusKategori();
  const [nama, setNama] = useState('');
  const [edit, setEdit] = useState<Category | null>(null);

  const gagal = simpan.error ?? hapus.error;

  return (
    <Modal judul="Kategori" onTutup={onTutup}>
      <ul className="divide-y divide-[var(--color-border)]">
        {kategori?.map((k) => (
          <li key={k.id} className="flex items-center gap-2 py-2">
            {edit?.id === k.id ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg bg-[var(--color-bg)] px-2 py-1.5 text-sm ring-1 ring-inset ring-[var(--color-border)]"
                />
                <button
                  type="button"
                  onClick={() =>
                    simpan.mutate(
                      { id: k.id, name: edit.name.trim(), sortOrder: k.sortOrder },
                      { onSuccess: () => setEdit(null) },
                    )
                  }
                  className="rounded-lg px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
                >
                  Simpan
                </button>
                <button type="button" onClick={() => setEdit(null)} className="px-2 text-sm text-[var(--color-muted)]">
                  Batal
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">{k.name}</span>
                <button type="button" onClick={() => setEdit(k)} className="rounded-lg px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]">
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Hapus kategori "${k.name}"?`)) hapus.mutate(k.id);
                  }}
                  className="px-2 text-sm text-red-700"
                >
                  Hapus
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {gagal && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-900 ring-1 ring-inset ring-red-200">
          {gagal instanceof ApiFail ? gagal.message : 'Aksi gagal'}
        </p>
      )}

      <div className="mt-3 flex gap-2 border-t border-[var(--color-border)] pt-3">
        <input
          type="text"
          value={nama}
          maxLength={80}
          placeholder="Kategori baru"
          onChange={(e) => setNama(e.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--color-border)]"
        />
        <button
          type="button"
          disabled={!nama.trim() || simpan.isPending}
          onClick={() =>
            simpan.mutate(
              { name: nama.trim(), sortOrder: (kategori?.length ?? 0) * 10 },
              { onSuccess: () => setNama('') },
            )
          }
          className="rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
        >
          Tambah
        </button>
      </div>
    </Modal>
  );
}
