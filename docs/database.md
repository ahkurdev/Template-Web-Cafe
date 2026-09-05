# Database — Sistem Cafe

**Engine**: SQLite (WAL) default — file `data/data.db`
**ORM**: Drizzle ORM
**Dev**: `file:./data/data.db`
**Prod**: PostgreSQL opsional `postgres://...` — lihat [arsitektur.md](./arsitektur.md#deployment-tanpa-docker)
**Update**: 2026-09-04

Sumber tunggal skema: `apps/api/src/db/schema.ts` (Drizzle). Dokumen ini penjelasannya — kalau beda, `schema.ts` yang benar.

## Konvensi

| Hal | Aturan | Alasan |
|---|---|---|
| Primary key | `String @db.VarChar(21)`, nanoid dibuat aplikasi | ID tidak bisa ditebak (dipakai di URL publik `/status/:code`), aman untuk merge multi-outlet nanti |
| Uang | `Int` — rupiah penuh (`Rp 15.000` → `15000`) | tanpa float, tanpa `Decimal`, tanpa galat pembulatan |
| Waktu | `DateTime @db.DateTime(3)`, selalu UTC | presisi milidetik untuk urutan antrian dapur |
| Enum | `text` + `CHECK` via Drizzle | divalidasi DB via CHECK constraint |
| Nama model | Drizzle `tableName` snake_case | idiomatis |
| Teks terindeks | maksimum `VarChar(191)` | aman untuk index utf8mb4 di semua konfigurasi InnoDB |
| Hapus master data | soft delete `isActive` | order lama tetap bisa dibaca |
| Audit | `createdAt` + `updatedAt` di semua tabel | — |
| Multi-outlet | `outletId` ada sejak MVP walau baru satu outlet | Fase 2 tanpa migrasi besar |

Tabel meja dinamai **`cafe_tables`** — `table` kata kunci SQL, `tables` bikin query mentah menyakitkan.

## Enum

```prisma
enum Role          { admin kasir dapur }
enum OrderStatus   { baru dikonfirmasi diproses selesai diambil dibatalkan }
enum OrderType     { dine_in takeaway }
enum PaymentStatus { belum_bayar lunas dibatalkan }
enum PaymentMethod { cash transfer qris_manual }
enum TableStatus   { tersedia terisi nonaktif }
```

Transisi status order yang sah (ditegakkan di `order.service`, bukan DB):

```
baru → dikonfirmasi → diproses → selesai → diambil
  └────────┴───────────┴──────────┴──→ dibatalkan
```
Mundur dilarang → `409 INVALID_STATUS_TRANSITION`. `diambil` dan `dibatalkan` final.

## ERD

```
outlets ─1─n─ users ─1─n─ orders (createdById, nullable = order dari pelanggan)
outlets ─1─n─ categories ─1─n─ menu_items
outlets ─1─n─ cafe_tables ─1─n─ orders
outlets ─1─n─ orders ─1─n─ order_items ─n─1─ menu_items (SetNull)
                     └─1─n─ order_events
outlets ─1─1─ settings
```

## Tabel

### `outlets`
Satu baris di MVP. Ada supaya Fase 2 tidak butuh migrasi besar.

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | nanoid |
| `name` | VarChar(120) | NOT NULL | nama cafe |
| `address` | Text | NULL | dicetak di struk |
| `phone` | VarChar(30) | NULL | |
| `isActive` | Boolean | default `true` | |
| `createdAt` / `updatedAt` | DateTime(3) | | |

### `users`
Staff. Pelanggan tidak punya akun.

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `outletId` | VarChar(21) | FK → `outlets.id`, Restrict | |
| `username` | VarChar(50) | **UNIQUE**, NOT NULL | disimpan lowercase |
| `passwordHash` | VarChar(255) | NOT NULL | argon2id. **Tidak pernah** masuk response API |
| `name` | VarChar(120) | NOT NULL | tampil di struk ("Kasir: Budi") |
| `role` | Role | NOT NULL | `admin` \| `kasir` \| `dapur` |
| `isActive` | Boolean | default `true` | nonaktifkan, jangan hapus — order historis merujuk ke sini |
| `lastLoginAt` | DateTime(3) | NULL | |
| `createdAt` / `updatedAt` | DateTime(3) | | |

FK `Restrict`: user yang pernah membuat order tidak bisa dihapus. Pakai `isActive = false`.

### `categories`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `outletId` | VarChar(21) | FK → `outlets.id`, Cascade | |
| `name` | VarChar(80) | NOT NULL | "Kopi", "Non-Kopi", "Makanan" |
| `slug` | VarChar(80) | UNIQUE per outlet | anchor di menu pelanggan |
| `sortOrder` | Int | default `0` | urutan tampil, admin bisa atur |
| `isActive` | Boolean | default `true` | |
| `createdAt` / `updatedAt` | DateTime(3) | | |

### `menu_items`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `outletId` | VarChar(21) | FK → `outlets.id`, Cascade | |
| `categoryId` | VarChar(21) | FK → `categories.id`, Restrict | kategori berisi item tidak bisa dihapus |
| `name` | VarChar(150) | NOT NULL | |
| `description` | Text | NULL | |
| `price` | Int | NOT NULL, `CHECK >= 0` | **rupiah penuh** |
| `imageUrl` | VarChar(255) | NULL | relatif: `/uploads/menu/<id>.webp` |
| `isAvailable` | Boolean | default `true` | toggle habis/tersedia, disiarkan lewat socket |
| `isActive` | Boolean | default `true` | soft delete |
| `sortOrder` | Int | default `0` | |
| `createdAt` / `updatedAt` | DateTime(3) | | |

`isAvailable` (habis hari ini) beda dari `isActive` (tidak dijual lagi). Menu pelanggan menampilkan `isActive = true` saja, dan menandai yang `isAvailable = false` sebagai "Habis" — tidak menyembunyikannya, supaya pelanggan tahu barangnya ada tapi kosong.

### `cafe_tables`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `outletId` | VarChar(21) | FK → `outlets.id`, Cascade | |
| `number` | VarChar(20) | UNIQUE per outlet | "7", "A3", "Teras-2" |
| `capacity` | Int | NULL | informasi saja |
| `location` | VarChar(80) | NULL | "Indoor", "Teras" |
| `qrToken` | VarChar(32) | **UNIQUE**, NOT NULL | nanoid(32) acak — isi QR code |
| `status` | TableStatus | default `tersedia` | |
| `isActive` | Boolean | default `true` | |
| `createdAt` / `updatedAt` | DateTime(3) | | |

`qrToken` acak, bukan nomor meja: kalau isinya `/menu?table=7`, siapa pun bisa memesan atas nama meja mana pun tanpa datang. Regenerate token → QR lama langsung mati (dipakai kalau stiker dicuri/difoto dan disebar).

### `orders`

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `outletId` | VarChar(21) | FK → `outlets.id`, Restrict | |
| `orderCode` | VarChar(20) | **UNIQUE**, NOT NULL | `A7-0042` — dibaca pelanggan & dapur |
| `tableId` | VarChar(21) | FK → `cafe_tables.id`, SetNull, NULL | NULL = takeaway |
| `type` | OrderType | default `dine_in` | |
| `status` | OrderStatus | default `baru` | |
| `customerName` | VarChar(80) | NULL | opsional, dipanggil saat siap |
| `note` | Text | NULL | catatan seluruh order |
| `subtotal` | Int | NOT NULL, `CHECK >= 0` | jumlah semua `order_items.subtotal` |
| `taxAmount` | Int | NOT NULL default `0` | dari `settings.taxPercent`, dibulatkan |
| `serviceAmount` | Int | NOT NULL default `0` | dari `settings.servicePercent` |
| `discountAmount` | Int | NOT NULL default `0` | manual oleh kasir |
| `total` | Int | NOT NULL, `CHECK >= 0` | subtotal + pajak + service − diskon |
| `paymentStatus` | PaymentStatus | default `belum_bayar` | |
| `paymentMethod` | PaymentMethod | NULL | diisi saat dibayar |
| `paidAmount` | Int | NULL | uang diterima (cash) |
| `changeAmount` | Int | NULL | `paidAmount − total` |
| `paidAt` | DateTime(3) | NULL | dasar laporan omzet |
| `createdById` | VarChar(21) | FK → `users.id`, Restrict, NULL | **NULL = order dari pelanggan** (QR) |
| `createdAt` / `updatedAt` | DateTime(3) | | `createdAt` = urutan antrian dapur |

Semua nilai uang disimpan hasil hitungan, bukan dihitung ulang saat dibaca. Kalau harga menu naik besok, struk lama tetap menunjukkan angka yang benar-benar dibayar.

`tableId` `SetNull`: meja boleh dihapus, riwayat order tidak boleh ikut hilang. Nomor meja saat itu tetap terbaca dari `order_events` / `orderCode`.

**Format `orderCode`**: `<prefix meja atau TA><nomor urut harian 4 digit>`, mis. `A7-0042`, `TA-0043`. Nomor urut reset tiap hari. Dihasilkan di dalam transaksi checkout; kalau tabrakan unique, ulangi sekali (retry) — lebih sederhana dan tahan-race daripada tabel counter.

### `order_items`

Snapshot. Nama & harga dibekukan saat order dibuat.

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `orderId` | VarChar(21) | FK → `orders.id`, **Cascade** | hapus order → item ikut |
| `menuItemId` | VarChar(21) | FK → `menu_items.id`, **SetNull**, NULL | menu boleh dihapus |
| `nameSnapshot` | VarChar(150) | NOT NULL | nama saat dipesan |
| `priceSnapshot` | Int | NOT NULL, `CHECK >= 0` | harga saat dipesan |
| `qty` | Int | NOT NULL, `CHECK > 0` | |
| `subtotal` | Int | NOT NULL, `CHECK >= 0` | `priceSnapshot × qty` |
| `note` | VarChar(200) | NULL | "tanpa gula", "extra shot" |
| `createdAt` | DateTime(3) | | |

Tanpa snapshot, laporan "menu terlaris" dan struk lama jadi salah setiap kali harga berubah. Ini alasan `menuItemId` boleh NULL: item terhapus, baris order tetap utuh dan terbaca.

### `order_events`

Jejak audit tiap perubahan status. Sumber data waktu saji.

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `orderId` | VarChar(21) | FK → `orders.id`, Cascade | |
| `status` | OrderStatus | NOT NULL | status **sesudah** perubahan |
| `note` | VarChar(200) | NULL | mis. alasan pembatalan |
| `actorId` | VarChar(21) | FK → `users.id`, SetNull, NULL | NULL = aksi pelanggan/sistem |
| `createdAt` | DateTime(3) | | |

### `settings`

Satu baris per outlet.

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | VarChar(21) | PK | |
| `outletId` | VarChar(21) | FK → `outlets.id`, **UNIQUE**, Cascade | relasi 1-1 |
| `taxPercent` | Int | default `0` | persen bulat (11 = 11%) |
| `servicePercent` | Int | default `0` | |
| `receiptFooter` | Text | NULL | "Terima kasih 🙏" |
| `currencySymbol` | VarChar(5) | default `Rp` | |
| `autoConfirmOrder` | Boolean | default `false` | `true` = order pelanggan langsung `dikonfirmasi` |
| `updatedAt` | DateTime(3) | | |

Pajak & service disimpan sebagai persen **integer**, bukan desimal. Cukup untuk semua kasus nyata (10%, 11%), dan menjauhkan float dari jalur perhitungan uang.

## Index penting

Tanpa ini, tiga halaman paling sering dibuka melakukan full scan.

| Index | Tabel (kolom) | Melayani query |
|---|---|---|
| `idx_order_status_created` | `orders (status, createdAt)` | antrian KDS: status aktif urut FIFO — query terpanas di sistem |
| `idx_order_paid_at` | `orders (paidAt)` | laporan omzet per rentang tanggal |
| `idx_order_payment_status` | `orders (paymentStatus, createdAt)` | daftar "belum bayar" di kasir |
| `idx_order_table` | `orders (tableId, createdAt)` | riwayat per meja |
| `uq_order_code` | `orders (orderCode)` UNIQUE | lookup `/status/:code` dari HP pelanggan |
| `idx_item_order` | `order_items (orderId)` | ambil isi order |
| `idx_item_menu` | `order_items (menuItemId)` | agregasi menu terlaris |
| `idx_menu_cat_active` | `menu_items (categoryId, isActive, sortOrder)` | render menu pelanggan |
| `uq_table_qr` | `cafe_tables (qrToken)` UNIQUE | resolve QR → meja |
| `uq_user_username` | `users (username)` UNIQUE | login |
| `idx_event_order` | `order_events (orderId, createdAt)` | timeline order |

Buat index FK penting secara eksplisit — jangan andalkan auto-index.

## Aturan integritas

Ditegakkan di DB, bukan hanya di kode aplikasi:

| Aturan | Mekanisme |
|---|---|
| Harga & total tidak negatif | `CHECK (price >= 0)` dst. via `migration.sql` manual |
| `qty > 0` | `CHECK (qty > 0)` |
| `username`, `orderCode`, `qrToken` unik | UNIQUE index |
| Order wajib punya minimal 1 item | divalidasi Zod + service (tidak bisa lewat CHECK) |
| Hapus order → item & event ikut | FK `onDelete: Cascade` |
| Hapus menu/meja → order tetap ada | FK `onDelete: SetNull` |
| Hapus user/kategori terpakai → ditolak | FK `onDelete: Restrict` |

Drizzle `check()` ditulis di `schema.ts` dan ikut tergenerate ke SQL:

```sql
-- tambahkan di akhir migration.sql yang relevan
ALTER TABLE `menu_items`  ADD CONSTRAINT `chk_price`     CHECK (`price` >= 0);
ALTER TABLE `order_items` ADD CONSTRAINT `chk_qty`       CHECK (`qty` > 0);
ALTER TABLE `order_items` ADD CONSTRAINT `chk_subtotal`  CHECK (`subtotal` >= 0);
ALTER TABLE `orders`      ADD CONSTRAINT `chk_total`     CHECK (`total` >= 0);
```

## Perhitungan uang (integer, urutan wajib)

```ts
// packages/shared/src/money.ts — satu-satunya tempat aritmetika uang
subtotalItem = priceSnapshot * qty                          // Int × Int
subtotal     = Σ subtotalItem
taxAmount    = Math.round(subtotal * taxPercent / 100)       // bulatkan SEKALI, di sini
serviceAmount= Math.round(subtotal * servicePercent / 100)
total        = subtotal + taxAmount + serviceAmount - discountAmount
changeAmount = paidAmount - total                            // hanya untuk `cash`
```

Bulatkan sekali di tingkat order, bukan per item — kalau per item, 10 item menghasilkan selisih beberapa rupiah dari angka yang dicetak di struk. `parseFloat` dan `Decimal` dilarang di jalur ini.

## Migrasi

```bash
pnpm db:migrate            # dev: prisma migrate dev — generate + apply + regenerate client
pnpm db:deploy             # prod: prisma migrate deploy — apply saja, tanpa prompt
pnpm db:studio             # GUI :5555
pnpm db:seed               # data awal
```

- File migrasi di `apps/api/prisma/migrations/**` **wajib di-commit**. Itu riwayat schema.
- **Jangan** `migrate dev` di produksi: saat mendeteksi drift ia menawarkan reset — artinya seluruh data order hilang.
- **Jangan** `db push` selain untuk coba-coba lokal; tidak menghasilkan file migrasi.
- Perubahan destruktif (drop kolom/tabel, ubah tipe) → backup dulu, konfirmasi user dulu.
- Kolom baru pada tabel yang sudah berisi data: beri `@default` atau jadikan nullable, kalau tidak migrasi gagal di DB produksi.

## Seed

`apps/api/prisma/seed.ts` — idempoten (`upsert`), aman dijalankan berulang:

1. Outlet default + baris `settings`
2. User `admin` — password dari `SEED_ADMIN_PASSWORD`; kalau tidak diisi, generate acak lalu cetak sekali ke stdout. **Tanpa** password default yang di-hardcode.
3. 3 kategori contoh, ~8 menu contoh (harga integer)
4. 5 meja + `qrToken` acak

## Catatan kompatibilitas SQLite ↔ PostgreSQL

Default SQLite. Kalau pindah ke PostgreSQL, cukup ganti `DATABASE_URL` ke `postgres://` dan driver ke `pg`. Schema Drizzle yang sama dipakai keduanya. Yang diperhatikan:

| Hal | SQLite | PostgreSQL | Sikap kita |
|---|---|---|---|
| Auto-increment | `AUTO_INCREMENT` | `SERIAL`/`IDENTITY` | dihindari — PK nanoid dari aplikasi |
| Enum | `TEXT` + CHECK | `TEXT` + CHECK | Drizzle `check()` |
| Boolean | `integer` 0/1 | `boolean` | Drizzle `integer({mode:'boolean'})` / `boolean` |
| Case-sensitivity | nama tabel ikut OS | selalu case-sensitive | semua nama tabel lowercase |
| `LIKE` | `LIKE` case-insensitive via `lower()` | `ILIKE` | pakai `lower()` portable atau Drizzle helper |
| Timestamp | `DATETIME(3)` | `timestamptz` | aplikasi selalu pegang `Date` UTC |
| String terindeks | batas byte index | lebih longgar | `VarChar(191)` untuk kolom terindeks |
| Upsert | `ON DUPLICATE KEY` | `ON CONFLICT` | pakai `prisma.upsert()` |

Aturan operasionalnya satu: **jangan pakai SQL mentah spesifik dialek** di kode aplikasi. Semua akses lewat Drizzle query builder. Kalau butuh SQL mentah (agregasi laporan berat), tulis di `report.repository.ts` dan beri penanda dialek.
