# Roadmap & Instruksi Build — Sistem Cafe

**Update**: 2026-09-04
Pembaca: Claude Code (saya sendiri) di sesi berikutnya. Kerjakan berurutan. Jangan lompat fase.

## Aturan eksekusi

1. Satu fase = satu unit kerja yang **bisa dijalankan dan dilihat hasilnya**. Jangan lanjut sebelum *Definition of Done* fase itu terbukti.
2. `pnpm build` dan `pnpm test` harus lulus sebelum bilang fase selesai. Kalau gagal, laporkan output, jangan diamkan.
3. **Dilarang**: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, atau instruksi container. Deploy native.
4. **Dilarang**: float/`Decimal` untuk uang; polling `setInterval` untuk data real-time; `any` di kode baru; `prisma migrate dev` di produksi (bisa reset DB); `db push` selain coba-coba lokal.
5. Ambil harga dari DB, tidak pernah dari body request klien.
6. Emit event Socket.io **setelah** transaksi commit, tidak di dalamnya.
7. Kalau menyimpang dari docs (`prd`/`arsitektur`/`database`/`api`), **update dokumen itu di response yang sama**.
8. Jangan commit kecuali diminta. Jangan push ke `main`.
9. Dependensi baru butuh alasan. Yang bisa < 50 baris, tulis sendiri.

## Status

- **Fase 0** selesai — MariaDB `webcafe` hidup, `.env` terisi.
- **Fase 1** selesai — monorepo, `packages/shared`, Prisma schema + migrasi + seed, 3 app Vite, `/api/health` → `{"status":"ok","db":"ok"}`.
- **Fase 2** selesai — 7 module backend, Socket.io, alur penuh terverifikasi lewat HTTP + socket. `pnpm typecheck`/`test`/`build` lulus (26 test).
- **Fase 3** selesai — customer-menu: resolve QR, katalog + badge Habis realtime, keranjang, checkout, halaman status. Bundle 117KB gzip.
- **Fase 4** sebagian — kasir: login + guard role, layout, order aktif realtime, detail + timeline, pembayaran + kembalian, kasir manual, struk 58/80mm, CRUD menu + upload foto + toggle habis, CRUD meja + QR + cetak lembar. Bundle 123KB gzip, 33 test lulus. **Belum**: laporan, manajemen user, pengaturan (jadi Fase 6).
- **Berikutnya**: Fase 5 (kitchen display).

Catatan implementasi yang menyimpang/melengkapi dokumen:
- `order.pricing.ts` dipisah dari `order.service.ts` supaya logika harga bisa diuji tanpa DB.
- Emit socket memakai `io.to([room1, room2])` satu kali, bukan dua emit — admin/kasir anggota dua room, dua emit membuat mereka menerima event dobel.
- `packages/ui` belum dibuat: belum ada komponen yang dipakai ≥2 app.
- `CHECK` constraint ada di migrasi terpisah `20260904091500_check_constraints`.
- Tailwind 4.3.3 (4.0.6 gagal build).
- Bundle `customer-menu` 117KB gzip — di bawah target PRD 200KB.
- `qrToken` disimpan di `sessionStorage` dan dibuang dari URL (`history.replaceState`) supaya tidak ikut ter-share saat pelanggan mengirim link.
- Kasir: cetak dikendalikan kelas `.cetak` (+ `.cetak--58`, `.cetak--lembar`), bukan `id="struk"` — satu halaman bisa punya beberapa area cetak (struk, QR tunggal, lembar QR). `@media print` juga menetralkan `dialog` + `::backdrop`, kalau tidak, cetak dari dalam modal menghasilkan halaman kosong.
- Bunyi order baru dibangkitkan WebAudio (dua nada), bukan file audio — hemat satu request dan tidak ada aset yang harus dijaga. Butuh tombol "Aktifkan suara" sekali karena kebijakan autoplay browser.
- Listener `order:*` dipasang sekali di `Layout` (`usePantauOrder`), bukan per halaman: dua listener berarti bunyi notifikasi dobel.
- QR di kasir diambil lewat `fetch` → object URL, karena `<img src>` tidak bisa mengirim header `Authorization`.
- `api.ts` kasir memaksa ke `/kasir/login` saat 401 **hanya** kalau token ada — tanpa cek itu, login yang gagal (401 tanpa token) ikut memicu reload dan pesan error tidak pernah terlihat.
- Halaman kasir manual menghitung total dengan `hitungTotal` dari `@cafe/shared` (helper yang sama dengan server) supaya tombol "Buat & Lunas" tidak bisa ditekan dengan uang kurang. Server tetap sumber kebenaran.

## Fase 0 — Prasyarat lokal (sekali, sebelum Fase 1)

MariaDB harus hidup dulu. Cek:

```bash
mysql -u root -proot -e "SELECT VERSION();"
```

Gagal? Pasang MariaDB/XAMPP dulu, lalu:

```sql
CREATE DATABASE webcafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`.env` dev:
```
DATABASE_URL="mysql://root:root@localhost:3306/webcafe?connection_limit=5"
JWT_SECRET="<openssl rand -hex 32>"
PORT=3000
UPLOAD_DIR="./uploads"
```

`root:root` hanya untuk lokal. Produksi wajib user non-root — sudah dicatat di [arsitektur.md](./arsitektur.md#siapkan-database).

## Fase 1 — Fondasi monorepo

**Tujuan**: `pnpm dev` menyalakan 4 proses, backend menjawab `/api/health` dengan status DB `ok`.

1. `pnpm init` di root; `pnpm-workspace.yaml` → `apps/*`, `packages/*`.
2. `tsconfig.base.json` — `strict: true`, `noUncheckedIndexedAccess: true`, path `@cafe/*`.
3. `.gitignore` — `node_modules`, `dist`, `.env`, `uploads/`, `logs/`.
4. `packages/shared` — `constants/`, `schemas/`, `types/`, `events.ts`, `money.ts`.
   `money.ts` wajib lengkap di fase ini: `hitungSubtotal`, `hitungTotal`, `formatRupiah`. Semua `Int`.
5. `packages/ui` — kosong dulu, cukup `package.json` + entry. Isi saat ada komponen yang benar-benar dipakai ≥2 app. Jangan bikin komponen spekulatif.
6. `apps/api` — Fastify + `env.ts` (validasi Zod, fail-fast kalau `JWT_SECRET` kosong), `plugins/errors.ts`, `GET /api/health`.
7. `apps/api/prisma/schema.prisma` — **semua model sesuai [database.md](./database.md)**, sekaligus. Jangan bertahap; ubah schema berkali-kali menghasilkan tumpukan migrasi tak berguna.
8. `pnpm db:migrate` → migrasi awal. Tambahkan `CHECK` constraint manual di `migration.sql` (lihat database.md).
9. `prisma/seed.ts` idempoten: outlet, settings, admin, 3 kategori, ~8 menu, 5 meja.
10. Tiga app Vite React TS + Tailwind. `base` masing-masing: `/`, `/kasir/`, `/kds/`. Port 5173/5174/5175, proxy `/api` + `/socket.io` → `:3000`.
11. Skrip root:
```json
"dev": "pnpm -r --parallel dev",
"build": "pnpm -F @cafe/shared build && pnpm -F @cafe/ui build && pnpm -r build",
"db:migrate": "pnpm -F @cafe/api prisma migrate dev",
"db:deploy":  "pnpm -F @cafe/api prisma migrate deploy",
"db:studio":  "pnpm -F @cafe/api prisma studio",
"db:seed":    "pnpm -F @cafe/api prisma db seed",
"test": "pnpm -r test",
"typecheck": "pnpm -r exec tsc --noEmit"
```

**DoD**: `pnpm typecheck` bersih · `pnpm db:studio` menampilkan data seed · `curl localhost:3000/api/health` → `{"status":"ok","db":"ok"}` · tiga app terbuka di browser.

## Fase 2 — Backend core

**Tujuan**: seluruh alur order jalan lewat HTTP + event socket, terbukti tanpa satu pun frontend.

Urutan wajib (tiap module bergantung yang sebelumnya):

1. **`auth`** — `argon2id`, `POST /auth/login`, `GET /auth/me`, plugin `requireRole()`, CRUD user. Kerjakan pertama; tanpa ini rute lain tak bisa dilindungi.
2. **`plugins/socket.ts`** — Socket.io, auth handshake, auto-join room dari role, `order:subscribe` dengan verifikasi `order_code`.
3. **`table`** — CRUD, `qrToken` nanoid(32), `GET /tables/resolve/:qr_token`, QR PNG/SVG via `qrcode`.
4. **`menu`** — kategori, item, `PATCH .../availability` → emit `menu:availability`, upload `sharp` → webp 800px.
5. **`order`** — bagian terpenting, kerjakan hati-hati:
   - `POST /orders` di dalam **satu transaksi**: resolve `qr_token` → ambil item dari DB → tolak jika ada `isAvailable: false` (409 + nama item) → hitung total pakai `@cafe/shared/money` → generate `orderCode` (retry sekali kalau tabrakan unique) → insert `orders` + `order_items` (snapshot nama & harga) + `order_events`.
   - Emit **setelah** commit: `kitchen`, `kasir`, `order:<id>`.
   - `POST /orders/manual`, `GET /orders`, `/active`, `/:id`, `/code/:code` (publik, field aman saja).
   - `PATCH /:id/status` — tabel transisi sah, mundur → 409.
   - `PATCH /:id/payment` — `cash` kurang → 409, sudah lunas → 409, hitung kembalian, emit `order:paid`.
   - `POST /:id/cancel`, `PATCH /:id/discount`, `GET /:id/receipt`.
6. **`kitchen`** — `GET /kitchen/queue` (FIFO + `elapsed_seconds`), `PATCH status`, `GET /kitchen/stats`.
7. **`report`** — summary, revenue (`group_by`), top-items, 3 export CSV (BOM UTF-8, angka integer polos). Basis `paidAt`, hanya `lunas`.
8. **`settings`** — `GET`/`PATCH`.
9. **Rate limit** — `@fastify/rate-limit` + `trustProxy: true` (tanpa ini semua IP terlihat `127.0.0.1` di belakang Caddy).

Test wajib fase ini (vitest, bukan opsional):
- `money.test.ts` — pembulatan pajak sekali di tingkat order, bukan per item.
- `order.checkout.test.ts` — harga diambil dari DB meski klien mengirim harga palsu; item habis → 409.
- `order.status.test.ts` — transisi tidak sah → 409.

**DoD**: alur penuh lewat `curl`/REST client: login → buat meja → buat menu → checkout pakai `qr_token` → antrian dapur berisi order → ubah status → bayar → laporan menampilkan omzet. Dua browser tab terhubung socket menerima `order:new`. `pnpm test` lulus.

## Fase 3 — Frontend Customer Menu

**Tujuan**: pelanggan bisa scan QR → pesan → lihat status berubah sendiri, dari HP.

1. Fondasi bersama (tulis sekali, salin pola ke dua app lain): `lib/api.ts` (fetch wrapper, baca `error.code`), `lib/socket.ts` (singleton + refetch saat `connect`), provider TanStack Query.
2. `?t=<qr_token>` → `GET /tables/resolve` → simpan meja di state. Token tidak valid → halaman "QR tidak berlaku, hubungi kasir".
3. Halaman menu: `GET /menu` sekali, tab/anchor kategori, kartu item (foto lazy, harga `formatRupiah`), item habis tampil abu + badge "Habis" dan tidak bisa ditambah.
4. Listener `menu:availability` → tandai item tanpa refresh.
5. Keranjang (Zustand, persist `sessionStorage`): qty ±, catatan per item, subtotal live, bar sticky bawah.
6. Checkout: nama opsional, catatan, `POST /orders`. Tangani 409 `ITEM_UNAVAILABLE` — tampilkan nama item, hapus dari keranjang, jangan sekadar "gagal".
7. Halaman `/status/:order_code`: stepper status, `order:subscribe`, listener `order:status`, bisa dibuka ulang lewat URL.
8. Simpan `order_code` terakhir di `localStorage` → banner "Lihat pesanan Anda" saat kembali.

Wajib di app ini: target sentuh ≥ 44px, kontras ≥ 4.5:1, skeleton saat load, indikator offline, `<title>` per halaman. Ini satu-satunya app yang dipakai orang asing di HP kentang dengan 4G lemah — bundle < 200KB gzip.

**DoD**: dari HP nyata di jaringan yang sama: scan QR → pesan 2 item → order muncul di respons `GET /kitchen/queue` → ubah status lewat curl → HP berubah < 1 detik tanpa refresh.

## Fase 4 — Frontend Kasir

**Tujuan**: kasir bisa menjalankan satu shift penuh dari app ini.

1. ✅ `/login` → simpan JWT (`localStorage`) + `ButuhLogin` per role. 401 dari API → tendang ke login.
2. ✅ Layout dengan sidebar: Order Aktif · Kasir Manual · Menu · Meja (Menu/Meja hanya `admin`). Laporan & Pengaturan menyusul di Fase 6.
3. ✅ **Order Aktif** — kartu dari `GET /orders/active`, badge status & pembayaran, listener `order:new` (+ bunyi notifikasi), `order:updated`, `order:paid`, `order:cancelled`.
4. ✅ **Detail order** — item, total, timeline event, tombol status dari `TRANSISI_SAH`, tombol batal (wajib alasan).
5. ✅ **Pembayaran** — modal: pilih metode, input uang diterima (`cash`), kembalian dihitung live, tombol cepat 1k–100k + "Pas". Kurang → tombol mati + selisih ditampilkan; error 409 server tampil apa adanya.
6. ✅ **Kasir manual** — cari menu, keranjang, meja opsional, `POST /orders/manual`, opsi langsung lunas.
7. ✅ **Cetak struk** — komponen 58mm/80mm + `@media print`, `window.print()`. **Belum diuji di printer thermal nyata** — baru print preview.
8. ✅ **Manajemen menu** (admin) — CRUD kategori & item, upload foto, toggle habis paling menonjol (optimistic update).
9. ✅ **Manajemen meja** (admin) — CRUD, QR preview, cetak semua QR (grid siap potong), regenerate token dengan konfirmasi eksplisit.

**DoD**: satu shift simulasi: login → terima order pelanggan → konfirmasi → bayar cash dengan kembalian → cetak (print preview benar) → toggle satu menu habis dan lihat efeknya di HP pelanggan yang masih terbuka.

**Terverifikasi** (backend + socket, lewat HTTP & klien socket nyata): login → order manual 2 item = Rp 55.000, bayar cash Rp 100.000 → kembalian Rp 45.000 · bayar ulang → 409 `ORDER_ALREADY_PAID` · uang kurang → 409 `PAYMENT_INSUFFICIENT` · payload `/receipt` lengkap · klien kasir menerima `order:new` + `order:updated`, klien pelanggan menerima `menu:availability` dua arah. **Belum diverifikasi**: klik-per-klik di browser dan cetak ke printer thermal fisik.

## Fase 5 — Frontend Kitchen Display

**Tujuan**: layar dapur yang berguna dari jarak 1,5 meter, tanpa disentuh selama jam sibuk.

1. Login (role `dapur` cukup), auto-join room `kitchen`.
2. Tiga kolom: **Baru** · **Diproses** · **Siap**. `GET /kitchen/queue` untuk initial, socket untuk update.
3. Kartu order besar: `order_code` + nomor meja paling menonjol, item + qty + catatan (catatan diberi highlight — ini yang paling sering terlewat), timer sejak masuk.
4. Warna kartu menua: < 5 menit netral, 5–10 menit kuning, > 10 menit merah. Ambang dari konstanta, mudah diubah.
5. `order:new` → kartu masuk + bunyi + animasi singkat. Bunyi butuh interaksi pertama (kebijakan autoplay browser) → tampilkan tombol "Aktifkan suara" sekali.
6. Aksi satu tap: Terima → Proses → Siap. Tombol besar, tanpa dialog konfirmasi (kecepatan lebih penting; salah tap bisa dikembalikan kasir).
7. Indikator koneksi jelas dan besar. Saat socket mati, staf harus langsung tahu layar ini tidak bisa dipercaya.
8. Cegah layar tidur (`navigator.wakeLock`, fallback abaikan), font besar, mode gelap default.

**DoD**: order baru dari HP muncul di KDS < 1 detik dengan bunyi. Matikan WiFi 30 detik, hidupkan lagi → antrian tersusul lengkap lewat refetch (tidak ada order hilang). Timer & warna berubah sesuai umur order.

## Fase 6 — Admin & Laporan

**Tujuan**: owner bisa tutup buku harian dalam < 1 menit.

1. Dashboard: omzet hari ini, jumlah order, rata-rata per order, order belum bayar.
2. Filter rentang tanggal + preset (Hari ini, 7 hari, Bulan ini, Custom).
3. Grafik omzet — `recharts`. Kalau bundle kasir jadi > 500KB gzip, ganti chart SVG buatan sendiri; laporan tidak perlu pustaka besar.
4. Tabel menu terlaris (qty & nilai), rincian metode pembayaran.
5. Tombol export CSV (3 jenis) — unduhan langsung dari endpoint.
6. Manajemen user (admin): CRUD, ubah role, nonaktifkan, reset password.
7. Pengaturan: nama/alamat cafe, pajak, service, footer struk, `auto_confirm_order`.

**DoD**: buka laporan bulan berjalan → angka cocok dengan penjumlahan manual data seed → export CSV terbuka benar di Excel (karakter Indonesia utuh, angka bisa di-SUM).

## Fase 7 — Deployment & dokumentasi

**Tujuan**: orang lain bisa memasang sistem ini di VPS bersih dalam < 15 menit, tanpa Docker.

1. `ecosystem.config.cjs` (`instances: 1`, `max_memory_restart: 400M`).
2. `Caddyfile` sesuai [arsitektur.md](./arsitektur.md) — `/api`, `/socket.io`, `/uploads`, `/kasir`, `/kds`, root.
3. `.env.example` lengkap dengan komentar tiap variabel.
4. `scripts/backup.sh` — `mariadb-dump --single-transaction --quick` + `tar` uploads. Contoh baris cron.
5. `README.md`: fitur + screenshot, prasyarat (termasuk **swap 2GB** dan tuning `my.cnf`), pasang lokal, pasang VPS, backup/restore, update, troubleshooting.
6. `LICENSE` MIT.
7. `docs/agent.md` + copy ke root sebagai `CLAUDE.md` — perintah, aturan repo, jebakan.
8. Uji di VPS bersih (atau VM) ikut README apa adanya. Setiap langkah yang macet → perbaiki README, bukan diakali manual.
9. Cek keamanan sebelum publik: DB user non-root, `bind-address=127.0.0.1`, `JWT_SECRET` acak, rate limit aktif, `trustProxy` aktif, tidak ada kredensial di git (`git log -p | grep -i password`).

**DoD**: VPS bersih → ikut README → tiga app terbuka lewat HTTPS, order dari HP masuk ke KDS. Restore backup ke DB kosong berhasil (jangan percaya backup yang belum pernah di-restore).

## Fase 8 — Nice to have (jangan mulai sebelum Fase 1–7 selesai)

Urutan berdasarkan manfaat per usaha:

1. **Stok bahan** — model `Ingredient` + `Recipe` (item ↔ bahan + porsi), kurangi stok saat status `selesai`, auto-set `isAvailable: false` saat bahan habis. Perubahan schema terbesar; kerjakan pertama kalau memang dipakai.
2. **Multi-outlet** — aktifkan filter `outletId` di semua repository, scoping user per outlet, pemilih outlet untuk admin. Kolomnya sudah ada, jadi tanpa migrasi besar.
3. **QRIS otomatis** — `POST /api/webhooks/payment` + verifikasi signature, auto-set `lunas`. Butuh akun payment gateway.
4. **Riwayat pelanggan** — tanpa akun: cocokkan nomor HP opsional.
5. **PWA** — `manifest.json` + service worker untuk KDS/kasir supaya bisa "install" di tablet.
6. **Cetak ESC/POS langsung** — agen kecil di jaringan lokal; hanya kalau `window.print()` benar-benar mengganggu.

## Prioritas kalau waktu terbatas

Kalau harus berhenti di tengah, ini urutan yang tetap menghasilkan sistem berguna:

| Prioritas | Cakupan | Nilai kalau berhenti di sini |
|---|---|---|
| **P0 — wajib** | Fase 1, 2, 3 | Pelanggan sudah bisa pesan sendiri dari meja. Dapur pakai `GET /kitchen/queue` sementara. Sudah lebih baik dari nota kertas |
| **P1** | + Fase 4 (order aktif, pembayaran, struk, toggle habis) | Kasir tidak perlu tool lain. Sistem layak dipakai sehari-hari |
| **P2** | + Fase 5 | Dapur punya layar sendiri. Alur tiga peran lengkap |
| **P3** | + Fase 6 + 7 | Laporan & bisa dipasang orang lain. Layak disebut open source |
| **P4** | Fase 8 | Pembeda, bukan kebutuhan |

Kalau harus memilih di dalam satu fase:
- **Fase 4**: order aktif + pembayaran + toggle habis dulu. Cetak struk dan manajemen menu bisa sementara lewat Prisma Studio.
- **Fase 6**: `GET /reports/summary` + export CSV dulu. Grafik paling akhir — CSV sudah cukup untuk tutup buku.
- **Fase 7**: README + `.env.example` + backup script tidak boleh dilewat. Tanpa itu proyek ini tidak bisa dipakai siapa pun selain saya sendiri.

Yang **tidak boleh** dipotong dengan alasan waktu: validasi Zod di boundary, harga diambil dari DB (bukan dari klien), hash password argon2, rate limit `POST /orders`, refetch saat socket reconnect, script backup. Semuanya melindungi uang atau data — memotongnya berarti mengirim sistem yang salah, bukan sistem yang lebih kecil.
