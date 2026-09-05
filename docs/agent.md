# Instruksi Agent — Sistem Cafe (WebCafe)

Dibaca AI agent sebelum menyentuh repo ini. Dokumen perencanaan: [prd.md](./prd.md) · [arsitektur.md](./arsitektur.md) · [database.md](./database.md) · [api.md](./api.md) · [roadmap.md](./roadmap.md)

## Konteks

Sistem operasional cafe open source, self-hosted, **tanpa Docker**. Satu backend Fastify + tiga frontend React (customer-menu publik, kasir, kitchen-display). SQLite + Drizzle. Target VPS 1 vCPU / 1GB RAM.

## Perintah

```bash
pnpm install          # pasang dependensi (pnpm, jangan npm/yarn)
pnpm dev              # api :3000 · customer :5173 · kasir :5174 · kds :5175
pnpm build            # WAJIB lulus sebelum lapor selesai
pnpm test             # WAJIB lulus sebelum lapor selesai
pnpm typecheck        # tsc --noEmit di semua paket

pnpm db:generate      # drizzle-kit generate
pnpm db:migrate       # drizzle-kit migrate (apply SQL terversi)
pnpm db:studio        # GUI :5555
pnpm db:seed          # data awal (idempoten)
```

## Aturan repo

- Package manager **pnpm**. Jangan campur lockfile.
- Jangan tambah dependensi untuk yang bisa < 50 baris. Cek yang sudah terpasang dulu.
- Ikut style kode sekitar. Jangan reformat file yang tidak disentuh.
- Uang: `Int` rupiah penuh. Semua aritmetika lewat `@cafe/shared/money`. **Dilarang** `parseFloat`/`Decimal` di jalur uang.
- Harga order diambil dari DB, **tidak pernah** dari body request klien.
- Validasi Zod di semua boundary. Skema di `packages/shared/src/schemas.ts`, bukan di-inline per route.
- Emit event Socket.io **setelah** transaksi commit, tidak di dalamnya.
- Realtime pakai Socket.io. **Dilarang** polling `setInterval`.
- `any` dilarang di kode baru.
- Batas lapisan module: `routes` → `service` → `repository`. Routes tidak boleh memanggil repository. Repository tidak emit socket, tidak throw error HTTP. Module lain masuk hanya lewat `service`.
- Secret hanya di `.env`. Jangan hardcode, jangan echo nilainya.
- Jangan commit kecuali diminta. Jangan push ke `main`.

## Dilarang keras

- `Dockerfile`, `docker-compose.yml`, `.dockerignore`, atau instruksi container apa pun.
- `drizzle-kit push` tanpa generate di produksi (tidak terversi). Pakai `drizzle-kit migrate` yang apply file SQL di drizzle/.
- `drizzle-kit push` selain coba-coba lokal.
- `instances > 1` di PM2 tanpa adapter Redis Socket.io.

## Sebelum bilang "selesai"

1. `pnpm typecheck` bersih
2. `pnpm build` lulus
3. `pnpm test` lulus
4. Docs di `docs/` diperbarui kalau perilaku berubah

## Jebakan diketahui

- `base` Vite (`/kasir/`, `/kds/`) harus cocok dengan `basename` React Router dan `handle` Caddyfile. Kalau tidak, aset 404 di produksi.
- `trustProxy: true` wajib di Fastify. Tanpa itu, di belakang Caddy semua request terlihat dari `127.0.0.1` dan satu pelanggan menghabiskan kuota rate limit semua orang.
- Drizzle client singleton (`db/client.ts`) dengan `better-sqlite3` WAL. Tanpa itu `tsx watch` bikin handle ganda.
- Constraint `CHECK` ada di `schema.ts` via `check()` — jangan hilang saat regenerate.
- Klien wajib `invalidateQueries()` saat socket `connect`. Tanpa itu, tablet dapur yang WiFi-nya drop kehilangan order.
- SQLite + Drizzle di 1GB RAM butuh swap 2GB + tuning `my.cnf`. Bukan opsional.
