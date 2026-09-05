import { Link } from 'react-router-dom';
import { formatRupiah } from '@cafe/shared';
import { subtotalKeranjang, totalQty, useKeranjang } from '../store/keranjang.js';

/** Bar sticky bawah. Hanya tampil kalau keranjang berisi. */
export function BarKeranjang({ punyaMeja }: { punyaMeja: boolean }) {
  const baris = useKeranjang((s) => s.baris);
  if (baris.length === 0) return null;

  const qty = totalQty(baris);
  const subtotal = subtotalKeranjang(baris);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--color-muted)]">
            {qty} item{punyaMeja ? '' : ' · takeaway'}
          </p>
          <p className="font-semibold tabular-nums">{formatRupiah(subtotal)}</p>
        </div>
        <Link
          to="/keranjang"
          className="flex items-center rounded-lg bg-[var(--color-accent)] px-5 font-medium text-white"
        >
          Lihat Pesanan
        </Link>
      </div>
    </div>
  );
}
