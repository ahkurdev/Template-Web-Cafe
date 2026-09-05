import argon2 from 'argon2';
import type { CreateUserInput, LoginInput, Role, UserPublic } from '@cafe/shared';
import { authRepository } from './auth.repository.js';
import { newId } from '../../lib/id.js';
import { AppError, conflict, forbidden, notFound, unauthenticated } from '../../lib/errors.js';

const toPublic = (u: {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | null;
}): UserPublic => ({
  id: u.id,
  username: u.username,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
});

const hash = (password: string) => argon2.hash(password, { type: argon2.argon2id });

export const authService = {
  /** Pesan gagal sama untuk user tidak ada & password salah — jangan bocorkan username mana yang terdaftar. */
  async verifikasiLogin(input: LoginInput): Promise<UserPublic & { outletId: string }> {
    const user = await authRepository.findByUsername(input.username);
    const cocok = user ? await argon2.verify(user.passwordHash, input.password) : false;

    if (!user || !cocok) throw unauthenticated('Username atau password salah');
    if (!user.isActive) throw forbidden('Akun dinonaktifkan. Hubungi admin.');

    await authRepository.touchLogin(user.id);
    return { ...toPublic(user), outletId: user.outletId };
  },

  async ambilProfil(id: string): Promise<UserPublic> {
    const user = await authRepository.findById(id);
    if (!user || !user.isActive) throw unauthenticated();
    return toPublic(user);
  },

  daftar: (outletId: string) => authRepository.list(outletId).then((l) => l.map(toPublic)),

  async buat(outletId: string, input: CreateUserInput): Promise<UserPublic> {
    const ada = await authRepository.findByUsername(input.username);
    if (ada) throw conflict('VALIDATION_FAILED', 'Username sudah dipakai', { username: 'sudah dipakai' });

    const user = await authRepository.create({
      id: newId(),
      outletId,
      username: input.username,
      passwordHash: await hash(input.password),
      name: input.name,
      role: input.role,
    });
    return toPublic(user);
  },

  async ubah(
    outletId: string,
    id: string,
    data: { name?: string; role?: Role; isActive?: boolean },
  ): Promise<UserPublic> {
    const user = await authRepository.findById(id);
    if (!user) throw notFound('User');

    // Cegah cafe terkunci: admin aktif terakhir tidak boleh dinonaktifkan atau diturunkan rolenya.
    const menghilangkanAdmin =
      user.role === 'admin' && user.isActive && (data.isActive === false || (data.role && data.role !== 'admin'));
    if (menghilangkanAdmin && (await authRepository.countAdminAktif(outletId)) <= 1) {
      throw new AppError('FORBIDDEN', 403, 'Ini admin aktif terakhir. Buat admin lain dulu.');
    }

    return toPublic(await authRepository.update(id, data));
  },

  async gantiPassword(id: string, password: string): Promise<void> {
    const user = await authRepository.findById(id);
    if (!user) throw notFound('User');
    await authRepository.updatePassword(id, await hash(password));
  },
};
