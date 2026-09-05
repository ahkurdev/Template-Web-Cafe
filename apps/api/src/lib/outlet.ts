/**
 * MVP satu outlet. Rute publik (menu, resolve QR, checkout) tidak punya JWT,
 * jadi outlet-nya diambil dari sini. Fase 2 multi-outlet: resolve dari
 * host/subdomain atau dari qrToken meja.
 */
export const OUTLET_DEFAULT = 'outlet-default-000000';
