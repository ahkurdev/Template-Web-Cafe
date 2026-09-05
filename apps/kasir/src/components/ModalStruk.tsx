import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './Modal.js';
import { Struk, type DataStruk } from './Struk.js';
import { api } from '../lib/api.js';

/**
 * Preview + cetak struk. Data diambil dari server (bukan dari objek order di
 * layar) supaya nama cafe, footer, dan nama kasir ikut apa yang tersimpan.
 */
export function ModalStruk({ orderId, onTutup }: { orderId: string; onTutup: () => void }) {
  const [lebar58, setLebar58] = useState(false);
  const { data, isLoading, error } = useQuery<DataStruk>({
    queryKey: ['receipt', orderId],
    queryFn: () => api.get<DataStruk>(`/orders/${orderId}/receipt`),
    staleTime: 0,
  });

  // Kembalikan judul dokumen setelah cetak: sebagian browser memakai
  // document.title sebagai nama file saat "Save as PDF".
  useEffect(() => {
    if (!data) return;
    const semula = document.title;
    document.title = `Struk-${data.order.orderCode}`;
    return () => {
      document.title = semula;
    };
  }, [data]);

  return (
    <Modal judul="Struk" onTutup={onTutup}>
      {isLoading && <p className="py-6 text-center text-sm text-[var(--color-muted)]">Memuat…</p>}
      {error && <p role="alert" className="py-6 text-center text-sm text-red-700">Gagal memuat struk.</p>}

      {data && (
        <>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg bg-stone-100 p-3">
            <Struk data={data} lebar58={lebar58} />
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lebar58}
              onChange={(e) => setLebar58(e.target.checked)}
              className="size-4"
            />
            Printer 58mm (default 80mm)
          </label>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white"
            >
              Cetak
            </button>
            <button
              type="button"
              onClick={onTutup}
              className="rounded-lg px-4 ring-1 ring-inset ring-[var(--color-border)]"
            >
              Tutup
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Di dialog cetak: pilih printer thermal, ukuran kertas {lebar58 ? '58mm' : '80mm'}, margin None.
          </p>
        </>
      )}
    </Modal>
  );
}
