# Arsitektur — Sistem Cafe

**Update**: 2026-09-04
Terkait: [prd.md](./prd.md) · [database.md](./database.md) · [api.md](./api.md) · [roadmap.md](./roadmap.md)

## Prinsip desain

1. **Satu proses backend.** Monolith modular. Semua module dalam satu proses Node — hemat RAM, tanpa network hop, tanpa orkestrasi.
2. **Batas module tegas.** Tiap module: `routes` (HTTP + validasi) → `service` (aturan bisnis) → `repository` (query DB). Lapisan tidak boleh dilompati. Module lain hanya boleh masuk lewat `service`, tidak pernah langsung ke `repository`.
3. **DB penjaga kebenaran.** FK, unique, CHECK hidup di level DB, bukan cuma di kode.
4. **Real-time push, bukan polling.** Setiap perubahan state → emit event Socket.io ke room terkait.
5. **Uang = integer.** Rupiah penuh, tanpa float, tanpa desimal, di mana pun.
6. **Migrasi terversi.** Tiap perubahan schema jadi file migrasi SQL yang di-commit. Prisma Migrate yang membuat, bukan tulis tangan.
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
              │                     Prisma Client ──▶ MariaDB 11 :3306 (systemd)          │
              │                                       db `webcafe` · utf8mb4              │
              └──────────────────────────────────────────────────────────────────────────┘
```

## Tech stack & alasan

### Backend

| Komponen | Pilihan | Alasan | Alternatif ditolak |
|---|---|---|---|
| Runtime | Node.js 22 LTS | dependensi native (`sharp`) matang; PM2 first-class; Prisma engine resmi didukung | Bun (Prisma masih bermasalah), Deno |
| HTTP | Fastify 5 | ~2× throughput Express, skema-first, plugin resmi (jwt, cors, static, rate-limit, multipart) | Express (lebih lambat, ekosistem middleware longgar), NestJS (RAM & boilerplate besar) |
| Realtime | Socket.io 4 | punya room bawaan, auto-reconnect, fallback long-polling untuk HP/proxy jelek | `ws` mentah (harus tulis room + reconnect sendiri), SSE (satu arah), polling (dilarang PRD) |
| ORM | Prisma 6 | `prisma migrate` menghasilkan migrasi otomatis dari perubahan schema + `prisma studio` untuk inspeksi manual — alasan utama dipilih user | Drizzle (migrasi lebih manual), TypeORM |
| Database | MariaDB 11 | permintaan user; sudah familiar, tooling melimpah (phpMyAdmin/DBeaver), replikasi & backup matang | SQLite (ditolak user), PostgreSQL |
| Driver | `mysql2` via Prisma | driver resmi provider `mysql` Prisma untuk MariaDB | — |
| Validasi | Zod 3 | satu sumber tipe + validasi runtime, tipe di-infer ke frontend | `ajv` skema JSON (verbose), `yup` |
| Auth | `@fastify/jwt` + `argon2` | stateless, tanpa Redis; argon2id standar sekarang | session store (butuh state), bcrypt (lebih lemah) |
| Upload | `@fastify/multipart` + `sharp` | resize di server, hemat kuota pelanggan | simpan mentah (foto 5MB dari HP → menu berat) |
| Log | `pino` (bawaan Fastify) | JSON, cepat, tanpa dependensi tambahan | winston |
| Test | `vitest` | sama dengan frontend, satu config | jest (lambat untuk TS/ESM) |

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

MariaDB 11, database `webcafe`, charset `utf8mb4` / `utf8mb4_unicode_ci` (emoji di catatan pesanan tidak merusak query).
Dev lokal: `mysql://root:root@localhost:3306/webcafe`. Produksi: user khusus, **bukan root** (lihat bagian deployment).

Prisma dipilih untuk kenyamanan migrasi: `prisma migrate dev` membaca diff `schema.prisma` → menulis file SQL migrasi → menerapkannya, dan `prisma studio` memberi GUI inspeksi tanpa tool eksternal. Detail tabel di [database.md](./database.md).

**Biaya yang diterima di VPS 1GB.** Stack ini lebih berat dari rencana awal:

| Proses | Perkiraan RSS |
|---|---|
| MariaDB (dituning kecil) | 180–250MB |
| Node + Fastify + Prisma Client | 130–180MB |
| Caddy | ~20MB |
| Sisa untuk OS + burst | ~400MB |

Masih muat, tapi tidak lega. Tiga syarat supaya aman, ditegakkan sejak Fase 1:
1. **Swap 2GB wajib** — tanpa ini MariaDB gampang kena OOM-kill saat backup atau query laporan berat.
2. **Tuning `my.cnf`** (`innodb_buffer_pool_size=128M`, `max_connections=30`, `performance_schema=OFF`) — default MariaDB mengasumsikan mesin besar.
3. **`connection_limit=5`** di `DATABASE_URL` — pool Prisma default (`vCPU×2+1`) berlebihan untuk satu outlet dan menahan RAM.

Kalau nanti terasa sesak, urutannya: aktifkan preview `queryCompiler` Prisma (menghapus Rust query engine, Client jadi TypeScript murni) → naikkan VPS ke 2GB. Jangan ganti MariaDB, migrasi balik lebih mahal daripada tambahan RAM.

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
│  │  │  │  ├─ client.ts      # singleton PrismaClient (hindari koneksi ganda saat HMR)
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
│  │  └─ prisma/
│  │     ├─ schema.prisma     # sumber tunggal skema DB
│  │     └─ migrations/       # SQL hasil `prisma migrate dev` — di-commit
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
  order.repository.ts   # hanya query Prisma. Tanpa aturan bisnis, tanpa emit
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

Satu proses Node (backend) + MariaDB dari systemd + tiga folder statis. Caddy jadi TLS + router. Tidak ada container di titik mana pun.

### Prasyarat VPS (Ubuntu 24.04, 1 vCPU / 1GB)

```bash
# Swap 2GB — kerjakan PERTAMA. MariaDB di 1GB tanpa swap rawan OOM-kill.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3   # build-essential untuk sharp
sudo npm i -g pnpm pm2

# MariaDB 11
sudo apt install -y mariadb-server
sudo mariadb-secure-installation                     # set password root, buang anonymous user

sudo apt install -y caddy                            # atau nginx, lihat catatan bawah
```

`build-essential` wajib: tanpa Docker, `sharp` dikompilasi di mesin ini.

### Siapkan database

```sql
sudo mariadb <<'SQL'
CREATE DATABASE webcafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'webcafe'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON webcafe.* TO 'webcafe'@'localhost';
FLUSH PRIVILEGES;
SQL
```

**Jangan pakai `root:root` di produksi.** Kredensial itu untuk dev lokal saja; di VPS yang terjangkau internet, root tanpa password kuat berarti seluruh database bisa diambil siapa pun yang menemukan port 3306 terbuka. Pastikan juga `bind-address = 127.0.0.1` (default MariaDB) supaya DB tidak mendengarkan dari luar.

### Tuning `/etc/mysql/mariadb.conf.d/60-webcafe.cnf`

Default MariaDB mengasumsikan mesin besar. Tanpa ini, DB memakan RAM yang dibutuhkan Node:

```ini
[mysqld]
innodb_buffer_pool_size = 128M
max_connections         = 30
performance_schema      = OFF
innodb_flush_method     = O_DIRECT
tmp_table_size          = 16M
max_heap_table_size     = 16M
```

```bash
sudo systemctl restart mariadb && sudo systemctl enable mariadb
```

### Build & jalan

```bash
git clone <repo> /var/www/web-cafe && cd /var/www/web-cafe
cp .env.example .env && nano .env      # JWT_SECRET, DATABASE_URL, PORT
pnpm install --frozen-lockfile
pnpm build                             # prisma generate + build packages/* lalu apps/*
pnpm db:deploy                         # prisma migrate deploy — TANPA prompt, tanpa reset
pnpm db:seed                           # sekali saja, buat user admin
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

Produksi memakai `prisma migrate deploy`, bukan `migrate dev`. `migrate dev` bisa menawarkan reset database saat mendeteksi drift — di produksi itu artinya kehilangan seluruh data order.

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

`instances: 1` karena Socket.io multi-instance butuh adapter Redis untuk broadcast lintas proses — tanpa itu, order baru hanya sampai ke klien yang kebetulan terhubung ke proses yang sama. MariaDB sendiri sanggup banyak koneksi, jadi kalau nanti perlu skala: pasang `@socket.io/redis-adapter` lalu naikkan `instances`.

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
mariadb-dump --single-transaction --quick webcafe | gzip > /backup/webcafe-$(date +%F).sql.gz
tar czf /backup/uploads-$(date +%F).tar.gz uploads/
```

`--single-transaction` memberi snapshot konsisten tanpa mengunci tabel, jadi cafe tetap bisa menerima order saat backup jalan. `--quick` menahan pemakaian RAM di mesin 1GB. Pasang di cron harian, dan uji restore-nya sekali sebelum mengandalkannya:

```bash
gunzip < /backup/webcafe-YYYY-MM-DD.sql.gz | mariadb webcafe_test
```

### Mode dev lokal

MariaDB lokal, kredensial `root:root` sesuai permintaan:

```
DATABASE_URL="mysql://root:root@localhost:3306/webcafe?connection_limit=5"
```

```bash
pnpm db:migrate     # prisma migrate dev — bikin migrasi baru dari perubahan schema
pnpm db:studio      # GUI Prisma Studio :5555
pnpm dev            # api :3000 · customer :5173 · kasir :5174 · kds :5175
```

Vite proxy `/api` dan `/socket.io` ke `:3000`, jadi tidak ada urusan CORS di dev maupun produksi.

## Non-fungsional yang mengikat kode

| Aspek | Cara ditegakkan |
|---|---|
| Uang | kolom `Int` di Prisma; helper `@cafe/shared/money`; dilarang `parseFloat` untuk harga |
| Performa read | index sesuai [database.md](./database.md); MariaDB di `localhost` (tanpa network hop) |
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
- **Prisma + MariaDB di 1GB RAM** → margin tipis (lihat tabel RSS di atas). Jalan keluar berurutan: preview `queryCompiler` → VPS 2GB.

Keputusan yang sulit dibalik (MariaDB + Prisma, monolith modular, tanpa Docker) tercatat di sini; kalau nanti diubah, tulis ADR di `docs/adr/`.
