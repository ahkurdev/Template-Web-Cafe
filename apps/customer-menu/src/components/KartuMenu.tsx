import type { MenuItem } from '@cafe/shared';
import { formatRupiah } from '@cafe/shared';
import { useKeranjang } from '../store/keranjang.js';

interface Props {
  item: MenuItem;
}

export function KartuMenu({ item }: Props) {
  const tambah = useKeranjang((s) => s.tambah);
  const qtyDiKeranjang = useKeranjang((s) =>
    s.baris.filter((b) => b.menuItemId === item.id).reduce((a, b) => a + b.qty, 0),
  );
  const habis = !item.isAvailable;

  return (
    <li
      className={`flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ${
        habis ? 'opacity-60' : ''
      }`}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          width={80}
          height={80}
          className={`size-20 shrink-0 rounded-lg object-cover ${habis ? 'grayscale' : ''}`}
        />
      ) : (
        <div
          aria-hidden
          className="size-20 shrink-0 rounded-lg bg-[var(--color-bg)] ring-1 ring-inset ring-[var(--color-border)]"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-medium leading-tight">{item.name}</h3>
          {habis && (
            <span className="shrink-0 rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)] ring-1 ring-inset ring-[var(--color-border)]">
              Habis
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-muted)]">{item.description}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">{formatRupiah(item.price)}</span>

          <button
            type="button"
            disabled={habis}
            onClick={() => tambah({ menuItemId: item.id, name: item.name, price: item.price })}
            className="rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
          >
            {habis ? 'Kosong' : qtyDiKeranjang > 0 ? `Tambah (${qtyDiKeranjang})` : 'Tambah'}
          </button>
        </div>
      </div>
    </li>
  );
}
