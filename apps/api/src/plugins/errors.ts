import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { isProd } from '../env.js';

/** Satu-satunya tempat error diubah jadi response. Route tidak perlu try/catch. */
export const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const i of err.issues) fields[i.path.join('.') || '_'] = i.message;
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION_FAILED', message: 'Data tidak valid', fields } });
    }

    if (err instanceof AppError) {
      return reply
        .code(err.statusCode)
        .send({ error: { code: err.code, message: err.message, fields: err.fields } });
    }

    // Rate limit dari @fastify/rate-limit
    if (err.statusCode === 429) {
      return reply
        .code(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Coba lagi sebentar.' } });
    }

    if (err.statusCode === 401) {
      return reply
        .code(401)
        .send({ error: { code: 'UNAUTHENTICATED', message: 'Silakan login kembali' } });
    }

    if (err.statusCode && err.statusCode < 500) {
      return reply
        .code(err.statusCode)
        .send({ error: { code: 'VALIDATION_FAILED', message: err.message } });
    }

    // Detail hanya ke log, tidak ke klien.
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({
      error: {
        code: 'INTERNAL',
        message: isProd ? 'Terjadi kesalahan pada server' : err.message,
      },
    });
  });

  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Rute ${req.method} ${req.url} tidak ada` },
    }),
  );
};
