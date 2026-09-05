import type { CategoryWithItems, MenuItem } from '@cafe/shared';
import { menuRepository } from './menu.repository.js';
import { newId, slugify } from '../../lib/id.js';
import { conflict, notFound } from '../../lib/errors.js';

export const menuService = {
  katalog: (outletId: string): Promise<CategoryWithItems[]> =>
    menuRepository.katalog(outletId) as Promise<CategoryWithItems[]>,

  daftarKategori: (outletId: string) => menuRepository.daftarKategori(outletId),

  async buatKategori(outletId: string, input: { name: string; sortOrder: number }) {
    const slug = slugify(input.name);
    if (await menuRepository.findKategoriBySlug(outletId, slug)) {
      throw conflict('VALIDATION_FAILED', 'Kategori dengan nama itu sudah ada', { name: 'sudah ada' });
    }
    return menuRepository.buatKategori({ id: newId(), outletId, slug, ...input });
  },

  async ubahKategori(
    outletId: string,
    id: string,
    data: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const kategori = await menuRepository.findKategori(id);
    if (!kategori || kategori.outletId !== outletId) throw notFound('Kategori');

    const slug = data.name ? slugify(data.name) : undefined;
    if (slug && slug !== kategori.slug) {
      const bentrok = await menuRepository.findKategoriBySlug(outletId, slug);
      if (bentrok) throw conflict('VALIDATION_FAILED', 'Nama kategori sudah dipakai', { name: 'sudah ada' });
    }
    return menuRepository.ubahKategori(id, { ...data, ...(slug ? { slug } : {}) });
  },

  async hapusKategori(outletId: string, id: string) {
    const kategori = await menuRepository.findKategori(id);
    if (!kategori || kategori.outletId !== outletId) throw notFound('Kategori');

    const jumlah = await menuRepository.countItemAktif(id);
    if (jumlah > 0) {
      throw conflict(
        'VALIDATION_FAILED',
        `Kategori masih berisi ${jumlah} menu. Pindahkan atau hapus menunya dulu.`,
      );
    }
    return menuRepository.ubahKategori(id, { isActive: false });
  },

  daftarItem: (
    outletId: string,
    filter: { categoryId?: string; q?: string; isAvailable?: boolean },
  ) => menuRepository.daftarItem(outletId, filter),

  async buatItem(
    outletId: string,
    input: {
      categoryId: string;
      name: string;
      description?: string;
      price: number;
      sortOrder: number;
    },
  ): Promise<MenuItem> {
    const kategori = await menuRepository.findKategori(input.categoryId);
    if (!kategori || kategori.outletId !== outletId) throw notFound('Kategori');
    return menuRepository.buatItem({
      id: newId(),
      outletId,
      ...input,
      description: input.description ?? null,
    });
  },

  async ubahItem(outletId: string, id: string, data: Record<string, unknown>): Promise<MenuItem> {
    await this.pastikanItemMilikOutlet(outletId, id);
    if (typeof data['categoryId'] === 'string') {
      const kategori = await menuRepository.findKategori(data['categoryId']);
      if (!kategori || kategori.outletId !== outletId) throw notFound('Kategori');
    }
    return menuRepository.ubahItem(id, data as never);
  },

  /** Toggle habis/tersedia. Pemanggil yang emit menu:availability setelah ini. */
  async setKetersediaan(outletId: string, id: string, isAvailable: boolean): Promise<MenuItem> {
    await this.pastikanItemMilikOutlet(outletId, id);
    return menuRepository.ubahItem(id, { isAvailable });
  },

  async hapusItem(outletId: string, id: string): Promise<MenuItem> {
    await this.pastikanItemMilikOutlet(outletId, id);
    return menuRepository.ubahItem(id, { isActive: false });
  },

  async setGambar(outletId: string, id: string, imageUrl: string): Promise<MenuItem> {
    await this.pastikanItemMilikOutlet(outletId, id);
    return menuRepository.ubahItem(id, { imageUrl });
  },

  /**
   * Dipakai order.service saat checkout. Mengembalikan harga dari DB
   * dan daftar item yang habis supaya bisa dilaporkan per nama.
   */
  async itemUntukOrder(outletId: string, ids: readonly string[]) {
    const items = await menuRepository.findItemsUntukOrder(outletId, ids);
    const peta = new Map(items.map((i) => [i.id, i]));
    const hilang = ids.filter((id) => !peta.has(id));
    const habis = items.filter((i) => !i.isAvailable).map((i) => i.name);
    return { peta, hilang, habis };
  },

  async pastikanItemMilikOutlet(outletId: string, id: string): Promise<void> {
    const item = await menuRepository.findItemDiOutlet(outletId, id);
    if (!item) throw notFound('Menu');
  },
};
