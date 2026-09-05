# WebCafe

Sistem operasional cafe: **satu backend, tiga frontend**. Open source, self-hosted, **tanpa Docker**. Dirancang jalan di VPS 1 vCPU / 1GB RAM.

| Aplikasi | Akses | Untuk |
|---|---|---|
| **Customer Menu** | publik, `/` | pelanggan scan QR di meja → pesan tanpa login, tanpa install |
| **Kasir / POS** | login, `/kasir` | input manual, tandai lunas, cetak struk, kelola menu & meja |
| **Kitchen Display** | login, `/kds` | antrian dapur real-time, FIFO, timer per order |

Realtime lewat WebSocket (Socket.io) — **bukan** polling. Harga disimpan sebagai integer rupiah, tanpa float.

## Status

Repo ini masih dibangun bertahap. Yang sudah jalan dan terverifikasi:

- ✅ **Fondasi** — monorepo pnpm, `@cafe/shared`, Prisma schema + migrasi + seed
- ✅ **Backend core** — 7 module (auth, menu, order, kitchen, table, report, settings), Socket.io, 26 test lulus
- ✅ **Customer Menu** — resolve QR, katalog + badge Habis realtime, keranjang, checkout, halaman status. Bundle 117KB gzip
- ✅ **Kasir** — login + guard role, order aktif realtime + bunyi, detail + timeline, pembayaran & kembalian, kasir manual, struk 58/80mm, CRUD menu + foto + toggle habis, CRUD meja + cetak QR. Bundle 123KB gzip
- 🚧 **Kitchen Display** — belum diimplementasi (scaffold saja)
- 🚧 **Laporan, manajemen user, pengaturan (UI)** — API sudah ada, halaman belum

33 test lulus (14 api + 12 shared + 7 kasir). Cetak struk baru diuji lewat print preview, belum ke printer thermal fisik.

Urutan kerja & *definition of done* per fase: [docs/roadmap.md](./docs/roadmap.md).

## Fitur

**Menu digital** — kategori berurut, foto (auto-resize ke `.webp`), toggle habis/tersedia yang efeknya muncul real-time di semua app terbuka.

**Order pelanggan** — scan QR → meja terdeteksi dari token. Keranjang dengan catatan per item. Checkout tanpa akun. **Total dihitung server**, harga diambil dari DB, tidak pernah dari body request. Item yang jadi habis di tengah checkout → 409 beserta nama itemnya.

**Tracking status** — `baru` → `dikonfirmasi` → `diproses` → `selesai` → `diambil` (plus `dibatalkan`). Pelanggan lihat perubahan tanpa refresh; halaman status bisa dibuka ulang lewat kode order.

**Kasir** — order manual walk-in/takeaway, daftar order aktif live, pembayaran `cash` (hitung kembalian) / `transfer` / `qris_manual`, cetak struk via `window.print()` + CSS `@media print` (thermal 58/80mm).

**Meja & QR** — CRUD meja, generate QR per meja (PNG/SVG siap cetak), regenerate token (QR lama langsung mati).

**Laporan** — omzet per rentang tanggal, menu terlaris, rincian per metode bayar, export CSV.

Fase 2 (belum): stok bahan, multi-outlet (`outletId` sudah disiapkan di semua tabel operasional), QRIS otomatis via webhook.

## Stack

| Lapisan | Pilihan | Alasan singkat |
|---|---|---|
| Runtime | Node.js 22 LTS | `sharp` matang, PM2 first-class |
| HTTP | Fastify 5 | ~2× throughput Express, plugin resmi lengkap |
| Realtime | Socket.io 4 | room bawaan, auto-reconnect, fallback untuk HP/proxy jelek |
| ORM | Prisma 6 | migrasi terversi, tipe di-generate |
| Database | MariaDB 11 (InnoDB, `utf8mb4`) | tooling melimpah, backup & replikasi matang |
| Frontend | React 19 + Vite + TypeScript + Tailwind 4 | tiga app terpisah, stack identik |
| Validasi | Zod di semua boundary | satu skema dipakai server & klien |
| Auth | `@fastify/jwt` + `argon2id` | stateless, tanpa Redis |
| Deploy | PM2 + Caddy | native, TLS otomatis, tanpa container |

Monolith modular — bukan microservices. Tiap module backend punya `routes` / `service` / `repository` terpisah, dan module lain hanya boleh masuk lewat `service`.

## Struktur

```
apps/
  api/                 # Fastify — satu-satunya proses Node
    prisma/            # schema.prisma + migrations (di-commit)
    src/modules/       # auth · menu · order · kitchen · table · report · settings
  customer-menu/       # publik  → /
  kasir/               # staff   → /kasir
  kitchen-display/     # staff   → /kds
packages/
  shared/              # @cafe/shared — skema Zod, tipe, money.ts, events.ts
docs/                  # prd · arsitektur · database · api · roadmap · agent
```

`apps/*` boleh pakai `packages/*`. Sebaliknya tidak. Antar `apps/*` tidak boleh saling impor — kontrak lintas app hanya lewat `@cafe/shared`.

## Jalan di lokal

Butuh **Node ≥ 22**, **pnpm 11**, dan **MariaDB 11** hidup di `localhost:3306`.

```bash
# 1. Database
mysql -u root -proot -e "CREATE DATABASE webcafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Konfigurasi
cp .env.example .env
# lalu isi JWT_SECRET di .env:  openssl rand -hex 32

# 3. Dependensi + skema + data awal
pnpm install
pnpm db:migrate
pnpm db:seed          # buat user admin — passwordnya dicetak sekali ke stdout

# 4. Jalan
pnpm dev
```

| Alamat | App |
|---|---|
| http://localhost:5173 | Customer Menu |
| http://localhost:5174 | Kasir |
| http://localhost:5175 | Kitchen Display |
| http://localhost:3000/api/health | API — balas `{"status":"ok","db":"ok","uptime":N}` |

Vite mem-proxy `/api`, `/uploads`, dan `/socket.io` ke `:3000`, jadi tidak ada urusan CORS baik di dev maupun produksi.

### Perintah

```bash
pnpm dev          # semua app paralel
pnpm build        # build shared → api → 3 frontend
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit di semua paket

pnpm db:migrate   # dev  — prisma migrate dev (bikin file migrasi baru)
pnpm db:deploy    # prod — prisma migrate deploy (tanpa prompt, tanpa reset)
pnpm db:studio    # GUI Prisma Studio :5555
pnpm db:seed      # data awal, idempoten
```

> **Jangan** `pnpm db:migrate` di produksi. `migrate dev` bisa menawarkan reset database saat mendeteksi drift — di server itu berarti seluruh data order hilang. Pakai `pnpm db:deploy`.

## Deploy ke VPS

Ringkasnya: swap 2GB dulu, tuning `my.cnf`, `pnpm build`, `pm2 start`, Caddy sebagai TLS + router. Langkah lengkap beserta alasan tiap angka ada di [docs/arsitektur.md](./docs/arsitektur.md#deployment-tanpa-docker) — termasuk file `my.cnf`, `ecosystem.config.cjs`, `Caddyfile`, prosedur update, dan backup.

Yang wajib diingat:

- **Swap 2GB sebelum apa pun.** MariaDB di 1GB RAM tanpa swap rawan OOM-kill.
- **`build-essential` wajib.** Tanpa Docker, `sharp` dikompilasi di mesin itu.
- **User DB non-root** + `bind-address = 127.0.0.1`. `root:root` di `.env.example` hanya untuk dev lokal.
- **`instances: 1` di PM2.** Socket.io multi-proses butuh adapter Redis; tanpa itu order baru cuma sampai ke klien yang kebetulan terhubung ke proses yang sama.
- **`trustProxy: true` di Fastify** (sudah diset). Tanpa itu, di belakang Caddy semua request terlihat dari `127.0.0.1` dan satu pelanggan menghabiskan kuota rate limit semua orang.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [prd.md](./docs/prd.md) | masalah, target user, fitur MVP vs nice-to-have, NFR, batasan, metrik |
| [arsitektur.md](./docs/arsitektur.md) | prinsip, diagram, tech stack + alasan, alur realtime, deployment |
| [database.md](./docs/database.md) | tabel, kolom, relasi, index, catatan portabilitas |
| [api.md](./docs/api.md) | endpoint REST per module, event socket + room/payload, format response, rate limit |
| [roadmap.md](./docs/roadmap.md) | fase build berurutan + *definition of done* |
| [agent.md](./docs/agent.md) | aturan repo untuk AI agent yang melanjutkan kerja di sini |

## Kontribusi

Aturan yang ditegakkan di repo ini:

- Package manager **pnpm**. Jangan campur lockfile.
- Uang selalu `Int` rupiah penuh, semua aritmetika lewat `@cafe/shared/money`. `parseFloat`/`Decimal` di jalur uang **dilarang**.
- Validasi Zod di semua boundary, skema di `packages/shared/src/schemas.ts`.
- Emit event Socket.io **setelah** transaksi commit, tidak di dalamnya.
- Batas lapisan: `routes` → `service` → `repository`. Routes tidak memanggil repository.
- `any` dilarang di kode baru.
- Tanpa Docker — `Dockerfile`/`docker-compose.yml` tidak akan di-merge.
- `pnpm typecheck`, `pnpm build`, `pnpm test` harus lulus sebelum PR.

## Lisensi

[MIT](./LICENSE)
