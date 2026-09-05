import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@cafe/shared';
import { env } from '../env.js';
import { forbidden, unauthenticated } from '../lib/errors.js';

export interface TokenPayload {
  sub: string;
  role: Role;
  outletId: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: wajib login. */
    autentikasi: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler: wajib login + salah satu role. */
    wajibRole: (
      ...roles: Role[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    pengguna?: TokenPayload;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '8h' },
  });

  app.decorate('autentikasi', async (req: FastifyRequest) => {
    try {
      req.pengguna = await req.jwtVerify<TokenPayload>();
    } catch {
      throw unauthenticated();
    }
  });

  app.decorate(
    'wajibRole',
    (...roles: Role[]) =>
      async (req: FastifyRequest) => {
        try {
          req.pengguna = await req.jwtVerify<TokenPayload>();
        } catch {
          throw unauthenticated();
        }
        if (!roles.includes(req.pengguna.role)) {
          throw forbidden('Role Anda tidak berwenang untuk aksi ini');
        }
      },
  );
});
