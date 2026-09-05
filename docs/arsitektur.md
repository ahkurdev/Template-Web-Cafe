# Arsitektur — Sistem Cafe

**Update**: 2026-09-04
Terkait: [prd.md](./prd.md) · [database.md](./database.md) · [api.md](./api.md) · [roadmap.md](./roadmap.md)

## Prinsip desain

1. **Satu proses backend.** Monolith modular. Semua module dalam satu proses Node — hemat RAM, tanpa network hop, tanpa orkestrasi.
2. **Batas module tegas.** Tiap module: `routes` (HTTP + validasi) → `service` (aturan bisnis) → `repository` (query DB). Lapisan tidak boleh dilompati. Module lain hanya boleh masuk lewat `service`, tidak pernah langsung ke `repository`.
3. **DB penjaga kebenaran.** FK, unique, CHECK hidup di level DB, bukan cuma di kode.
4. **Real-time push, bukan polling.** Setiap perubahan state → emit event Socket.io ke room terkait.
5. **Uang = integer.** Rupiah penuh, tanpa float, tanpa desimal, di mana pun.
6. **Migrasi terversi.** Tiap perubahan schema jadi file migrasi SQL yang di-commit. drizzle-kit yang generate, bukan tulis tangan.
7. **Tanpa Docker.** Artefak deploy = source + `node_modules` + file statis, dijalankan PM2, di-proxy Caddy.
8. **Ringan lebih penting dari lengkap.** Dependensi baru harus dibenarkan; kalau bisa < 50 baris, tulis sendiri.

## Diagram high-level

```
              ┌───────────────────── VPS 1 vCPU / 1GB, tanpa Docker ─────────────────────┐
              │                                                                          │
Pelanggan ───▶│ Caddy :443 ──┬─▶ static  apps/customer-menu/dist      → /                │
(HP, QR)      │              ├─▶ static  apps/kasir/dist              → /kasir           │
Kasir ───────▶│              ├─▶ static  apps/kitchen-display/dist    → /kds             │
(tablet)      │              ├─▶ static  uploads/                     → /uploads         │
Dapur ───────▶│              ├─▶ proxy   /api/*        ────────┐                         │
(layar)       │              └─▶ proxy   /socket.io/*  ────────┤ (upgrade WebSocket)     │
              │                                               ▼                          │
              │                            ┌───────────────────────────────────┐          │
              │                            │  Node 22 + Fastify  :3000  (PM2)  │          │
              │                            │  modules: auth · menu · order     │          │
              │                            │           kitchen · table · report│          │
              │                            │  Socket.io — rooms:               │          │
              │                            │   kitchen · kasir · order:<id>    │          │
              │                            │           · menu                 │          │
              │                            └────────────────┬──────────────────┘          │
              │                                             ▼                             │
              │                     Drizzle ORM ──▶ SQLite data.db (WAL) / PostgreSQL          │
              │                                       db `webcafe` · utf8mb4              │
              └──────────────────────────────────────────────────────────────────────────┘
```

## Tech stack & alasan

### Backend

| Komponen | Pilihan | Alasan | Alternatif ditolak |
|---|---|---|---|
| Runtime | Node.js 22 LTS | dependensi native (`sharp`) matang; PM2 first-class | Bun, Deno |
| HTTP | Fastify 5 | ~2× throughput Express, skema-first, plugin resmi (jwt, cors, static, rate-limit, multipart) | Express (lebih lambat), NestJS (RAM besar) |
| Realtime | Socket.io 4 | punya room bawaan, auto-reconnect, fallback long-polling untuk HP/proxy jelek | `ws` mentah, SSE (satu arah), polling (dilarang) |
| ORM | Drizzle ORM | SQL-like tipis, migrasi drizzle-kit, tanpa engine berat — ideal 1GB RAM | Prisma (engine Rust berat), TypeORM |
| Database | SQLite (default) → PostgreSQL (opsional) | file lokal tanpa proses, WAL mode cepat; schema portable via Drizzle | MariaDB (butuh proses + tuning) |
| Driver | `better-sqlite3` (dev) / `pg` (prod) via Drizzle | driver ringan, sync untuk SQLite | `mysql2` |
| Validasi | Zod 3 | satu sumber tipe + validasi runtime, tipe di-infer ke frontend | `ajv`, `yup` |
| Auth | `@fastify/jwt` + `argon2` | stateless, tanpa Redis; argon2id standar sekarang | session store, bcrypt |
| Upload | `@fastify/multipart` + `sharp` | resize di server, hemat kuota pelanggan | simpan mentah (5MB) |
| Log | `pino` (bawaan Fastify) | JSON, cepat | winston |
| Test | `vitest` | sama dengan frontend, satu config | jest |

### Frontend (tiga app, stack identik)

| Komponen | Pilihan | Alasan |
|---|---|---|
| Framework | React 19 + TypeScript | dikenal luas, kontributor open source mudah masuk |
| Build | Vite 6 | dev instan, output statis murni → cukup di-serve Caddy, tanpa runtime Node |
| Styling | Tailwind 4 | tanpa CSS runtime, purge agresif → bundle kecil |
| Data server | TanStack Query 5 | cache + invalidasi; event socket cukup `invalidateQueries`/`setQueryData` |
| State lokal | Zustand | keranjang + auth saja; Redux berlebihan |
| Router | React Router 7 (mode data) | butuh route bertingkat di kasir |
| Realtime | `socket.io-client` | pasangan server |
| QR | `qrcode` (server, hasilkan PNG/SVG) | cetak dari admin; tanpa lib di klien |

Bukan Next.js: tiga app ini SPA di balik login (kecuali menu publik). SSR tidak memberi nilai, tapi menambah tiga proses Node di VPS 1GB. Statis + Caddy = 0MB RAM per frontend.

### Database

SQLite default (`data.db`, `journal_mode=WAL`, `foreign_keys=ON`), tanpa proses terpisah — ideal untuk VPS 1GB.
Migrasi via `drizzle-kit generate` + `drizzle-kit migrate` → file SQL di `apps/api/drizzle/` yang di-commit.
Untuk produksi yang butuh scale, ganti ke PostgreSQL cukup ubah `DATABASE_URL` (postgres://) + driver `pg` — schema yang sama, tanpa rewrite (tipe integer/text/boolean portable). Detail tabel di [database.md](./database.md).

**Estimasi RSS di VPS 1GB (SQLite):**

| Proses | Perkiraan RSS |
|---|---|
| SQLite (file, tanpa daemon) | ~5MB (di dalam proses Node) |
| Node + Fastify + Drizzle | 90–140MB |
| Caddy | ~20MB |
| Sisa untuk OS + burst | ~800MB |

Jauh lebih lega dari MariaDB. Tanpa tuning `my.cnf`, cukup `PRAGMA journal_mode=WAL`.

## Struktur folder monorepo

```
web-cafe/
├─ pnpm-workspace.yaml        # packages: apps/*, packages/*
├─ package.json               # skrip root, orkestrasi via pnpm -r / -F
├─ tsconfig.base.json         # strict: true, paths ke @cafe/*
├─ ecosystem.config.cjs       # PM2 (hanya backend)
├─ Caddyfile                  # reverse proxy + static
├─ .env.example
├─ uploads/                   # foto menu — gitignored
├─ docs/                      # dokumen ini
│
├─ packages/
│  ├─ shared/                 # @cafe/shared — dipakai backend + 3 frontend
│  │  └─ src/
│  │     ├─ schemas/          # skema Zod (sumber tunggal validasi)
│  │     ├─ types/            # tipe di-infer dari Zod + tipe entitas
│  │     ├─ constants/        # status order, role, metode bayar
│  │     ├─ events.ts         # nama & payload event socket (typed)
│  │     └─ money.ts          # formatRupiah, hitung total (integer)
│  └─ ui/                     # @cafe/ui — komponen React dipakai ≥2 app
│     └─ src/                 # Button, Card, Badge, Spinner, EmptyState
│
├─ apps/
│  ├─ api/                    # @cafe/api — Fastify, satu-satunya proses Node
│  │  ├─ src/
│  │  │  ├─ index.ts          # entry: bangun app, listen
│  │  │  ├─ app.ts            # register plugin & module (bisa di-test)
│  │  │  ├─ env.ts            # baca + validasi env pakai Zod, fail-fast
│  │  │  ├─ db/
│  │  │  │  ├─ client.ts      # singleton Drizzle client (better-sqlite3 / pg)
│  │  │  │  └─ seed.ts        # admin + kategori & menu contoh
│  │  │  ├─ plugins/
│  │  │  │  ├─ auth.ts        # JWT + guard requireRole()
│  │  │  │  ├─ socket.ts      # init Socket.io, room, auth handshake
│  │  │  │  ├─ errors.ts      # error handler → format response standar
│  │  │  │  └─ static.ts      # serve /uploads
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/          # *.routes.ts · *.service.ts · *.repository.ts
│  │  │  │  ├─ menu/          # kategori, item, toggle ketersediaan, upload
│  │  │  │  ├─ order/         # checkout, status, pembayaran
│  │  │  │  ├─ kitchen/       # antrian dapur, transisi status
│  │  │  │  ├─ table/         # meja + QR token
│  │  │  │  └─ report/        # omzet, terlaris, export CSV
│  │  │  └─ lib/              # nanoid, orderCode, csv, image
│  │  └─ drizzle/
│  │     ├─ schema.ts         # sumber tunggal skema DB (Drizzle)
│  │     └─ migrations/       # SQL hasil `drizzle-kit generate` — di-commit
│  │
│  ├─ customer-menu/          # publik  → /        (SPA, tanpa login)
│  ├─ kasir/                  # staff   → /kasir   (login)
│  └─ kitchen-display/        # staff   → /kds     (login)
│     └─ src/                 # pola sama: pages/ components/ hooks/ lib/
```

Aturan dependensi: `apps/*` boleh pakai `packages/*`. `packages/*` **tidak boleh** pakai `apps/*`. Antar `apps/*` tidak boleh saling impor. Kontrak lintas app hanya lewat `@cafe/shared`.

## Anatomi module backend

Tiap module punya tiga lapisan dengan tanggung jawab jelas:

```
modules/order/
  order.routes.ts       # HTTP: parse + validasi Zod → panggil service → bentuk response
  order.service.ts      # aturan bisnis, transaksi, hitung total, emit event
  order.repository.ts   # hanya query Drizzle. Tanpa aturan bisnis, tanpa emit
  order.schema.ts       # Zod khusus module (re-export dari @cafe/shared)
```

Larangan yang dijaga saat review:
- `routes` tidak pernah memanggil `repository` langsung.
- `repository` tidak pernah emit socket, tidak pernah `throw` error HTTP.
- Module lain masuk hanya lewat `service` (mis. `order.service` memanggil `menu.service.getAvailableItems()`, bukan `menu.repository`).
- Emit event **setelah** transaksi commit — bukan di dalam transaksi.

## Alur data real-time — order baru dari checkout sampai dapur

Kasus: pelanggan meja 7 checkout 2 item.

```
1. customer-menu   POST /api/orders   { qr_token, items:[{menu_item_id, qty, note}], customer_name }
                   ↓
2. order.routes    validasi Zod → gagal? 400 VALIDATION_FAILED (stop)
                   ↓
3. order.service   a. table.service.findByQrToken()  → 404 kalau token mati
                   b. menu.service.getItemsForOrder(ids)
                      → ada is_available=false? 409 ITEM_UNAVAILABLE + daftar item (stop)
                   c. harga diambil dari DB, BUKAN dari body klien
                   d. hitung: subtotal per item = price × qty (integer) → total
                   ↓
4. transaksi DB    INSERT orders (status='baru', order_code='A7-0042')
                   INSERT order_items (snapshot nama + harga saat itu)
                   INSERT order_events (status='baru')
                   COMMIT  ← baru setelah ini boleh emit
                   ↓
5. emit socket     io.to('kitchen').emit('order:new',     orderLengkap)
                   io.to('kasir').emit('order:new',       orderLengkap)
                   io.to('order:<id>').emit('order:status', { status:'baru', at })
                   ↓
6. HTTP 201        { data: { id, order_code, total, status, items } }
                   ↓
7a. kitchen-display  terima 'order:new' → queryClient.setQueryData(['queue'], sisipkan)
                     → kartu baru muncul + bunyi + timer mulai. Tanpa refresh.
7b. kasir            terima 'order:new' → order aktif bertambah, badge naik
7c. customer-menu    join room 'order:<id>' → redirect ke /status/<order_code>
```

Lanjutannya (dapur menekan "Proses"):

```
kitchen-display  PATCH /api/kitchen/orders/:id/status { status:'diproses' }
  → kitchen.service: cek transisi sah (baru|dikonfirmasi → diproses), else 409
  → UPDATE orders.status + INSERT order_events
  → emit ke room: 'kitchen' (order:updated) · 'kasir' (order:updated) · 'order:<id>' (order:status)
  → pelanggan lihat "Sedang dibuat" < 1 detik, tanpa polling
```

Toggle menu habis memakai jalur yang sama:
```
kasir/admin  PATCH /api/menu/items/:id/availability { is_available:false }
  → emit io.to('menu').emit('menu:availability', { id, is_available:false })
  → customer-menu (semua HP yang sedang buka) langsung menandai item "Habis"
  → item yang sudah masuk keranjang ditandai; checkout tetap divalidasi ulang di server
```

**Reliabilitas.** Socket dipakai untuk kecepatan, bukan sebagai satu-satunya sumber kebenaran. Setiap app tetap punya `GET` awal; saat `reconnect`, klien refetch (`invalidateQueries`) supaya event yang terlewat saat offline tersusul. Tanpa ini, tablet dapur yang WiFi-nya sempat drop bisa kehilangan order.

### Room socket

| Room | Anggota | Isi |
|---|---|---|
| `kitchen` | app KDS (role `dapur`/`kasir`/`admin`) | `order:new`, `order:updated` |
| `kasir` | app kasir (role `kasir`/`admin`) | `order:new`, `order:updated`, `order:paid` |
| `order:<id>` | pelanggan pemilik order (publik, join pakai `order_code`) | `order:status` |
| `menu` | semua klien termasuk publik | `menu:availability`, `menu:updated` |

Daftar event lengkap beserta payload: [api.md](./api.md).

## Deployment tanpa Docker

Satu proses Node (backend) + SQLite file + tiga folder statis. Caddy jadi TLS + router. Tidak ada container di titik mana pun.

### Prasyarat VPS (Ubuntu 24.04, 1 vCPU / 1GB)

```bash
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3   # build-essential untuk sharp
sudo npm i -g pnpm pm2

sudo apt install -y caddy                            # atau nginx, lihat catatan bawah
```

`build-essential` wajib: tanpa Docker, `sharp` dikompilasi di mesin ini.

### Siapkan database (SQLite — tanpa setup server)

```bash
mkdir -p data && touch data/data.db
# permissions
chmod 600 data/data.db
```

Untuk PostgreSQL (opsional, bila scale):
```sql
CREATE DATABASE webcafe;
CREATE USER webcafe WITH PASSWORD 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON DATABASE webcafe TO webcafe;
```

### Tuning SQLite

Cukup aktifkan WAL di koneksi awal (sudah di `db/client.ts`):

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;
```

WAL membuat read tidak block write — penting saat kasir tulis order bersamaan KDS baca antrian.

### Build & jalan

```bash
git clone <repo> /var/www/web-cafe && cd /var/www/web-cafe
cp .env.example .env && nano .env      # JWT_SECRET, DATABASE_URL, PORT
pnpm install --frozen-lockfile
pnpm build                             # drizzle generate + build packages/* lalu apps/*
pnpm db:migrate                         # drizzle-kit migrate — apply file SQL di drizzle/
pnpm db:seed                           # sekali saja, buat user admin
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

Produksi memakai `drizzle-kit migrate` yang apply file SQL terversi — tanpa reset. Jangan hapus folder `drizzle/` yang sudah di-commit.

`ecosystem.config.cjs` — hanya backend yang perlu proses:

```js
module.exports = {
  apps: [{
    name: 'cafe-api',
    script: 'apps/api/dist/index.js',
    cwd: '/var/www/web-cafe',
    instances: 1,                 // lihat catatan di bawah
    max_memory_restart: '400M',
    env_production: { NODE_ENV: 'production', PORT: 3000 },
    error_file: 'logs/api-err.log',
    out_file: 'logs/api-out.log',
  }],
};
```

`instances: 1` karena Socket.io multi-instance butuh adapter Redis untuk broadcast lintas proses — tanpa itu, order baru hanya sampai ke klien yang kebetulan terhubung ke proses yang sama. SQLite single-file tidak untuk multi-proses write; kalau scale pakai PostgreSQL + `@socket.io/redis-adapter` lalu naikkan `instances`.

### Caddyfile

```
cafe.example.com {
    encode gzip

    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle /socket.io/* {
        reverse_proxy localhost:3000     # Caddy meneruskan upgrade WebSocket otomatis
    }
    handle /uploads/* {
        reverse_proxy localhost:3000     # atau root langsung ke folder uploads
    }

    handle /kasir* {
        root * /var/www/web-cafe/apps/kasir/dist
        try_files {path} /index.html
        file_server
    }
    handle /kds* {
        root * /var/www/web-cafe/apps/kitchen-display/dist
        try_files {path} /index.html
        file_server
    }
    handle {
        root * /var/www/web-cafe/apps/customer-menu/dist
        try_files {path} /index.html
        file_server
    }
}
```

TLS otomatis (Let's Encrypt) tanpa konfigurasi tambahan — alasan utama memilih Caddy di atas Nginx. Pakai Nginx kalau sudah terpasang: butuh blok `location` setara plus `proxy_set_header Upgrade/Connection` untuk `/socket.io/`, dan certbot terpisah.

Untuk `/kasir` dan `/kds`, Vite tiap app di-build dengan `base: '/kasir/'` dan `base: '/kds/'`, dan React Router pakai `basename` yang sama. Kalau lupa, aset 404.

### Update

```bash
cd /var/www/web-cafe && git pull
pnpm install --frozen-lockfile && pnpm build
pnpm db:deploy                      # migrate deploy, aman untuk produksi
pm2 reload cafe-api
```

Frontend statis langsung aktif setelah `build` (tanpa restart). Backend `reload`, bukan `restart`, supaya koneksi selesai lebih rapi.

### Backup

```bash
sqlite3 data/data.db ".backup /backup/webcafe-$(date +%F).db"
tar czf /backup/uploads-$(date +%F).tar.gz uploads/
# atau bila PostgreSQL:
# pg_dump webcafe | gzip > /backup/webcafe-$(date +%F).sql.gz
```

`sqlite3 .backup` membuat snapshot konsisten tanpa lock lama. Pasang di cron harian, dan uji restore-nya sekali sebelum mengandalkannya:

```bash
sqlite3 data_test.db ".restore /backup/webcafe-YYYY-MM-DD.db"
```

### Mode dev lokal

SQLite lokal (tanpa kredensial):

```
DATABASE_URL="file:./data/data.db"
```

```bash
pnpm db:generate    # drizzle-kit generate — bikin file SQL dari perubahan schema
pnpm db:migrate     # drizzle-kit migrate — apply migrasi
pnpm db:studio      # drizzle-studio (opsional)
pnpm dev            # api :3000 · customer :5173 · kasir :5174 · kds :5175
```

Vite proxy `/api` dan `/socket.io` ke `:3000`, jadi tidak ada urusan CORS di dev maupun produksi.

## Non-fungsional yang mengikat kode

| Aspek | Cara ditegakkan |
|---|---|
| Uang | kolom `integer` di Drizzle; helper `@cafe/shared/money`; dilarang `parseFloat` untuk harga |
| Performa read | index sesuai [database.md](./database.md); SQLite file lokal (tanpa network hop) |
| RAM | satu proses Node; `connection_limit=5`; `innodb_buffer_pool_size=128M`; swap 2GB; frontend statis |
| Keamanan | Zod di semua boundary; `argon2id`; JWT 8 jam; rate limit rute publik; upload dibatasi mime + 5MB; DB user non-root + `bind-address=127.0.0.1` |
| Realtime | Socket.io + refetch saat reconnect; `setInterval` polling dilarang |
| Observability | `pino` JSON ke `logs/`; `GET /api/health` cek DB juga (`SELECT 1`) |

## Utang teknis yang diterima sadar

- **Tanpa Redis** → Socket.io single-instance. Naikkan saat butuh > 1 proses.
- **Tanpa refresh token** → JWT 8 jam, kasir login ulang tiap shift. Cukup untuk sekarang.
- **Upload ke disk lokal** → pindah ke S3-compatible kalau multi-outlet.
- **Laporan dihitung on-the-fly** → tambah tabel ringkasan harian kalau data > ~100k order.
- **Tanpa `qris_manual` otomatis** → webhook payment gateway di Fase 2.
- **SQLite di 1GB RAM** → sangat ringan. Jika migrasi ke PostgreSQL, pertimbangkan pool size `max: 5`.

Keputusan yang sulit dibalik (SQLite/Drizzle, monolith modular, tanpa Docker) tercatat di sini; kalau nanti diubah, tulis ADR di `docs/adr/`.
