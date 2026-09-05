import { useState } from 'react';
import { ROLES, type Role, type UserPublic } from '@cafe/shared';
import { Modal } from '../components/Modal.js';
import { ambilUser, ApiFail } from '../lib/api.js';
import {
  useBuatPengguna,
  usePengguna,
  useResetPassword,
  useUbahPengguna,
} from '../hooks/useMenu.js';

const LABEL_ROLE: Record<Role, string> = {
  admin: 'Admin',
  kasir: 'Kasir',
  dapur: 'Dapur',
};

const waktu = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'belum pernah';

export default function HalamanPengguna() {
  const { data: pengguna, isLoading } = usePengguna();
  const ubah = useUbahPengguna();
  const [buat, setBuat] = useState(false);
  const [reset, setReset] = useState<UserPublic | null>(null);
  const aku = ambilUser();

  const adminAktif = pengguna?.filter((u) => u.role === 'admin' && u.isActive).length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Pengguna</h1>
        <button
          type="button"
          onClick={() => setBuat(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
        >
          + Pengguna
        </button>
      </div>

      {isLoading && <p className="mt-4 text-sm text-[var(--color-muted)]">Memuat…</p>}

      {ubah.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200">
          {ubah.error instanceof ApiFail ? ubah.error.message : 'Gagal menyimpan perubahan'}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {pengguna?.map((u) => {
          // Server juga menolak, tapi tombolnya dimatikan supaya tidak
          // memancing admin mengunci dirinya sendiri keluar dari cafe.
          const adminTerakhir = u.role === 'admin' && u.isActive && adminAktif <= 1;
          const diriSendiri = u.id === aku?.id;

          return (
            <li
              key={u.id}
              className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ${
                u.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.name}
                    {diriSendiri && <span className="ml-1 text-xs text-[var(--color-muted)]">(Anda)</span>}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {u.username} · login terakhir {waktu(u.lastLoginAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={u.role}
                    disabled={adminTerakhir}
                    onChange={(e) => ubah.mutate({ id: u.id, role: e.target.value as Role })}
                    aria-label={`Role ${u.name}`}
                    className="rounded-lg bg-[var(--color-bg)] px-2 py-2 text-sm ring-1 ring-inset ring-[var(--color-border)] disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {LABEL_ROLE[r]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setReset(u)}
                    className="rounded-lg px-3 text-sm ring-1 ring-inset ring-[var(--color-border)]"
                  >
                    Reset password
                  </button>

                  <button
                    type="button"
                    disabled={adminTerakhir}
                    onClick={() => ubah.mutate({ id: u.id, isActive: !u.isActive })}
                    className={`rounded-lg px-3 text-sm ring-1 ring-inset disabled:opacity-50 ${
                      u.isActive
                        ? 'text-red-700 ring-red-200'
                        : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                    }`}
                  >
                    {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </div>

              {adminTerakhir && (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Admin aktif terakhir — buat admin lain dulu sebelum mengubah akun ini.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {buat && <FormPengguna onTutup={() => setBuat(false)} />}
      {reset && <FormReset user={reset} onTutup={() => setReset(null)} />}
    </>
  );
}

function FormPengguna({ onTutup }: { onTutup: () => void }) {
  const buat = useBuatPengguna();
  const [f, setF] = useState({ username: '', password: '', name: '', role: 'kasir' as Role });

  const valid = f.username.trim().length >= 3 && f.password.length >= 8 && f.name.trim().length > 0;

  return (
    <Modal judul="Pengguna Baru" onTutup={onTutup}>
      <div className="space-y-3">
        <label className="block text-sm">
          Nama
          <input
            type="text"
            autoFocus
            maxLength={120}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
        </label>

        <label className="block text-sm">
          Username
          <input
            type="text"
            autoComplete="off"
            maxLength={50}
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          />
          <span className="text-xs text-[var(--color-muted)]">Minimal 3 karakter, huruf kecil.</span>
        </label>

        <label className="block text-sm">
          Password
          <input
            type="text"
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 font-mono ring-1 ring-inset ring-[var(--color-border)]"
          />
          <span className="text-xs text-[var(--color-muted)]">
            Minimal 8 karakter. Ditampilkan supaya bisa dicatat sekarang — server hanya menyimpan hash.
          </span>
        </label>

        <label className="block text-sm">
          Role
          <select
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value as Role })}
            className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {LABEL_ROLE[r]}
              </option>
            ))}
          </select>
        </label>

        {buat.error && (
          <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-900 ring-1 ring-inset ring-red-200">
            {buat.error instanceof ApiFail ? buat.error.message : 'Gagal membuat pengguna'}
          </p>
        )}

        <button
          type="button"
          disabled={!valid || buat.isPending}
          onClick={() =>
            buat.mutate(
              {
                username: f.username.trim().toLowerCase(),
                password: f.password,
                name: f.name.trim(),
                role: f.role,
              },
              { onSuccess: onTutup },
            )
          }
          className="w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
        >
          {buat.isPending ? 'Menyimpan…' : 'Buat'}
        </button>
      </div>
    </Modal>
  );
}

function FormReset({ user, onTutup }: { user: UserPublic; onTutup: () => void }) {
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [selesai, setSelesai] = useState(false);

  return (
    <Modal judul={`Reset password ${user.name}`} onTutup={onTutup}>
      {selesai ? (
        <>
          <p className="text-sm">
            Password baru untuk <strong>{user.username}</strong>:
          </p>
          <p className="mt-2 rounded-lg bg-[var(--color-bg)] p-3 font-mono text-lg ring-1 ring-inset ring-[var(--color-border)]">
            {password}
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Catat sekarang. Tidak bisa ditampilkan lagi — server hanya menyimpan hash.
          </p>
          <button
            type="button"
            onClick={onTutup}
            className="mt-4 w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white"
          >
            Sudah dicatat
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            Password baru
            <input
              type="text"
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[var(--color-bg)] px-3 py-2 font-mono ring-1 ring-inset ring-[var(--color-border)]"
            />
            <span className="text-xs text-[var(--color-muted)]">Minimal 8 karakter.</span>
          </label>

          <button
            type="button"
            onClick={() => setPassword(acak())}
            className="w-full rounded-lg px-4 py-2 text-sm ring-1 ring-inset ring-[var(--color-border)]"
          >
            Buatkan acak
          </button>

          {reset.error && (
            <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-900 ring-1 ring-inset ring-red-200">
              {reset.error instanceof ApiFail ? reset.error.message : 'Gagal reset password'}
            </p>
          )}

          <button
            type="button"
            disabled={password.length < 8 || reset.isPending}
            onClick={() =>
              reset.mutate({ id: user.id, password }, { onSuccess: () => setSelesai(true) })
            }
            className="w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-white disabled:bg-[var(--color-border)] disabled:text-[var(--color-muted)]"
          >
            {reset.isPending ? 'Menyimpan…' : 'Reset'}
          </button>
        </div>
      )}
    </Modal>
  );
}

/** crypto.getRandomValues, bukan Math.random — ini kredensial. */
const acak = (): string => {
  const abjad = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map((n) => abjad[n % abjad.length]).join('');
};
