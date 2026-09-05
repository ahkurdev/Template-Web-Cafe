import { prisma } from '../../db/client.js';
import type { TableStatus } from '@cafe/shared';

export const tableRepository = {
  daftar: (outletId: string) =>
    prisma.cafeTable.findMany({
      where: { outletId, isActive: true },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        capacity: true,
        location: true,
        status: true,
        isActive: true,
      },
    }),

  find: (id: string) => prisma.cafeTable.findUnique({ where: { id } }),

  findDiOutlet: (outletId: string, id: string) =>
    prisma.cafeTable.findFirst({ where: { id, outletId } }),

  findByNumber: (outletId: string, number: string) =>
    prisma.cafeTable.findUnique({ where: { outletId_number: { outletId, number } } }),

  /** qrToken -> meja. Hanya meja aktif; token meja nonaktif dianggap tidak ada. */
  findByQrToken: (qrToken: string) =>
    prisma.cafeTable.findFirst({
      where: { qrToken, isActive: true },
      select: { id: true, number: true, location: true, outletId: true },
    }),

  buat: (data: {
    id: string;
    outletId: string;
    number: string;
    capacity?: number | null;
    location?: string | null;
    qrToken: string;
  }) => prisma.cafeTable.create({ data }),

  ubah: (
    id: string,
    data: {
      number?: string;
      capacity?: number | null;
      location?: string | null;
      status?: TableStatus;
      isActive?: boolean;
      qrToken?: string;
    },
  ) => prisma.cafeTable.update({ where: { id }, data }),
};
