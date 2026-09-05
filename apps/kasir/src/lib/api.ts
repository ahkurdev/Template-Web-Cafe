import type { ApiError, Role, UserPublic } from '@cafe/shared';

const KUNCI_TOKEN = 'cafe-kasir-token';
const KUNCI_USER = 'cafe-kasir-user';

export const ambilToken = (): string | null => localStorage.getItem(KUNCI_TOKEN);

export const ambilUser = (): UserPublic | null => {
  const v = localStorage.getItem(KUNCI_USER);
  if (!v) return null;
  try {
    return JSON.parse(v) as UserPublic;
  } catch {
    return null;
  }
};

export const simpanSesi = (token: string, user: UserPublic): void => {
  localStorage.setItem(KUNCI_TOKEN, token);
  localStorage.setItem(KUNCI_USER, JSON.stringify(user));
};

export const hapusSesi = (): void => {
  localStorage.removeItem(KUNCI_TOKEN);
  localStorage.removeItem(KUNCI_USER);
};

export const bolehRole = (user: UserPublic | null, ...roles: Role[]): boolean =>
  user !== null && roles.includes(user.role);

/** Error API yang membawa `code` supaya UI bisa bereaksi spesifik. */
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
  const token = ambilToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : init?.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiFail('NETWORK', 'Tidak dapat terhubung ke server.');
  }

  if (res.status === 401 && token) {
    // Token kedaluwarsa di tengah shift. Buang sesi lalu paksa ke login —
    // dicek `token` dulu supaya login gagal (401 tanpa token) tidak ikut reload.
    hapusSesi();
    location.assign('/kasir/login');
    throw new ApiFail('UNAUTHENTICATED', 'Sesi berakhir, silakan login kembali.', undefined, 401);
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const e = (payload as ApiError | null)?.error;
    throw new ApiFail(e?.code ?? 'INTERNAL', e?.message ?? `Gagal (${res.status})`, e?.fields, res.status);
  }
  return (payload as { data: T }).data;
};

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    req<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => req<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => req<T>(path, { method: 'POST', body: form }),

  /**
   * Ambil biner (QR PNG) sebagai object URL. `<img src>` tidak bisa mengirim
   * header Authorization, jadi endpoint QR harus di-fetch dulu.
   */
  async blobUrl(path: string): Promise<string> {
    const res = await fetch(`/api${path}`, {
      headers: { authorization: `Bearer ${ambilToken() ?? ''}` },
    });
    if (!res.ok) throw new ApiFail('INTERNAL', `Gagal memuat ${path}`);
    return URL.createObjectURL(await res.blob());
  },
};
