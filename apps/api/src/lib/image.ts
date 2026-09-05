import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { env } from '../env.js';
import { AppError } from './errors.js';

const MIME_DIIZINKAN = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAKS_BYTE = 5 * 1024 * 1024;

/**
 * Simpan foto menu: resize 800px, konversi webp.
 * Foto langsung dari HP bisa 5MB — tanpa resize, menu pelanggan jadi berat di 4G.
 */
export const simpanGambarMenu = async (
  buffer: Buffer,
  mimetype: string,
  menuItemId: string,
): Promise<string> => {
  if (!MIME_DIIZINKAN.has(mimetype)) {
    throw new AppError('VALIDATION_FAILED', 400, 'Format harus JPEG, PNG, atau WebP', {
      file: 'format tidak didukung',
    });
  }
  if (buffer.byteLength > MAKS_BYTE) {
    throw new AppError('VALIDATION_FAILED', 400, 'Ukuran maksimum 5MB', { file: 'terlalu besar' });
  }

  const dir = join(env.UPLOAD_DIR, 'menu');
  await mkdir(dir, { recursive: true });

  // sharp memvalidasi isi file, bukan cuma mime yang dikirim klien.
  const hasil = await sharp(buffer)
    .rotate()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  await writeFile(join(dir, `${menuItemId}.webp`), hasil);
  // Cache-buster: nama file tetap sama saat foto diganti.
  return `/uploads/menu/${menuItemId}.webp?v=${Date.now()}`;
};
