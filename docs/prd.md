# PRD — Sistem Cafe (WebCafe)

**Status**: draft — tunggu konfirmasi sebelum coding
**Update**: 2026-09-04
**Model rilis**: open source (MIT), self-hosted, tanpa Docker

## Ringkasan produk

Sistem operasional cafe: satu backend, tiga frontend.

- **Customer Menu** — publik. Pelanggan scan QR di meja, pesan tanpa login, tanpa install.
- **Kasir/POS** — staff login. Input order manual, ubah status pembayaran, cetak struk.
- **Kitchen Display (KDS)** — antrian order dapur real-time, urut waktu masuk.

Data milik pemilik cafe. Jalan di satu VPS 1GB RAM secara native (PM2 + Caddy), tanpa Docker, tanpa langganan.

## Masalah yang diselesaikan

| Kondisi sekarang | Dampak |
|---|---|
| Order lewat pelayan + nota kertas | salah tulis, nota hilang, lambat saat jam sibuk |
| Menu habis tidak terinformasi | pelanggan pesan barang kosong, kasir bolak-balik ke meja |
| Dapur tak tahu urutan masuk | order lama terlewat, waktu saji tak terukur |
| Rekap omzet manual | tutup buku lama, menu terlaris cuma tebakan |
| POS SaaS berlangganan | biaya bulanan, data di pihak ketiga, mati saat internet mati |

## Target user

| Persona | Aplikasi | Kebutuhan utama |
|---|---|---|
| Pelanggan | `customer-menu` (publik) | lihat menu + foto, pesan dari meja, tahu status pesanan |
| Kasir | `kasir` (login) | input manual, tandai lunas, cetak struk, pantau order aktif |
| Barista / dapur | `kitchen-display` (login) | antrian urut, tandai dikerjakan/selesai, minim klik |
| Owner / admin | `kasir` (role `admin`) | CRUD menu, kelola meja & QR, laporan omzet, export CSV |
| Self-hoster | — | pasang di VPS murah tanpa Docker, backup satu perintah cron |

## Fitur MVP

### Menu digital
- [ ] Kategori menu dengan urutan yang bisa diatur
- [ ] Item: nama, deskripsi, harga (integer rupiah), foto, kategori
- [ ] Toggle `tersedia`/`habis`, efeknya muncul real-time di semua app yang terbuka
- [ ] Foto disimpan di disk lokal (`uploads/`), di-resize saat upload

### Order pelanggan (tanpa login)
- [ ] Scan QR meja → menu terbuka, meja terdeteksi otomatis dari token QR
- [ ] Keranjang: tambah/kurang qty, catatan per item ("tanpa gula"), catatan order
- [ ] Checkout tanpa akun — hanya nama pelanggan (opsional)
- [ ] Harga total dihitung **server**, bukan dari body request
- [ ] Tolak checkout kalau ada item yang jadi habis di tengah jalan (409, sebut itemnya)

### Tracking status real-time
- [ ] Status: `baru` → `dikonfirmasi` → `diproses` → `selesai` → `diambil`, plus `dibatalkan`
- [ ] Pelanggan lihat perubahan status tanpa refresh
- [ ] Halaman status bisa dibuka ulang lewat kode order

### Kasir/POS
- [ ] Login (username + password, JWT)
- [ ] Input order manual (walk-in / takeaway, tanpa meja)
- [ ] Daftar order aktif, live, urut waktu masuk
- [ ] Pembayaran: `cash` (hitung kembalian) / `transfer` / `qris_manual` → tandai lunas
- [ ] Cetak struk lewat `window.print()` + CSS `@media print` (thermal 58/80mm)

### Kitchen Display
- [ ] Antrian order, FIFO, kartu besar
- [ ] Aksi: `dikonfirmasi` → `diproses` → `selesai`
- [ ] Order baru muncul otomatis + penanda visual
- [ ] Timer sejak order masuk; kartu menua diberi warna peringatan

### Meja & QR
- [ ] CRUD meja (nomor, kapasitas, lokasi)
- [ ] Generate QR per meja (PNG/SVG, bisa dicetak) berisi `qr_token` acak
- [ ] Regenerate token per meja (QR lama langsung mati)

### Laporan
- [ ] Omzet per rentang tanggal (harian/mingguan/bulanan)
- [ ] Menu terlaris (qty & nilai)
- [ ] Rincian per metode pembayaran
- [ ] Export CSV (omzet, order, item terjual)

### Admin
- [ ] CRUD user + role: `admin`, `kasir`, `dapur`
- [ ] Pengaturan cafe: nama, alamat, teks footer struk, pajak/service (default 0)

## Nice-to-have (Fase 2 — tidak menghambat MVP)

| Fitur | Catatan desain sekarang agar tidak mahal nanti |
|---|---|
| Manajemen stok bahan | tabel `ingredients` + `recipes` (item↔bahan); MVP cukup toggle habis manual |
| Multi-outlet | `outlet_id` sudah ada di semua tabel operasional sejak MVP; nanti tinggal aktifkan filter + scoping user |
| Integrasi QRIS otomatis | MVP: `qris_manual` (kasir konfirmasi manual). Nanti: webhook payment gateway ke `POST /api/webhooks/payment` |
| Mode offline pelanggan | butuh service worker + outbox; belum |
| Cetak langsung ke thermal printer | `window.print()` dulu; ESC/POS via agen lokal nanti |

## Non-functional requirements

| Aspek | Target |
|---|---|
| RAM | backend idle < 120MB; SQLite tanpa proses DB terpisah; total nyaman di VPS 1GB |
| Latency API | p95 < 150ms untuk read (SQLite file lokal, tanpa network hop) |
| Latency real-time | perubahan status tampil < 1s di klien yang terhubung |
| Bundle frontend | `customer-menu` < 200KB gzip (dibuka di 4G, HP kentang) |
| Ukuran DB | ~50 order/hari ≈ puluhan MB/tahun |
| Backup | `sqlite3 data.db .dump` + folder `uploads/`, via cron (atau `pg_dump` bila pakai PostgreSQL) |
| Deployment | native: PM2 + Caddy. Tanpa Docker, tanpa Kubernetes |
| Uptime | restart otomatis via PM2; sistem tetap jalan saat internet mati (LAN) |
| Aksesibilitas | kontras ≥ 4.5:1, target sentuh ≥ 44px, bisa dipakai keyboard |
| Keamanan | password `argon2id`, JWT masa hidup pendek, rate limit rute publik, validasi Zod di semua boundary, upload dibatasi tipe + ukuran |
| Lisensi | MIT |

## Batasan (constraints)

**Wajib**
- Tanpa Docker/container — dilarang di semua fase, termasuk dev.
- Monorepo pnpm workspaces.
- Backend: Node.js + Fastify + Socket.io + **Drizzle ORM**.
- DB: **SQLite** default (file `data.db`, WAL mode) — schema harus portable ke **PostgreSQL**. Detail di [database.md](./database.md).
- Frontend: React + Vite + TypeScript + Tailwind, tiga app terpisah di `apps/`.
- Monolith modular, bukan microservices.
- Harga = integer rupiah.
- Sasaran VPS 1 vCPU / 1GB RAM.

**Diterima sebagai konsekuensi**
- SQLite di 1GB RAM = sangat ringan (tanpa proses DB terpisah); untuk naik ke PostgreSQL cukup ganti `DATABASE_URL` + driver. Rincian di [arsitektur.md](./arsitektur.md#database).
- Tanpa Docker = `sharp` dikompilasi di VPS, butuh `build-essential`.
- Order pelanggan tanpa login → rawan spam. Diredam rate limit per IP + `qr_token` yang bisa dicabut.
- `qris_manual` bukan rekonsiliasi otomatis; kasir yang memutuskan.
- Satu instance backend (Socket.io tanpa adapter Redis). Skala horizontal butuh Redis dulu.

## Asumsi

Diambil tanpa konfirmasi — koreksi kalau salah:

- Satu outlet, ≤ 30 meja, ≤ 300 order/hari.
- Rupiah, tanpa desimal. Pajak & service default 0 (bisa diisi di pengaturan).
- Bahasa UI Indonesia. i18n tidak dikerjakan di MVP.
- Perangkat: pelanggan HP Android/iOS, kasir tablet/laptop, dapur layar ≥ 10".
- Frontend & backend satu domain lewat Caddy → cookie/CORS tidak jadi masalah.
- Foto menu diunggah admin, disimpan lokal, bukan object storage.
- Struk dicetak dari browser (thermal 58/80mm), tanpa driver khusus.

## Metrik keberhasilan

| Metrik | Target |
|---|---|
| Waktu order (scan → checkout) | < 90 detik |
| Order salah karena salah tulis | ~0 (input langsung pelanggan) |
| Order habis yang lolos ke dapur | 0 (validasi ketersediaan saat checkout) |
| Waktu tutup buku harian | < 1 menit (buka laporan, export CSV) |
| Waktu pasang di VPS bersih | < 15 menit ikut README |
| Order terlewat di dapur | 0 — timer + warna peringatan pada kartu menua |
