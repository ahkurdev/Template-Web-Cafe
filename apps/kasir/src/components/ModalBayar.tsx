import { useState } from 'react';
import { formatRupiah, kembalian, PAYMENT_METHODS, type Order, type PaymentMethod } from '@cafe/shared';
import { Modal } from './Modal.js';
import { ApiFail } from '../lib/api.js';
import { useBayar } from '../hooks/useOrder.js';

const LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
  qris_manual: 'QRIS',
};

/** Pecahan yang benar-benar dipegang orang. 1000 & 2000 untuk pas-pasan. */
const CEPAT = [1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000];

interface Props {
  order: Order;
  onTutup: () => void;
  onLunas: (order: Order) => void;
}

export function ModalBayar({ order, onTutup, onLunas }: Props) {
  const [metode, setMetode] = useState<PaymentMethod>('cash');
  const [diterima, setDiterima] = useState(0);
  const bayar = useBayar();

  const kurang = metode === 'cash' && diterima < order.total;
  // kembalian() melempar kalau kurang — jangan panggil sebelum cukup.
  const uangKembali = metode === 'cash' && !kurang ? kembalian(diterima, order.total) : 0;

  const kirim = () => {
    bayar.mutate(
      { id: order.id, paymentMethod: metode, paidAmount: metode === 'cash' ? diterima : undefined },
      { onSuccess: onLunas },
    );
  };

  return (
    <Modal judul={`Bayar ${order.orderCode}`} onTutup={onTutup}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-[var(--color-muted)]">Total</span>
        <span className="text-2xl font-semibold tabular-nums">{formatRupiah(order.total)}</span>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Metode</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetode(m)}
              aria-pressed={metode === m}
              className={`rounded-lg py-2.5 text-sm font-medium ring-1 ring-inset ${
                metode === m
                  ? 'bg-[var(--color-accent)] text-white ring-transparent'
                  : 'bg-[var(--color-bg)] ring-[var(--color-border)]'
              }`}
            >
              {LABEL[m]}
            </button>
          ))}
        </div>
      </fieldset>

      {metode === 'cash' && (
        <div className="mt-4">
          <label className="block">
            <span className="text-sm font-medium">Uang diterima</span>
            <input
              type="number"
              min={0}
              step={500}
              inputMode="numeric"
              value={diterima || ''}
              onChange={(e) => setDiterima(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
              className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2.5 text-right text-lg tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDiterima(order.total)}
              className="rounded-lg bg-[var(--color-bg)] px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
            >
              Pas
            </button>
            {CEPAT.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDiterima((v) => v + n)}
                className="rounded-lg bg-[var(--color-bg)] px-3 text-sm tabular-nums ring-1 ring-inset ring-[var(--color-border)]"
              >
                +{n / 1000}k
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDiterima(0)}
              className="rounded-lg px-3 text-sm text-[var(--color-muted)] underline"
            >
              Reset
            </button>
          </div>

          <div className="mt-3 flex items-baseline justify-between border-t border-[var(--color-border)] pt-3">
            <span className="text-sm font-medium">{kurang ? 'Kurang' : 'Kembalian'}</span>
            <span
              className={`text-xl font-semibold tabular-nums ${kurang ? 'text-red-700' : 'text-emerald-700'}`}
            >
              {formatRupiah(kurang ? order.total - diterima : uangKembali)}
            </span>
          </div>
        </div>
      )}

      {bayar.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200">
          {bayar.error instanceof ApiFail ? bayar.error.message : 'Gagal menyimpan pembayaran'}
        </p>
      )}

      <button
        type="button"
        disabled={bayar.isPending || kurang}
        onClick={kirim}
        className="mt-4 w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
      >
        {bayar.isPending ? 'Menyimpan…' : kurang ? 'Uang belum cukup' : 'Tandai Lunas'}
      </button>
    </Modal>
  );
}
