import type { ApiError } from '@cafe/shared';

/** Error API yang membawa `code` supaya UI bisa bereaksi spesifik (mis. ITEM_UNAVAILABLE). */
export class ApiFail extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiFail';
  }
}

const req = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    // Jaringan mati / server tidak terjangkau. Bedakan dari error API
    // supaya UI bisa bilang "koneksi terputus", bukan "terjadi kesalahan".
    throw new ApiFail('NETWORK', 'Tidak dapat terhubung. Cek koneksi Anda.');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const e = (payload as ApiError | null)?.error;
    throw new ApiFail(
      e?.code ?? 'INTERNAL',
      e?.message ?? `Gagal (${res.status})`,
      e?.fields,
      res.status,
    );
  }
  return (payload as { data: T }).data;
};

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body: unknown) =>
    req<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};
