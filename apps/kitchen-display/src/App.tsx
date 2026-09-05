import { useQuery } from '@tanstack/react-query';

interface Health {
  status: string;
  db: string;
  uptime: number;
}

/** Placeholder Fase 1. Antrian 3 kolom menyusul di Fase 5. */
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
    <main className="p-8">
      <h1 className="text-3xl font-bold">Kitchen Display</h1>
      <p className="mt-1 text-[var(--color-muted)]">Fase 1 — fondasi</p>
      <p className="mt-6">
        Backend:{' '}
        {error ? (
          <span className="text-red-400">tidak terjangkau</span>
        ) : (
          <span>
            {data?.status ?? '…'} · db {data?.db ?? '…'}
          </span>
        )}
      </p>
    </main>
  );
}
