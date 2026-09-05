import { z } from 'zod';

/** Validasi env sekali di boot. Fail-fast: mati sekarang lebih baik daripada error misterius nanti. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET minimal 32 karakter. Generate: openssl rand -hex 32'),
  UPLOAD_DIR: z.string().default('./uploads'),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Konfigurasi env tidak valid:\n${detail}\n\nSalin .env.example ke .env lalu isi.`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
