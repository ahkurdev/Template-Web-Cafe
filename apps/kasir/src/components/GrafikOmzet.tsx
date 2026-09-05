import { formatRupiah } from '@cafe/shared';
import type { TitikOmzet } from '../hooks/useLaporan.js';

/**
 * Grafik batang SVG. Tanpa recharts: pustaka chart menambah ~100KB gzip ke
 * bundle kasir untuk satu halaman, sementara yang dibutuhkan cuma batang +
 * label. Kalau nanti perlu tooltip interaktif, garis, dan zoom, baru pasang.
 */
const W = 640;
const H = 200;
const PAD_KIRI = 8;
const PAD_BAWAH = 22;

export function GrafikOmzet({ data }: { data: TitikOmzet[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-muted)]">
        Belum ada order lunas di rentang ini.
      </p>
    );
  }

  const maks = Math.max(...data.map((d) => d.omzet), 1);
  const lebarSlot = (W - PAD_KIRI * 2) / data.length;
  const lebarBatang = Math.max(2, Math.min(48, lebarSlot * 0.65));
  const tinggiPlot = H - PAD_BAWAH;
  // Label sumbu-X dijarangkan supaya tidak tumpang tindih di rentang panjang.
  const tiapLabel = Math.ceil(data.length / 12);

  return (
    <figure>
      <figcaption className="sr-only">
        Grafik omzet per periode. Tertinggi {formatRupiah(maks)}.
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-52 w-full"
        role="img"
        aria-label={`Omzet ${data.length} periode, tertinggi ${formatRupiah(maks)}`}
      >
        <line
          x1={0}
          y1={tinggiPlot}
          x2={W}
          y2={tinggiPlot}
          stroke="var(--color-border)"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const tinggi = Math.round((d.omzet / maks) * (tinggiPlot - 6));
          const x = PAD_KIRI + i * lebarSlot + (lebarSlot - lebarBatang) / 2;
          return (
            <g key={d.periode}>
              <rect
                x={x}
                y={tinggiPlot - tinggi}
                width={lebarBatang}
                height={tinggi}
                rx={2}
                fill="var(--color-accent)"
              >
                <title>{`${d.periode}: ${formatRupiah(d.omzet)} · ${d.jumlah} order`}</title>
              </rect>
              {i % tiapLabel === 0 && (
                <text
                  x={x + lebarBatang / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-muted)"
                >
                  {labelPendek(d.periode)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tabel sebagai sumber angka yang pasti — SVG tidak bisa dibaca screen
          reader per titik, dan pemilik cafe sering butuh angka persisnya. */}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-[var(--color-muted)]">Lihat angka</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted)]">
              <th className="py-1">Periode</th>
              <th className="py-1 text-right">Order</th>
              <th className="py-1 text-right">Omzet</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.periode} className="border-b border-[var(--color-border)]/60">
                <td className="py-1">{d.periode}</td>
                <td className="py-1 text-right tabular-nums">{d.jumlah}</td>
                <td className="py-1 text-right tabular-nums">{formatRupiah(d.omzet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** 2026-09-05 → 05/09 · 2026-09 → Sep 2026 */
const labelPendek = (periode: string): string => {
  const bagian = periode.split('-');
  if (bagian.length === 2) {
    const [y, m] = bagian as [string, string];
    return `${BULAN[Number(m) - 1] ?? m} ${y.slice(2)}`;
  }
  const [, m, d] = bagian as [string, string, string];
  return `${d}/${m}`;
};

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
