# Checklist Keamanan Pra-Publik — Sistem Cafe

Dijalankan sebelum sistem menghadap internet, dan sekali lagi setelah tiap perubahan auth/upload/rute publik.

**Terakhir dijalankan**: 2026-09-06, terhadap dev lokal (SQLite WAL, API `:3000`). Hasil per item di bawah.

---

## 1. Rahasia tidak pernah masuk git

```bash
git log --all --diff-filter=A --name-only --format="" | grep -xE '\.env|\.env\..*'
git ls-files | grep -iE '\.env$|\.pem$|\.key$|id_rsa|credential'
git log -p --all | grep -inE '^\+.*(password|secret|token)\s*=\s*["\x27][^"\x27]{8,}'
```

✅ Hanya `.env.example` yang pernah ditambahkan. Tidak ada `.pem`/`.key`/kredensial terlacak. Nilai yang muncul di riwayat semuanya placeholder (`PASSWORD_KUAT`, `ganti-dengan-…`) atau kredensial dev lokal yang memang dipublikasikan (`root:root`).

Kalau pernah bocor: **rotasi rahasianya**, jangan cuma hapus filenya. Riwayat git sudah menyebar ke setiap klon.

## 2. Rute publik memang hanya yang seharusnya

Lima rute tanpa `preHandler` auth, semuanya disengaja:

| Rute | Alasan | Rate limit |
|---|---|---|
| `POST /api/auth/login` | pintu masuk | 10 / 15 menit |
| `GET /api/menu` | isi menu memang publik | 120 / menit |
| `POST /api/orders` | pelanggan pesan tanpa akun | **5 / menit** |
| `GET /api/orders/code/:orderCode` | halaman status pelanggan | 120 / menit |
| `GET /api/tables/resolve/:qrToken` | scan QR | 120 / menit |

✅ Terverifikasi. Deteksi ulang:

```bash
node -e '
const fs=require("node:fs"), d="apps/api/src/modules";
for (const m of fs.readdirSync(d))
  for (const f of fs.readdirSync(`${d}/${m}`).filter(x=>x.endsWith(".routes.ts"))) {
    const src=fs.readFileSync(`${d}/${m}/${f}`,"utf8");
    const re=/app\.(get|post|patch|delete)\(\s*(["\x27`])([^"\x27`]*)\2\s*,?\s*(\{[\s\S]{0,300}?\})?/g;
    let x; while ((x=re.exec(src)))
      if (!(x[4] && /autentikasi|wajibRole|staff|baca|admin/.test(x[4])))
        console.log(`TANPA-AUTH ${x[1].toUpperCase()} ${x[3]}  ${d}/${m}/${f}`);
  }'
```

Rute baru yang muncul di daftar ini dan **bukan** salah satu dari lima di atas = bug.

## 3. Rute staff menolak akses tanpa token

✅ `orders/active`, `auth/users`, `kitchen/queue`, `settings`, `reports/summary`, `menu/items` → semua **401** tanpa `Authorization`.

## 4. JWT tidak bisa dipalsukan

✅ Token asal-asalan → 401 · signature diganti → 401 · token asli → 200 · masa hidup 8 jam (`exp - iat = 28800`), sesuai docs.

## 5. Batas role ditegakkan server, bukan cuma UI

✅ Diuji dengan akun role `kasir`:

| Aksi | Hasil |
|---|---|
| `GET /reports/summary` | 200 — boleh |
| `GET /reports/export/orders.csv` | **403** |
| `GET /auth/users` | **403** |
| `PATCH /kitchen/orders/:id/status` body `{status:"dibatalkan"}` | **400** — dapur tidak boleh membatalkan |

## 6. Cafe tidak bisa terkunci

✅ Admin aktif terakhir: diturunkan role → **403**, dinonaktifkan → **403**. Pesan: "Ini admin aktif terakhir. Buat admin lain dulu."

## 7. Harga selalu dari DB

✅ `POST /api/orders` dengan body berisi `price: 1`, `priceSnapshot: 1`, `subtotal: 1` → server tetap memakai Rp 15.000 dari DB. Klien tidak bisa menentukan harga.

## 8. Rute publik tidak membocorkan data internal

✅ `GET /orders/code/:code` → tanpa `paidAmount`, `changeAmount`, `paymentMethod`, `id`, atau data staff.
✅ `GET /tables/resolve/:token` → hanya `{id, number, location}`; `qrToken` dan `outletId` tidak dikirim balik.
✅ Token QR ngawur → 404, tanpa membocorkan apakah panjangnya benar.

## 9. Room socket ditentukan server dari JWT

✅ Klien socket **tanpa token** tidak menerima satu pun event saat order baru dibuat. Room `kitchen`/`kasir` di-join server berdasarkan `role` di JWT, bukan atas permintaan klien. Kalau klien bebas memilih room, layar dapur bisa disadap dari luar.

## 10. Upload dibatasi

✅ File `.sh` dengan mime jujur → 400 · mime **dipalsukan** jadi `image/png`, isi tetap skrip → 400 (`sharp` memvalidasi isi, bukan mime) · JPEG 1200×900 asli → 200, tersimpan sebagai `.webp` 800×600.

Batas: 5MB (`@fastify/multipart` `fileSize` + cek `byteLength`), satu file per request, mime hanya `image/jpeg|png|webp`.

## 11. Static `/uploads` tidak bisa ditembus

✅ `../.env` → 404 · `..%2f..%2f.env` → 403 · `../../../.env` → 404 · `menu/../../../.env` → 404.

## 12. Rate limit aktif dan formatnya benar

✅ 12× login gagal beruntun → 401 ×10 lalu **429** ×2. Body 429 mengikuti format standar:

```json
{"error":{"code":"RATE_LIMITED","message":"Terlalu banyak permintaan. Coba lagi sebentar."}}
```

⚠️ `@fastify/rate-limit` menyimpan hitungan **di memori**. Restart proses mereset semua window, dan `instances > 1` di PM2 berarti tiap proses punya hitungan sendiri. Cukup untuk satu instance; butuh store Redis kalau nanti diskalakan.

## 13. Error tidak membocorkan internal di produksi

✅ `plugins/errors.ts` mengirim `"Terjadi kesalahan pada server"` saat `NODE_ENV=production`; detail hanya ke `req.log.error`. Di dev pesan asli ditampilkan supaya bisa didebug.

## 14. Aturan repo tidak dilanggar

```bash
grep -rnE ':\s*any\b|as any\b|@ts-ignore|@ts-expect-error' --include='*.ts' --include='*.tsx' apps packages
grep -rnE 'parseFloat|Number\.parseFloat|new Decimal' --include='*.ts' --include='*.tsx' apps packages
grep -rn 'setInterval' --include='*.ts' --include='*.tsx' apps packages
grep -rilE 'dockerfile|docker-compose|dockerignore' . | grep -v node_modules
```

✅ Tidak ada `any`/`ts-ignore`. Tidak ada `parseFloat`/`Decimal` (satu-satunya kecocokan adalah komentar larangan di `money.ts`).
✅ Satu `setInterval` di `apps/kitchen-display/src/hooks/useLayar.ts:58` — tick jam lokal untuk menggerakkan timer kartu, **bukan** polling data; tidak ada request di dalamnya.
✅ Tidak ada artefak Docker (kecocokan hanya di docs yang melarangnya).

---

## Belum diverifikasi — wajib dikerjakan di VPS sungguhan

Butuh server; tidak bisa diuji dari mesin dev.

- [ ] **User DB non-root.** `.env` produksi memakai user `webcafe` dengan password kuat, bukan `root:root`.
- [ ] **File `data/data.db` tidak ter-expose** via static (sudah di luar `uploads`). DB file tidak boleh bisa diunduh.
- [ ] **Firewall**: hanya 80/443 (dan SSH) terbuka. Port 3000 dan 3306 tidak boleh terjangkau dari internet — Caddy yang mem-proxy.
- [ ] **`JWT_SECRET` acak** hasil `openssl rand -hex 32`, bukan nilai contoh. Backend menolak start kalau < 32 karakter, tapi tidak bisa tahu nilainya masih placeholder.
- [ ] **`NODE_ENV=production`** benar-benar terpasang — ini yang mengaktifkan penyembunyian error dan mematikan CORS terbuka.
- [ ] **HTTPS aktif** dengan sertifikat valid (Caddy otomatis). JWT lewat HTTP polos bisa disadap di WiFi cafe.
- [ ] **Restore backup diuji** ke DB terpisah. Backup yang belum pernah di-restore belum terbukti backup. Prosedur ada di `scripts/backup.sh`.
- [ ] **Salinan backup di luar VPS.** Disk yang mati membawa backup-nya sekalian.
- [ ] **Password admin seed diganti** setelah pemasangan.
- [ ] **Cetak struk diuji di printer thermal fisik** (baru diuji lewat print preview).
- [ ] **CSV dibuka di Excel sungguhan** — BOM UTF-8 dan CRLF sudah benar secara byte, tapi belum dibuka di Excel.

## Utang keamanan yang diterima sadar

Bukan bug; keputusan dengan konsekuensi yang diketahui. Lihat juga [arsitektur.md](./arsitektur.md#utang-teknis-yang-diterima-sadar).

- **Tanpa refresh token** → JWT 8 jam, kasir login ulang tiap shift. Token yang dicuri berlaku sampai kedaluwarsa; tidak ada mekanisme pencabutan.
- **Logout hanya di klien** → JWT stateless, server tidak menyimpan daftar token yang dicabut.
- **Rate limit in-memory** → lihat item 12.
- **Order pelanggan tanpa akun** → rawan spam. Diredam rate limit 5/menit per IP + `qrToken` yang bisa dicabut. Bukan pencegahan mutlak.
- **`qris_manual` bukan rekonsiliasi otomatis** → kasir yang memutuskan lunas. Webhook payment gateway di Fase 8.
- **Upload ke disk lokal** → tidak ada pemindaian malware. Diredam: `sharp` menulis ulang seluruh gambar jadi `.webp`, jadi payload yang ditanam di file asli tidak ikut tersimpan.
