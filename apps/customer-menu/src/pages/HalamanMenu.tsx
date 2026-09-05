import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeja, useMenu, KUNCI_ORDER_TERAKHIR } from '../hooks/useMenu.js';
import { KartuMenu } from '../components/KartuMenu.js';
import { BarKeranjang } from '../components/BarKeranjang.js';

export default function HalamanMenu() {
  const { data: kategori, isLoading, error } = useMenu();
  const { data: meja, error: errMeja } = useMeja();
  const [aktif, setAktif] = useState<string | null>(null);
  const refKategori = useRef<Record<string, HTMLElement | null>>({});
  const orderTerakhir = sessionStorage.getItem(KUNCI_ORDER_TERAKHIR);

  // Tandai kategori yang sedang terlihat di viewport.
  useEffect(() => {
    if (!kategori?.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const tampil = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (tampil[0]?.target.id) setAktif(tampil[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px' },
    );
    for (const el of Object.values(refKategori.current)) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [kategori]);

  if (isLoading) return <SkeletonMenu />;

  if (error) {
    return (
      <Pesan judul="Menu tidak dapat dimuat">
        Cek koneksi Anda, lalu muat ulang halaman.
      </Pesan>
    );
  }

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-lg font-semibold">Kopi Senja</h1>
            {meja ? (
              <span className="shrink-0 rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-medium ring-1 ring-inset ring-[var(--color-border)]">
                Meja {meja.number}
              </span>
            ) : errMeja ? (
              <span className="shrink-0 text-xs text-[var(--color-muted)]">Takeaway</span>
            ) : null}
          </div>

          {kategori && kategori.length > 1 && (
            <nav aria-label="Kategori" className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              {kategori.map((k) => (
                <a
                  key={k.id}
                  href={`#${k.slug}`}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                    aktif === k.slug
                      ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                      : 'bg-[var(--color-surface)] ring-1 ring-inset ring-[var(--color-border)]'
                  }`}
                >
                  {k.name}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      {errMeja && (
        <div className="mx-auto mt-3 max-w-lg px-4">
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            QR meja tidak berlaku. Anda masih bisa melihat menu, tapi pesanan harus lewat kasir.
          </p>
        </div>
      )}

      {orderTerakhir && (
        <div className="mx-auto mt-3 max-w-lg px-4">
          <Link
            to={`/status/${orderTerakhir}`}
            className="flex items-center justify-between rounded-lg bg-[var(--color-surface)] p-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
          >
            <span>
              Lihat pesanan Anda · <strong>{orderTerakhir}</strong>
            </span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      <main className="mx-auto max-w-lg px-4">
        {kategori?.map((k) => (
          <section
            key={k.id}
            id={k.slug}
            ref={(el) => {
              refKategori.current[k.slug] = el;
            }}
            className="scroll-mt-32 pt-5"
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {k.name}
            </h2>
            <ul className="space-y-2">
              {k.items.map((i) => (
                <KartuMenu key={i.id} item={i} />
              ))}
            </ul>
          </section>
        ))}

        {kategori?.length === 0 && (
          <Pesan judul="Menu belum tersedia">Silakan tanya ke kasir.</Pesan>
        )}
      </main>

      <BarKeranjang punyaMeja={Boolean(meja)} />
    </div>
  );
}

function SkeletonMenu() {
  return (
    <div className="mx-auto max-w-lg animate-pulse space-y-2 px-4 pt-6">
      <div className="mb-4 h-6 w-32 rounded bg-[var(--color-border)]" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-[var(--color-border)]" />
      ))}
    </div>
  );
}

function Pesan({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h2 className="font-medium">{judul}</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{children}</p>
    </div>
  );
}
