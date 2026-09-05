import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { UserPublic } from '@cafe/shared';
import { api, ApiFail, simpanSesi } from '../lib/api.js';
import { resetSocket } from '../lib/socket.js';

export default function HalamanLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api.post<{ token: string; user: UserPublic }>('/auth/login', { username, password }),
    onSuccess: ({ token, user }) => {
      simpanSesi(token, user);
      // Handshake socket membawa token: koneksi lama tidak punya room staff.
      resetSocket();
      nav('/', { replace: true });
    },
  });

  const pesanGagal =
    login.error instanceof ApiFail ? login.error.message : login.error ? 'Gagal masuk' : null;

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate();
        }}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <h1 className="text-xl font-semibold">Masuk Kasir</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Gunakan akun staff cafe.</p>

        {pesanGagal && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200">
            {pesanGagal}
          </p>
        )}

        <label className="mt-4 block">
          <span className="text-sm font-medium">Username</span>
          <input
            type="text"
            required
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2.5 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2.5 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-5 w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
        >
          {login.isPending ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
