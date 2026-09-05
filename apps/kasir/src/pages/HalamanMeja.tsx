import { useEffect, useState } from 'react';
import type { CafeTable } from '@cafe/shared';
import { Modal } from '../components/Modal.js';
import { api, ApiFail } from '../lib/api.js';
import { useHapusMeja, useMeja, useRegenerateQr, useSimpanMeja } from '../hooks/useMenu.js';

export default function HalamanMeja() {
  const { data: meja, isLoading } = useMeja();
  const hapus = useHapusMeja();
  const [form, setForm] = useState<Partial<CafeTable> | null>(null);
  const [qr, setQr] = useState<CafeTable | null>(null);
  const [cetakSemua, setCetakSemua] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Meja & QR</h1>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!meja?.length}
            onClick={() => setCetakSemua(true)}
            className="rounded-lg px-4 text-sm ring-1 ring-inset ring-[var(--color-border)] disabled:text-[var(--color-muted)]"
          >
            Cetak semua QR
          </button>
          <button
            type="button"
            onClick={() => setForm({})}
            className="rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
          >
            + Meja
          </button>
        </div>
      </div>

      {isLoading && <p className="mt-4 text-sm text-[var(--color-muted)]">Memuat…</p>}

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {meja?.map((m) => (
          <li key={m.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-semibold">Meja {m.number}</p>
              <span className="text-xs capitalize text-[var(--color-muted)]">{m.status}</span>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              {m.capacity ? `${m.capacity} kursi` : 'kapasitas —'}
              {m.location && ` · ${m.location}`}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setQr(m)}
                className="rounded-lg px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
              >
                QR
              </button>
              <button
                type="button"
                onClick={() => setForm(m)}
                className="rounded-lg px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
              >
                Ubah
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Hapus meja ${m.number}?`)) hapus.mutate(m.id);
                }}
                className="rounded-lg px-3 text-sm text-red-700"
              >
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>

      {form && <FormMeja awal={form} onTutup={() => setForm(null)} />}
      {qr && <ModalQr meja={qr} onTutup={() => setQr(null)} />}
      {cetakSemua && meja && <LembarQr meja={meja.filter((m) => m.isActive)} onTutup={() => setCetakSemua(false)} />}
    </>
  );
}

function FormMeja({ awal, onTutup }: { awal: Partial<CafeTable>; onTutup: () => void }) {
  const simpan = useSimpanMeja();
  const [f, setF] = useState(awal);

  return (
    <Modal judul={awal.id ? `Ubah Meja ${awal.number}` : 'Meja Baru'} onTutup={onTutup}>
      <div className="space-y-3">
        <label className="block text-sm">
          Nomor / nama meja
          <input
            type="text"
            autoFocus
            maxLength={20}
            value={f.number ?? ''}
            onChange={(e) => setF({ ...f, number: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <label className="block text-sm">
          Kapasitas (opsional)
          <input
            type="number"
            min={1}
            max={50}
            value={f.capacity ?? ''}
            onChange={(e) => setF({ ...f, capacity: Number(e.target.value) || null })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <label className="block text-sm">
          Lokasi (opsional)
          <input
            type="text"
            maxLength={80}
            placeholder="Indoor / teras / lantai 2"
            value={f.location ?? ''}
            onChange={(e) => setF({ ...f, location: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        {simpan.error && (
          <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-900 ring-1 ring-inset ring-red-200">
            {simpan.error instanceof ApiFail ? simpan.error.message : 'Gagal menyimpan'}
          </p>
        )}

        <button
          type="button"
          disabled={!f.number?.trim() || simpan.isPending}
          onClick={() =>
            simpan.mutate(
              {
                id: f.id,
                number: f.number!.trim(),
                capacity: f.capacity ?? undefined,
                location: f.location?.trim() || undefined,
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

/** Ambil QR PNG lewat fetch: `<img src>` tidak bisa mengirim header Authorization. */
const useQrPng = (id: string, versi: number) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let batal = false;

    void api.blobUrl(`/tables/${id}/qr.png?size=512`).then((u) => {
      if (batal) {
        URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setUrl(u);
    });

    return () => {
      batal = true;
      // Object URL menahan blob di memori sampai di-revoke.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, versi]);

  return url;
};

function ModalQr({ meja, onTutup }: { meja: CafeTable; onTutup: () => void }) {
  const regen = useRegenerateQr();
  const [versi, setVersi] = useState(0);
  const url = useQrPng(meja.id, versi);

  return (
    <Modal judul={`QR Meja ${meja.number}`} onTutup={onTutup}>
      <div className="cetak rounded-lg bg-white p-4 text-center text-black">
        {url ? (
          <img src={url} alt={`QR meja ${meja.number}`} className="mx-auto size-64" />
        ) : (
          <div className="mx-auto grid size-64 place-items-center text-sm text-stone-500">Memuat…</div>
        )}
        <p className="mt-2 text-lg font-bold">Meja {meja.number}</p>
        <p className="text-xs">Scan untuk melihat menu & pesan</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white"
        >
          Cetak
        </button>
        <button
          type="button"
          disabled={regen.isPending}
          onClick={() => {
            const yakin = confirm(
              `Regenerate QR meja ${meja.number}?\n\nQR yang sudah tercetak dan tertempel di meja akan LANGSUNG MATI dan harus dicetak ulang.`,
            );
            if (yakin) regen.mutate(meja.id, { onSuccess: () => setVersi((v) => v + 1) });
          }}
          className="rounded-lg px-4 text-sm text-red-700 ring-1 ring-inset ring-red-200 disabled:opacity-50"
        >
          {regen.isPending ? 'Memproses…' : 'Regenerate'}
        </button>
      </div>

      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Regenerate dipakai kalau QR lama bocor/difoto orang. Setelah itu QR lama tidak bisa dipakai memesan.
      </p>
    </Modal>
  );
}

/** Grid QR siap potong. Dicetak dari `@media print` yang sama dengan struk. */
function LembarQr({ meja, onTutup }: { meja: CafeTable[]; onTutup: () => void }) {
  return (
    <Modal judul={`Cetak ${meja.length} QR`} onTutup={onTutup} lebar="max-w-3xl">
      <div className="max-h-[60vh] overflow-y-auto rounded-lg bg-stone-100 p-2">
        <div className="cetak cetak--lembar grid grid-cols-2 gap-3 bg-white p-3 sm:grid-cols-3">
          {meja.map((m) => (
            <KartuQr key={m.id} meja={m} />
          ))}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white"
        >
          Cetak
        </button>
        <button type="button" onClick={onTutup} className="rounded-lg px-4 ring-1 ring-inset ring-[var(--color-border)]">
          Tutup
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Di dialog cetak: ukuran A4, margin Default, aktifkan "Background graphics" bila QR tampak kosong.
      </p>
    </Modal>
  );
}

function KartuQr({ meja }: { meja: CafeTable }) {
  const url = useQrPng(meja.id, 0);
  return (
    <div className="break-inside-avoid rounded border border-dashed border-stone-400 p-2 text-center text-black">
      {url ? (
        <img src={url} alt="" className="mx-auto aspect-square w-full max-w-36" />
      ) : (
        <div className="mx-auto aspect-square w-full max-w-36 bg-stone-100" />
      )}
      <p className="mt-1 font-bold">Meja {meja.number}</p>
      <p className="text-[10px]">Scan untuk pesan</p>
    </div>
  );
}
