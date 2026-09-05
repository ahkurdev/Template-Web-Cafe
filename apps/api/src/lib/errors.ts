import type { ErrorCode } from '@cafe/shared';

/** Error yang aman dikirim ke klien. Selain ini -> 500 dengan pesan generik. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly statusCode: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (apa: string) => new AppError('NOT_FOUND', 404, `${apa} tidak ditemukan`);

export const forbidden = (pesan = 'Tidak berwenang') => new AppError('FORBIDDEN', 403, pesan);

export const unauthenticated = (pesan = 'Silakan login kembali') =>
  new AppError('UNAUTHENTICATED', 401, pesan);

export const conflict = (code: ErrorCode, pesan: string, fields?: Record<string, string>) =>
  new AppError(code, 409, pesan, fields);
