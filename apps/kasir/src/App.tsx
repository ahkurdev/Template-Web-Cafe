import { useQuery } from '@tanstack/react-query';

interface Health {
  status: string;
  db: string;
  uptime: number;
}

/** Placeholder Fase 1. Login + order aktif menyusul di Fase 4. */
export default function App() {
  const { data, error } = useQuery<Health>({
    queryKey: ['health'],
    queryFn: async () => {
      const r = await fetch('/api/health');
      if (!r.ok) throw new Error('gagal');
      return r.json() as Promise<Health>;
    },
  });

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Kasir / POS</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Fase 1 — fondasi</p>
      <p className="mt-6 text-sm">
        Backend:{' '}
        {error ? (
          <span className="text-red-700">tidak terjangkau</span>
        ) : (
          <span>
            {data?.status ?? '…'} · db {data?.db ?? '…'}
          </span>
        )}
      </p>
    </main>
  );
}
