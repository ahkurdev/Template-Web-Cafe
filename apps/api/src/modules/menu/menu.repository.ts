import { prisma } from '../../db/client.js';

const itemPublik = {
  id: true,
  categoryId: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  isAvailable: true,
  isActive: true,
  sortOrder: true,
} as const;

export const menuRepository = {
  /** Menu pelanggan: kategori aktif + item aktif (termasuk yang habis, ditandai di UI). */
  katalog: (outletId: string) =>
    prisma.category.findMany({
      where: { outletId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        isActive: true,
        items: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: itemPublik,
        },
      },
    }),

  daftarKategori: (outletId: string) =>
    prisma.category.findMany({
      where: { outletId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),

  findKategoriBySlug: (outletId: string, slug: string) =>
    prisma.category.findUnique({ where: { outletId_slug: { outletId, slug } } }),

  findKategori: (id: string) => prisma.category.findUnique({ where: { id } }),

  buatKategori: (data: {
    id: string;
    outletId: string;
    name: string;
    slug: string;
    sortOrder: number;
  }) => prisma.category.create({ data }),

  ubahKategori: (
    id: string,
    data: { name?: string; slug?: string; sortOrder?: number; isActive?: boolean },
  ) => prisma.category.update({ where: { id }, data }),

  countItemAktif: (categoryId: string) =>
    prisma.menuItem.count({ where: { categoryId, isActive: true } }),

  daftarItem: (
    outletId: string,
    filter: { categoryId?: string; q?: string; isAvailable?: boolean },
  ) =>
    prisma.menuItem.findMany({
      where: {
        outletId,
        isActive: true,
        ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
        ...(filter.isAvailable === undefined ? {} : { isAvailable: filter.isAvailable }),
        ...(filter.q ? { name: { contains: filter.q } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: itemPublik,
    }),

  findItem: (id: string) => prisma.menuItem.findUnique({ where: { id }, select: itemPublik }),

  findItemDiOutlet: (outletId: string, id: string) =>
    prisma.menuItem.findFirst({ where: { id, outletId }, select: itemPublik }),

  /** Untuk checkout: ambil harga & ketersediaan dari DB, bukan dari klien. */
  findItemsUntukOrder: (outletId: string, ids: readonly string[]) =>
    prisma.menuItem.findMany({
      where: { id: { in: [...ids] }, outletId, isActive: true },
      select: { id: true, name: true, price: true, isAvailable: true },
    }),

  buatItem: (data: {
    id: string;
    outletId: string;
    categoryId: string;
    name: string;
    description?: string | null;
    price: number;
    sortOrder: number;
  }) => prisma.menuItem.create({ data, select: itemPublik }),

  ubahItem: (
    id: string,
    data: {
      categoryId?: string;
      name?: string;
      description?: string | null;
      price?: number;
      sortOrder?: number;
      isAvailable?: boolean;
      isActive?: boolean;
      imageUrl?: string;
    },
  ) => prisma.menuItem.update({ where: { id }, data, select: itemPublik }),
};
