import { prisma } from '../../db/client.js';
import { newId } from '../../lib/id.js';

export const settingsRepository = {
  async ambil(outletId: string) {
    const s = await prisma.settings.findUnique({ where: { outletId } });
    if (s) return s;
    // Outlet selalu punya settings; buat default kalau hilang (mis. seed dilewati).
    return prisma.settings.create({ data: { id: newId(), outletId } });
  },

  ubah: (
    outletId: string,
    data: {
      taxPercent?: number;
      servicePercent?: number;
      receiptFooter?: string;
      currencySymbol?: string;
      autoConfirmOrder?: boolean;
    },
  ) => prisma.settings.update({ where: { outletId }, data }),

  outlet: (outletId: string) => prisma.outlet.findUnique({ where: { id: outletId } }),
};
