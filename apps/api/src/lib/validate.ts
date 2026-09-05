import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';

/** preHandler validasi. Dipakai: { preHandler: body(schema) } */
export const body =
  <T extends z.ZodTypeAny>(schema: T) =>
  async (req: FastifyRequest): Promise<void> => {
    req.body = schema.parse(req.body);
  };

export const query =
  <T extends z.ZodTypeAny>(schema: T) =>
  async (req: FastifyRequest): Promise<void> => {
    req.query = schema.parse(req.query);
  };

export const params =
  <T extends z.ZodTypeAny>(schema: T) =>
  async (req: FastifyRequest): Promise<void> => {
    req.params = schema.parse(req.params);
  };
