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
- **Fase 4** selesai — kasir: login + guard role, layout, order aktif realtime, detail + timeline, pembayaran + kembalian, kasir manual, struk 58/80mm, CRUD menu + upload foto + toggle habis, CRUD meja + QR + cetak lembar.
- **Fase 5** selesai — KDS: login, 3 kolom, kartu besar + catatan berlatar, timer + warna menua, bunyi, aksi satu tap optimistic, indikator koneksi, wakeLock. Bundle 114KB gzip.
- **Fase 6** selesai — laporan (kartu ringkasan, preset rentang, grafik SVG, terlaris, metode bayar, export CSV), manajemen user, pengaturan. Bundle kasir 128KB gzip.
- **Berikutnya**: Fase 7 (deployment & dokumentasi) — `scripts/backup.sh` dan uji pasang di VPS bersih yang belum ada.

Total 48 test lulus (14 api + 12 shared + 15 kasir + 7 kds).

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
- KDS `lib/api.ts` disalin-tipis dari kasir, bukan diangkat ke paket bersama: KDS hanya butuh `get`+`patch` (tanpa upload/blob), jadi ~50 baris lebih murah daripada paket baru. Ditandai `ponytail:` — pindahkan ke `packages/client` kalau ada app keempat yang butuh fetch ber-auth.
- KDS menghitung umur kartu dari `createdAt`, bukan dari `elapsedSeconds` milik server — nilai server hanya benar pada saat fetch, jadi timer akan macet antar-refetch.
- Kolom "Siap" di KDS ditahan 5 menit di sisi klien karena `/kitchen/queue` hanya mengembalikan status aktif dapur. Tanpa penahan, kartu lenyap begitu ditap dan barista tidak tahu tapnya tercatat.
- `useDetik` (KDS) memakai `setInterval` 1 detik. Ini **bukan** polling data — tidak ada request; hanya tick jam lokal supaya timer di kartu bergerak. Data tetap datang lewat socket.
- Grafik omzet SVG buatan sendiri (`GrafikOmzet.tsx`, ~120 baris) menggantikan `recharts` yang disebut roadmap. Yang dibutuhkan hanya batang + label + tooltip `<title>`; pustaka chart menambah ~100KB gzip untuk satu halaman. Disertai `<details>` berisi tabel angka — SVG tidak terbaca screen reader per titik, dan owner sering butuh angka persisnya.
- Unduhan CSV lewat `fetch` + blob + `<a download>`, bukan `<a href>` biasa: endpoint export butuh header `Authorization`.
- `keInputDate`/`dariInputDate` memakai komponen tanggal **lokal**, bukan `toISOString().slice(0,10)` — potongan ISO menggeser hari untuk pengguna di zona waktu apa pun yang bukan UTC. Ini diuji (8 test) karena laporan yang meleset sehari lebih buruk daripada laporan yang gagal dimuat.
- Password baru (buat user / reset) ditampilkan sekali di UI sebagai teks agar bisa dicatat; server hanya menyimpan hash argon2id dan tidak pernah mengirim balik. Generator acak memakai `crypto.getRandomValues`, bukan `Math.random`.
- Form pengaturan menyalin data server ke state **sekali** (`if (data && !f)`) — menyalin setiap render membuat refetch menimpa apa yang sedang diketik.

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

1. ✅ Login (role `dapur`/`kasir`/`admin`), token di handshake → server auto-join room `kitchen`.
2. ✅ Tiga kolom: **Baru** · **Diproses** (`dikonfirmasi` + `diproses`) · **Siap**. `GET /kitchen/queue` untuk initial, socket untuk update.
3. ✅ Kartu besar: nomor meja `text-2xl` paling menonjol, `orderCode`, item + qty + catatan (catatan berlatar amber, bukan italic tipis), timer sejak masuk.
4. ✅ Warna kartu menua: netral → amber → merah, ambang dari `KDS_AMBANG_KUNING`/`KDS_AMBANG_MERAH` di `@cafe/shared`.
5. ✅ `order:new` → kartu masuk + bunyi tiga nada. Tombol "Aktifkan suara" sekali (kebijakan autoplay).
6. ✅ Aksi satu tap: Terima → Mulai Proses → Siap. Optimistic update, tanpa dialog konfirmasi.
7. ✅ Indikator koneksi besar: hijau "● Tersambung" / merah "○ TERPUTUS — data tidak terbaru".
8. ✅ `navigator.wakeLock` (gagal diabaikan, minta ulang saat tab terlihat), font 18px, mode gelap default.

**DoD**: order baru dari HP muncul di KDS < 1 detik dengan bunyi. Matikan WiFi 30 detik, hidupkan lagi → antrian tersusul lengkap lewat refetch (tidak ada order hilang). Timer & warna berubah sesuai umur order.

**Terverifikasi** (backend + dua klien socket nyata): order baru → klien dapur terima `order:new`, ada di `/kitchen/queue` dengan `elapsedSeconds` · transisi `dikonfirmasi` → `diproses` → `selesai` semua sukses, tiap langkah memancarkan `order:updated` ke dapur dan `order:status` ke pelanggan · order `selesai` keluar dari antrian · `status: dibatalkan` lewat rute dapur → 400 (dapur tidak boleh membatalkan). **Susulan offline diuji langsung**: socket dimatikan, order dibuat (0 event diterima, sesuai harapan), socket dihidupkan → `connect` memicu refetch dan order tersusul di antrian. **Belum diverifikasi**: tampilan di layar fisik dapur dan `wakeLock` di perangkat nyata.

Kolom "Siap" menahan kartu 5 menit di sisi klien — `GET /kitchen/queue` hanya mengembalikan status aktif dapur, jadi order selesai langsung hilang dari server. Tanpa penahan itu kartu lenyap begitu ditap dan barista tidak tahu tapnya tercatat.

## Fase 6 — Admin & Laporan

**Tujuan**: owner bisa tutup buku harian dalam < 1 menit.

1. ✅ Kartu ringkasan: omzet, jumlah order, rata-rata per order, diskon diberikan.
2. ✅ Filter rentang + preset (Hari ini, 7 hari, Bulan ini, Bulan lalu, Custom lewat dua `input[type=date]`).
3. ✅ Grafik omzet — **SVG buatan sendiri**, bukan `recharts`. Toggle harian/mingguan/bulanan. Bundle kasir 128KB gzip; `recharts` akan menambah ~100KB untuk satu halaman.
4. ✅ Tabel menu terlaris (qty & nilai) + rincian metode pembayaran + subtotal/pajak/servis.
5. ✅ Export CSV (3 jenis) lewat `fetch` + blob — endpoint butuh header `Authorization` yang tidak bisa dikirim `<a href>`.
6. ✅ Manajemen user: buat, ubah role, aktif/nonaktif, reset password. Tombol dimatikan untuk admin aktif terakhir.
7. ✅ Pengaturan: pajak, servis, simbol mata uang, footer struk, `autoConfirmOrder`.

**DoD**: buka laporan bulan berjalan → angka cocok dengan penjumlahan manual data seed → export CSV terbuka benar di Excel (karakter Indonesia utuh, angka bisa di-SUM).

**Terverifikasi** (HTTP nyata terhadap MariaDB lokal): `summary` → omzet 104.000 dari 2 order, rata-rata 52.000, `perMetode` cash 50.000 + qris 54.000 — **cocok dengan penjumlahan manual** · `revenue` konsisten antara `groupBy=day` dan `month` · `top-items` terurut qty desc · tiga CSV terunduh dengan BOM UTF-8 (`ef bb bf`), CRLF, dan angka rupiah polos · rentang > 1 tahun → 400, `dateTo < dateFrom` → 400 · role kasir: `summary` 200, `export` 403, `/auth/users` 403 · admin aktif terakhir tidak bisa diturunkan/dinonaktifkan → 403 · `PATCH /settings` pajak 11% + servis 5% → order baru subtotal 15.000 menghasilkan pajak 1.650, servis 750, total 17.400. **Belum diverifikasi**: CSV dibuka di Excel sungguhan.

Nama/alamat/telepon cafe belum bisa diubah dari UI — masih di tabel `outlets`, diisi saat seed. Butuh endpoint `PATCH /outlet` dulu.

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
