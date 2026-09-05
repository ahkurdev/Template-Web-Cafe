import type { FastifyInstance } from 'fastify';
import { settingsPatch } from '@cafe/shared';
import { settingsRepository } from './settings.repository.js';
import { body } from '../../lib/validate.js';

export const settingsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/', { preHandler: app.autentikasi }, async (req) => {
    const s = await settingsRepository.ambil(req.pengguna!.outletId);
    return {
      data: {
        taxPercent: s.taxPercent,
        servicePercent: s.servicePercent,
        receiptFooter: s.receiptFooter,
        currencySymbol: s.currencySymbol,
        autoConfirmOrder: s.autoConfirmOrder,
      },
    };
  });

  app.patch('/', { preHandler: [app.wajibRole('admin'), body(settingsPatch)] }, async (req) => {
    await settingsRepository.ambil(req.pengguna!.outletId); // pastikan baris ada
    const s = await settingsRepository.ubah(req.pengguna!.outletId, req.body as never);
    return {
      data: {
        taxPercent: s.taxPercent,
        servicePercent: s.servicePercent,
        receiptFooter: s.receiptFooter,
        currencySymbol: s.currencySymbol,
        autoConfirmOrder: s.autoConfirmOrder,
      },
    };
  });
};
