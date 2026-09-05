import type { CafeTable, TableResolved, TableStatus } from '@cafe/shared';
import { tableRepository } from './table.repository.js';
import { newId, newQrToken } from '../../lib/id.js';
import { conflict, notFound } from '../../lib/errors.js';

export const tableService = {
  daftar: (outletId: string): Promise<CafeTable[]> =>
    tableRepository.daftar(outletId) as Promise<CafeTable[]>,

  /**
   * Publik. Tidak mengembalikan qrToken — token cukup dikirim sekali lewat QR,
   * tidak perlu dibalikkan ke klien.
   */
  async resolveQr(qrToken: string): Promise<TableResolved & { outletId: string }> {
    const meja = await tableRepository.findByQrToken(qrToken);
    if (!meja) throw notFound('QR meja');
    return meja;
  },

  async buat(
    outletId: string,
    input: { number: string; capacity?: number; location?: string },
  ) {
    if (await tableRepository.findByNumber(outletId, input.number)) {
      throw conflict('VALIDATION_FAILED', `Meja ${input.number} sudah ada`, { number: 'sudah ada' });
    }
    return tableRepository.buat({
      id: newId(),
      outletId,
      number: input.number,
      capacity: input.capacity ?? null,
      location: input.location ?? null,
      qrToken: newQrToken(),
    });
  },

  async ubah(
    outletId: string,
    id: string,
    data: {
      number?: string;
      capacity?: number;
      location?: string;
      status?: TableStatus;
      isActive?: boolean;
    },
  ) {
    const meja = await tableRepository.findDiOutlet(outletId, id);
    if (!meja) throw notFound('Meja');

    if (data.number && data.number !== meja.number) {
      const bentrok = await tableRepository.findByNumber(outletId, data.number);
      if (bentrok) throw conflict('VALIDATION_FAILED', `Meja ${data.number} sudah ada`, { number: 'sudah ada' });
    }
    return tableRepository.ubah(id, data);
  },

  /** Token baru: QR lama langsung mati. Dipakai kalau stiker dicuri/difoto & disebar. */
  async regenerateQr(outletId: string, id: string) {
    const meja = await tableRepository.findDiOutlet(outletId, id);
    if (!meja) throw notFound('Meja');
    return tableRepository.ubah(id, { qrToken: newQrToken() });
  },

  async ambilQrToken(outletId: string, id: string): Promise<string> {
    const meja = await tableRepository.findDiOutlet(outletId, id);
    if (!meja) throw notFound('Meja');
    return meja.qrToken;
  },

  async hapus(outletId: string, id: string) {
    const meja = await tableRepository.findDiOutlet(outletId, id);
    if (!meja) throw notFound('Meja');
    return tableRepository.ubah(id, { isActive: false });
  },

  setStatus: (id: string, status: TableStatus) => tableRepository.ubah(id, { status }),
};
