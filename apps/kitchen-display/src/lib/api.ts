import type { ApiError, Role, UserPublic } from '@cafe/shared';

const KUNCI_TOKEN = 'cafe-kds-token';
const KUNCI_USER = 'cafe-kds-user';

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

export const ROLE_DAPUR: Role[] = ['dapur', 'kasir', 'admin'];

export class ApiFail extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiFail';
  }
}

/**
 * ponytail: sengaja disalin-tipis dari apps/kasir, bukan dipakai bersama.
 * KDS cuma butuh get + patch (tanpa upload/blob), jadi ~50 baris ini lebih
 * murah daripada paket baru. Kalau app keempat butuh fetch ber-auth, pindahkan
 * ke `packages/client`.
 */
const req = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = ambilToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiFail('NETWORK', 'Tidak dapat terhubung ke server.');
  }

  // Dicek `token` dulu: login yang gagal (401 tanpa token) tidak boleh
  // memicu reload, kalau tidak pesan errornya tak pernah terlihat.
  if (res.status === 401 && token) {
    hapusSesi();
    location.assign('/kds/login');
    throw new ApiFail('UNAUTHENTICATED', 'Sesi berakhir, login kembali.', 401);
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const e = (payload as ApiError | null)?.error;
    throw new ApiFail(e?.code ?? 'INTERNAL', e?.message ?? `Gagal (${res.status})`, res.status);
  }
  return (payload as { data: T }).data;
};

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body: unknown) =>
    req<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    req<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
