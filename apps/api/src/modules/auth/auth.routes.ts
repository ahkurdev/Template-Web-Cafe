import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  changePasswordInput,
  createUserInput,
  loginInput,
  updateUserInput,
} from '@cafe/shared';
import { authService } from './auth.service.js';
import { body, params } from '../../lib/validate.js';
import { forbidden } from '../../lib/errors.js';

const idParam = z.object({ id: z.string().length(21) });

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    '/login',
    {
      preHandler: body(loginInput),
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (req) => {
      const user = await authService.verifikasiLogin(req.body as never);
      const token = app.jwt.sign({ sub: user.id, role: user.role, outletId: user.outletId });
      return { data: { token, user: { ...user, outletId: undefined } } };
    },
  );

  app.get('/me', { preHandler: app.autentikasi }, async (req) => ({
    data: await authService.ambilProfil(req.pengguna!.sub),
  }));

  // JWT stateless: server tidak menyimpan sesi. Klien yang menghapus token.
  app.post('/logout', { preHandler: app.autentikasi }, async () => ({ data: { ok: true } }));

  app.get('/users', { preHandler: app.wajibRole('admin') }, async (req) => ({
    data: await authService.daftar(req.pengguna!.outletId),
  }));

  app.post(
    '/users',
    { preHandler: [app.wajibRole('admin'), body(createUserInput)] },
    async (req, reply) => {
      const user = await authService.buat(req.pengguna!.outletId, req.body as never);
      return reply.code(201).send({ data: user });
    },
  );

  app.patch(
    '/users/:id',
    { preHandler: [app.wajibRole('admin'), params(idParam), body(updateUserInput)] },
    async (req) => ({
      data: await authService.ubah(
        req.pengguna!.outletId,
        (req.params as { id: string }).id,
        req.body as never,
      ),
    }),
  );

  app.patch(
    '/users/:id/password',
    { preHandler: [app.autentikasi, params(idParam), body(changePasswordInput)] },
    async (req) => {
      const target = (req.params as { id: string }).id;
      const aku = req.pengguna!;
      if (aku.role !== 'admin' && aku.sub !== target) {
        throw forbidden('Hanya admin yang boleh mengubah password orang lain');
      }
      await authService.gantiPassword(target, (req.body as { password: string }).password);
      return { data: { ok: true } };
    },
  );
};
