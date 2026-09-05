/**
 * CSV minimal. Tanpa pustaka: escaping RFC 4180 cukup beberapa baris.
 * BOM UTF-8 wajib supaya Excel Indonesia tidak merusak karakter (é, °, emoji).
 */
const escape = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const keCsv = (header: readonly string[], baris: readonly unknown[][]): string => {
  const isi = [header, ...baris].map((r) => r.map(escape).join(',')).join('\r\n');
  return `﻿${isi}\r\n`;
};

export const namaFileCsv = (dasar: string): string =>
  `${dasar}-${new Date().toISOString().slice(0, 10)}.csv`;
