import { prisma } from '../../db/client.js';
import type { Role } from '@cafe/shared';

export const authRepository = {
  findByUsername: (username: string) =>
    prisma.user.findUnique({ where: { username } }),

  findById: (id: string) => prisma.user.findUnique({ where: { id } }),

  list: (outletId: string) =>
    prisma.user.findMany({
      where: { outletId },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    }),

  create: (data: {
    id: string;
    outletId: string;
    username: string;
    passwordHash: string;
    name: string;
    role: Role;
  }) => prisma.user.create({ data }),

  update: (id: string, data: { name?: string; role?: Role; isActive?: boolean }) =>
    prisma.user.update({ where: { id }, data }),

  updatePassword: (id: string, passwordHash: string) =>
    prisma.user.update({ where: { id }, data: { passwordHash } }),

  touchLogin: (id: string) =>
    prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),

  countAdminAktif: (outletId: string) =>
    prisma.user.count({ where: { outletId, role: 'admin', isActive: true } }),
};
