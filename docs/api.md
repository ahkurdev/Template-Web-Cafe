# API — Sistem Cafe

**Base URL**: `/api` (dev: `http://localhost:3000/api`)
**Auth**: `Authorization: Bearer <JWT>` — kecuali rute bertanda **publik**
**Realtime**: Socket.io di path default `/socket.io`
**Update**: 2026-09-04

Terkait: [arsitektur.md](./arsitektur.md) · [database.md](./database.md)

## Konvensi

- JSON, field `snake_case` (sama dengan kolom DB — tanpa lapisan penamaan ganda).
- Uang selalu `integer` rupiah. Frontend yang memformat.
- Waktu selalu ISO 8601 UTC (`2026-09-04T07:44:12.000Z`).
- Role: `admin` > `kasir` > `dapur`. Rute menulis menu/meja/user = `admin`. Pembayaran = `kasir`/`admin`. Status dapur = `dapur`/`kasir`/`admin`.

### Response sukses
```json
{ "data": { } }
```
List selalu ber-meta:
```json
{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0 } }
```

### Response error
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Body tidak valid",
             "fields": { "items": "minimal 1 item" } } }
```

| Code | HTTP | Kapan |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Zod gagal |
| `UNAUTHENTICATED` | 401 | token tidak ada/kedaluwarsa |
| `FORBIDDEN` | 403 | role tidak cukup |
| `NOT_FOUND` | 404 | resource / `qr_token` / `order_code` tak ada |
| `ITEM_UNAVAILABLE` | 409 | ada item `is_available = false` saat checkout |
| `INVALID_STATUS_TRANSITION` | 409 | mis. `selesai` → `diproses` |
| `ORDER_ALREADY_PAID` | 409 | ubah pembayaran order lunas |
| `PAYMENT_INSUFFICIENT` | 409 | `paid_amount` < `total` untuk `cash` |
| `RATE_LIMITED` | 429 | lewat batas |
| `INTERNAL` | 500 | tak terduga (detail hanya ke log, tidak ke klien) |

## Rate limiting

`@fastify/rate-limit`, kunci per IP. Rute publik dibatasi lebih ketat karena tanpa login.

| Rute | Batas | Alasan |
|---|---|---|
| `POST /api/orders` | 5 / menit | pintu masuk spam order paling nyata |
| `POST /api/auth/login` | 10 / 15 menit | perlambat brute force |
| `GET /api/menu/*`, `GET /api/orders/code/:code` | 120 / menit | dibuka berulang, murah |
| Rute staff lain (ber-JWT) | 300 / menit | jaring pengaman, bukan pembatas nyata |
| Global default | 200 / menit | |

Lewat batas → `429` + header `retry-after`:
```json
{ "error": { "code": "RATE_LIMITED", "message": "Terlalu banyak permintaan. Coba lagi dalam 42 detik." } }
```

Di belakang Caddy, aktifkan `trustProxy: true` di Fastify. Tanpa itu semua request terlihat berasal dari `127.0.0.1` dan satu pelanggan bisa menghabiskan kuota semua orang.

## Modul `auth`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/auth/login` | publik | `{ username, password }` → `{ token, user }`. Gagal → 401 (pesan sama untuk user salah & password salah) |
| `GET` | `/auth/me` | any | user dari token |
| `POST` | `/auth/logout` | any | no-op di server (JWT stateless); klien hapus token |
| `GET` | `/auth/users` | admin | daftar user |
| `POST` | `/auth/users` | admin | buat user |
| `PATCH` | `/auth/users/:id` | admin | ubah nama/role/`is_active` |
| `PATCH` | `/auth/users/:id/password` | admin \| diri sendiri | ganti password |

`passwordHash` tidak pernah ikut di response mana pun. JWT berisi `{ sub, role, outlet_id }`, masa hidup 8 jam.

## Modul `menu`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/menu` | **publik** | menu lengkap untuk pelanggan: kategori aktif + item aktif (termasuk yang habis, ditandai). Satu request, siap render |
| `GET` | `/menu/categories` | any | daftar kategori |
| `POST` | `/menu/categories` | admin | buat kategori |
| `PATCH` | `/menu/categories/:id` | admin | ubah nama/urutan/aktif |
| `DELETE` | `/menu/categories/:id` | admin | soft delete. Masih ada item → 409 |
| `GET` | `/menu/items` | any | list + filter `category_id`, `q`, `is_available` |
| `POST` | `/menu/items` | admin | buat item |
| `PATCH` | `/menu/items/:id` | admin | ubah item |
| `PATCH` | `/menu/items/:id/availability` | kasir \| admin | **toggle habis/tersedia** → emit `menu:availability` |
| `DELETE` | `/menu/items/:id` | admin | soft delete (`is_active = false`) |
| `POST` | `/menu/items/:id/image` | admin | `multipart/form-data`, field `file`. Maks 5MB, `image/jpeg\|png\|webp`. Di-resize 800px, disimpan `.webp` |

Toggle ketersediaan dibuka untuk `kasir` supaya barista tidak perlu memanggil admin saat stok habis di tengah jam sibuk.

## Modul `table`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/tables/resolve/:qr_token` | **publik** | QR → `{ id, number, location }`. Token mati/tak ada → 404. Dipakai `customer-menu` saat halaman dibuka |
| `GET` | `/tables` | any | daftar meja + status |
| `POST` | `/tables` | admin | buat meja (`qr_token` digenerate server) |
| `PATCH` | `/tables/:id` | admin | ubah nomor/kapasitas/lokasi/status |
| `POST` | `/tables/:id/qr/regenerate` | admin | token baru — **QR lama langsung mati** |
| `GET` | `/tables/:id/qr.png` | admin | PNG siap cetak (query `size`, default 512) |
| `GET` | `/tables/:id/qr.svg` | admin | SVG untuk cetak tajam |
| `DELETE` | `/tables/:id` | admin | soft delete |

QR berisi URL penuh: `https://<host>/?t=<qr_token>`. Frontend membaca `?t=`, memanggil `resolve`, menyimpan `table_id` di state (bukan `localStorage` permanen — meja bisa berpindah).

## Modul `order`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/orders` | **publik** | checkout pelanggan. Rate limit 5/menit |
| `POST` | `/orders/manual` | kasir \| admin | input manual kasir (walk-in/takeaway), boleh langsung lunas |
| `GET` | `/orders` | kasir \| admin | list + filter `status`, `payment_status`, `date_from`, `date_to`, `table_id`, `q` |
| `GET` | `/orders/active` | kasir \| admin | belum `diambil`/`dibatalkan`, urut `created_at` |
| `GET` | `/orders/:id` | kasir \| admin | detail + item + timeline event |
| `GET` | `/orders/code/:order_code` | **publik** | untuk halaman status pelanggan. Hanya field aman: kode, status, item, total, waktu. **Tanpa** data staff |
| `PATCH` | `/orders/:id/status` | kasir \| admin | ubah status (validasi transisi) |
| `PATCH` | `/orders/:id/payment` | kasir \| admin | tandai lunas |
| `PATCH` | `/orders/:id/discount` | kasir \| admin | diskon manual, hitung ulang `total`. Order lunas → 409 |
| `POST` | `/orders/:id/cancel` | kasir \| admin | `{ reason }` → status `dibatalkan` |
| `GET` | `/orders/:id/receipt` | kasir \| admin | data struk (nama cafe, alamat, item, total, footer, nama kasir) |

### `POST /orders` — checkout pelanggan

```json
{
  "qr_token": "V1StGXR8_Z5jdHi6B-myT_aBcDeFgHiJ",
  "customer_name": "Allan",
  "note": "pedas sedikit",
  "items": [
    { "menu_item_id": "kQ7x...", "qty": 2, "note": "tanpa gula" },
    { "menu_item_id": "mB3z...", "qty": 1 }
  ]
}
```

Klien **tidak** mengirim harga. Server mengambil `price` dari DB. Kalau harga ikut dari klien, siapa pun bisa memesan kopi seharga Rp 1 dengan mengubah request.

`201`:
```json
{ "data": { "id": "oQ2...", "order_code": "A7-0042", "status": "baru",
            "table": { "number": "7" }, "subtotal": 45000, "tax_amount": 0,
            "total": 45000, "payment_status": "belum_bayar",
            "items": [ { "name_snapshot": "Kopi Susu", "price_snapshot": 18000,
                         "qty": 2, "subtotal": 36000, "note": "tanpa gula" } ],
            "created_at": "2026-09-04T07:44:12.000Z" } }
```

Error khusus:
```json
{ "error": { "code": "ITEM_UNAVAILABLE", "message": "Beberapa item sudah habis",
             "fields": { "items": "Kopi Susu, Croissant" } } }
```
Ketersediaan divalidasi ulang di dalam transaksi checkout, bukan hanya saat menu dimuat — jeda antara pelanggan membuka menu dan menekan bayar bisa beberapa menit.

### `PATCH /orders/:id/payment`

```json
{ "payment_method": "cash", "paid_amount": 50000 }
```
→ hitung `change_amount`, set `paid_at`, `payment_status: "lunas"`, emit `order:paid`.
`cash` dengan `paid_amount < total` → 409 `PAYMENT_INSUFFICIENT`. `transfer`/`qris_manual` → `paid_amount` opsional (dianggap pas). Order sudah lunas → 409 `ORDER_ALREADY_PAID`.

## Modul `kitchen`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/kitchen/queue` | dapur \| kasir \| admin | antrian: status `baru`, `dikonfirmasi`, `diproses`, urut `created_at` ASC. Sertakan `elapsed_seconds` |
| `PATCH` | `/kitchen/orders/:id/status` | dapur \| kasir \| admin | `dikonfirmasi` \| `diproses` \| `selesai` |
| `GET` | `/kitchen/stats` | dapur \| kasir \| admin | jumlah per status + rata-rata waktu saji hari ini |

Rute terpisah dari `/orders` walau menyentuh tabel yang sama: role `dapur` hanya boleh mengubah status, tidak boleh melihat uang atau membatalkan order. Batas kewenangan lebih mudah dijaga saat rutenya berbeda.

## Modul `report`

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/reports/summary` | admin \| kasir | `?date_from&date_to` → omzet, jumlah order, rata-rata per order, rincian metode bayar |
| `GET` | `/reports/revenue` | admin \| kasir | `?group_by=day\|week\|month` → seri waktu untuk grafik |
| `GET` | `/reports/top-items` | admin \| kasir | `?limit=10` → qty & nilai per item |
| `GET` | `/reports/export/orders.csv` | admin | CSV per order |
| `GET` | `/reports/export/items.csv` | admin | CSV per item terjual |
| `GET` | `/reports/export/revenue.csv` | admin | CSV rekap harian |

Semua laporan menghitung `payment_status = 'lunas'` saja, dasar tanggal `paid_at` (bukan `created_at`) — order yang dibuat jam 23.50 dan dibayar 00.10 masuk omzet hari pembayaran. Rentang default: hari ini. Maksimum rentang 1 tahun per request.

CSV: `Content-Disposition: attachment`, pemisah `,`, dengan BOM UTF-8 supaya Excel Indonesia tidak merusak karakter. Angka rupiah ditulis sebagai integer polos tanpa pemisah ribuan, supaya bisa dijumlahkan di spreadsheet.

## Modul `settings` & health

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/settings` | any | pengaturan outlet |
| `PATCH` | `/settings` | admin | pajak, service, footer struk, `auto_confirm_order` |
| `GET` | `/health` | publik | `{ status, uptime, db }` — `db` diuji `SELECT 1` |

## WebSocket (Socket.io)

Path `/socket.io`. Nama event dan tipe payload didefinisikan sekali di `packages/shared/src/events.ts` dan dipakai kedua sisi — supaya salah tulis nama event ketahuan saat compile, bukan saat cafe ramai.

### Handshake

Staff (kasir/KDS) mengirim token; pelanggan tidak:
```ts
io(URL, { auth: { token } })          // staff
io(URL)                                // pelanggan (publik)
```
Token tidak valid → koneksi ditolak. Tanpa token, socket tetap tersambung tapi hanya boleh join room `menu` dan `order:<id>` miliknya.

### Room

| Room | Siapa | Cara masuk |
|---|---|---|
| `menu` | semua klien, termasuk publik | auto-join saat connect |
| `kitchen` | role `dapur`/`kasir`/`admin` | auto-join dari role di JWT |
| `kasir` | role `kasir`/`admin` | auto-join dari role di JWT |
| `order:<order_id>` | pelanggan pemilik order | emit `order:subscribe` dengan `order_code` |

Otorisasi room di sisi server berdasarkan JWT, bukan berdasarkan permintaan klien. Kalau klien bebas memilih room, layar dapur bisa disadap dari luar.

### Server → client

| Event | Room | Trigger | Payload |
|---|---|---|---|
| `order:new` | `kitchen`, `kasir` | order dibuat (checkout / manual) | order lengkap + item + meja |
| `order:updated` | `kitchen`, `kasir` | status/diskon berubah | `{ id, order_code, status, total, updated_at }` |
| `order:paid` | `kasir` | pembayaran ditandai | `{ id, order_code, payment_method, total, paid_at }` |
| `order:status` | `order:<id>` | status order berubah | `{ order_code, status, at }` |
| `order:cancelled` | `kitchen`, `kasir`, `order:<id>` | order dibatalkan | `{ id, order_code, reason }` |
| `menu:availability` | `menu` | toggle habis/tersedia | `{ menu_item_id, is_available }` |
| `menu:updated` | `menu` | item/kategori dibuat/diubah/dihapus | `{ action, menu_item_id? , category_id? }` |
| `table:updated` | `kasir` | status meja berubah | `{ id, number, status }` |

### Client → server

| Event | Payload | Efek |
|---|---|---|
| `order:subscribe` | `{ order_code }` | server verifikasi kode → join `order:<id>`. Tidak ada → tidak join, kirim `error` |
| `order:unsubscribe` | `{ order_code }` | keluar room |

Semua mutasi lewat REST, tidak lewat socket. Socket hanya untuk siaran perubahan. Satu jalur tulis = validasi, auth, rate limit, dan error handling tidak perlu ditulis dua kali.

### Aturan emit (server)

1. Emit **setelah** transaksi DB commit. Emit di dalam transaksi berisiko menyiarkan data yang kemudian di-rollback.
2. `order:new` membawa order lengkap supaya KDS bisa merender tanpa request tambahan; event lain cukup ringkas dan klien menyusul dengan `invalidateQueries`.
3. Tidak ada data sensitif ke room publik: room `order:<id>` tidak pernah berisi nama kasir, `paid_amount`, atau data user.

### Reliabilitas di klien

```ts
socket.on('connect',    () => queryClient.invalidateQueries())  // susul event terlewat
socket.on('disconnect', () => setOffline(true))                  // tampilkan indikator
```
Socket untuk kecepatan, HTTP untuk kebenaran. Tanpa refetch saat reconnect, tablet dapur yang WiFi-nya sempat drop akan kehilangan order — kegagalan paling mahal di sistem ini. Indikator offline wajib tampil di KDS dan kasir supaya staf tahu layarnya sedang tidak dipercaya.

## Validasi Zod

Sumber tunggal di `packages/shared/src/schemas/`, dipakai backend (validasi) dan frontend (tipe form). Satu definisi, dua pemakaian — aturan tidak bisa melenceng antara klien dan server.

```ts
// packages/shared/src/schemas/order.ts
import { z } from 'zod';

export const rupiah = z.number().int().nonnegative();   // uang: SELALU integer

export const orderItemInput = z.object({
  menu_item_id: z.string().length(21),
  qty: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).optional(),
});

export const createOrderInput = z.object({
  qr_token: z.string().length(32),
  customer_name: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(500).optional(),
  items: z.array(orderItemInput).min(1, 'minimal 1 item').max(50),
});

export const paymentInput = z.object({
  payment_method: z.enum(['cash', 'transfer', 'qris_manual']),
  paid_amount: rupiah.optional(),
}).refine(v => v.payment_method !== 'cash' || v.paid_amount !== undefined,
          { message: 'paid_amount wajib untuk cash', path: ['paid_amount'] });

export const menuItemInput = z.object({
  category_id: z.string().length(21),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  price: rupiah,                       // bukan z.number() — Rp 15000.5 tidak ada
  sort_order: z.number().int().default(0),
});

export type CreateOrderInput = z.infer<typeof createOrderInput>;
```

Dipasang di Fastify lewat satu preHandler, bukan `try/catch` di tiap route:

```ts
// apps/api/src/lib/validate.ts
export const body = <T extends z.ZodTypeAny>(schema: T) =>
  async (req: FastifyRequest) => { req.body = schema.parse(req.body); };

// order.routes.ts
app.post('/orders', { preHandler: body(createOrderInput) }, handler);
```

Error handler global menerjemahkan `ZodError` → `400 VALIDATION_FAILED` dengan `fields` per path, jadi frontend bisa menempelkan pesan ke input yang salah.

Yang tidak bisa diwakili Zod (ketersediaan item, transisi status sah, kecukupan pembayaran) divalidasi di `service` dan menghasilkan `409`, karena bergantung pada state database, bukan pada bentuk request.
