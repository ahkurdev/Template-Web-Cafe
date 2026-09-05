import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Role } from '@cafe/shared';
import { ambilToken, ambilUser, bolehRole, hapusSesi } from '../lib/api.js';
import { pasangReconnect, resetSocket } from '../lib/socket.js';
import { aktifkanBunyi, bunyiAktif } from '../lib/bunyi.js';
import { usePantauOrder } from '../hooks/useOrder.js';

interface Menu {
  ke: string;
  label: string;
  roles: Role[];
}

const MENU: Menu[] = [
  { ke: '/', label: 'Order Aktif', roles: ['kasir', 'admin'] },
  { ke: '/manual', label: 'Kasir Manual', roles: ['kasir', 'admin'] },
  { ke: '/menu', label: 'Menu', roles: ['admin'] },
  { ke: '/meja', label: 'Meja & QR', roles: ['admin'] },
];

export function ButuhLogin({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = ambilUser();
  if (!ambilToken() || !user) return <Navigate to="/login" replace />;
  if (!bolehRole(user, ...roles)) {
    return (
      <p className="p-8 text-center text-sm text-[var(--color-muted)]">
        Role <strong>{user.role}</strong> tidak berwenang membuka halaman ini.
      </p>
    );
  }
  return <>{children}</>;
}

export function Layout() {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const user = ambilUser();
  const [offline, setOffline] = useState(false);
  const [suara, setSuara] = useState(bunyiAktif());
  const [bukaNav, setBukaNav] = useState(false);

  useEffect(() => pasangReconnect(qc, setOffline), [qc]);
  usePantauOrder();

  // Tutup drawer setiap pindah halaman — di tablet drawer menutupi isi.
  useEffect(() => setBukaNav(false), [pathname]);

  if (!ambilToken() || !user) return <Navigate to="/login" replace />;

  const menu = MENU.filter((m) => bolehRole(user, ...m.roles));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setBukaNav((v) => !v)}
          aria-expanded={bukaNav}
          className="rounded-lg px-3 ring-1 ring-inset ring-[var(--color-border)]"
        >
          ☰
        </button>
        <span className="font-semibold">Kasir</span>
        {offline && <IndikatorOffline />}
      </header>

      <nav
        className={`border-[var(--color-border)] bg-[var(--color-surface)] md:sticky md:top-0 md:h-dvh md:border-r ${
          bukaNav ? 'block border-b' : 'hidden md:block'
        }`}
      >
        <div className="hidden px-4 pt-4 md:block">
          <p className="font-semibold">Kasir / POS</p>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {user.name} · {user.role}
          </p>
        </div>

        <ul className="p-2 md:mt-2">
          {menu.map((m) => (
            <li key={m.ke}>
              <Link
                to={m.ke}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${
                  pathname === m.ke
                    ? 'bg-[var(--color-accent)] font-medium text-white'
                    : 'hover:bg-[var(--color-bg)]'
                }`}
              >
                {m.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-t border-[var(--color-border)] p-2">
          {!suara && (
            <button
              type="button"
              onClick={() => {
                // Browser memblokir audio sebelum ada interaksi: hanya bisa
                // diaktifkan dari handler klik seperti ini.
                void aktifkanBunyi().then(() => setSuara(true));
              }}
              className="w-full rounded-lg px-3 text-left text-sm ring-1 ring-inset ring-[var(--color-border)]"
            >
              🔔 Aktifkan suara order
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              hapusSesi();
              resetSocket();
              qc.clear();
              location.assign('/kasir/login');
            }}
            className="mt-1 w-full rounded-lg px-3 text-left text-sm text-red-700"
          >
            Keluar
          </button>
        </div>
      </nav>

      <div className="min-w-0">
        {offline && (
          <p role="status" className="hidden bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900 md:block">
            Koneksi terputus — data mungkin tidak terbaru. Order baru tidak akan muncul sampai tersambung lagi.
          </p>
        )}
        <main className="p-3 md:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const IndikatorOffline = () => (
  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">offline</span>
);
