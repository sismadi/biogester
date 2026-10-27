# Basadi – Bank Sampah Digital

Aplikasi web (PWA-ready, mobile-first) untuk setor sampah, saldo, penukaran, lokasi TPS, edukasi dan notifikasi.
Peran: **Pengguna (nasabah)**, **Petugas (admin TPS)**, **Pengepul**, **Admin (super admin)**.

## Arsitektur

```
GitHub ──(Workers Builds)──▶ Cloudflare Worker "bsd"
                              ├─ public/            Frontend: HTML + CSS + JS (aset statis Cloudflare)
                              ├─ src/worker.js      Gateway backend: sesi, role, CSRF, routing
                              │   └─ src/services/  auth · setoran · penukaran · dompet · master · penjualan · delegasi · pasar · backup
                              └─ D1 (SQLite)        binding DB  ← schema.sql
Rahasia & env: Cloudflare (secret SESSION_SECRET, CAPTCHA_SECRET; vars di wrangler.toml)
```

- **Frontend** dan **backend** terpisah tegas: frontend hanya bicara lewat `/api/*` (`public/js/api.js`).
- Tiap **service** hanya mendaftarkan route ke router → bisa dipecah menjadi Worker sendiri (service binding) tanpa mengubah logika.
- **DRY**: satu `validate()`, satu `crud()` factory (jenis sampah/TPS/edukasi), satu `formHtml()`, satu `api`, menu digerakkan tabel `ROUTES`.

## Fitur Pengepul, Delegasi, Pencarian Setor
- **Pengepul** (role `pengepul`): petugas TPS menjual stok ke pengepul (menu *Penjualan*), pengepul menerima/menolak di menu *Pembelian*. Stok = setoran disetujui − penjualan aktif, dihitung (bukan disimpan); penjualan dibuat atomik sehingga tidak bisa melebihi stok.
- **Delegasi** (menu *Delegasi*): cari pengguna → jadikan Petugas TPS / Pengepul, atau cabut kembali. Admin bisa semua; Petugas hanya mengangkat/mencabut petugas di TPS-nya sendiri. Semua perubahan tercatat di tabel `delegasi` + notifikasi ke yang bersangkutan.
- **Setor sampah**: pencarian cepat (nama/kode/kategori, Enter memilih hasil pertama), filter kategori, dan ikon per kategori (`KATEGORI_ICON` di `public/js/ui.js`; kategori baru otomatis memakai ikon kotak).

## Marketplace POC (menu *Pasar* & *Toko*)
Sesuai alur "Sistem Terpadu BioGester": sampah organik → BioGester → biogas & POC → marketplace digital POC. Semua peran dapat membeli, dan setiap akun dapat membuka **satu toko**.
- **Toko Saya** (`toko`): profil toko (nama, deskripsi, alamat, kontak WhatsApp, logo) + **katalog produk** (nama, kategori POC/Kompos/Perlengkapan/Lainnya, satuan, harga, stok, foto, tampil/sembunyikan) + **pesanan masuk** (Terima / Tolak / Selesai).
- **Pasar** (`pasar`): etalase produk dengan pencarian & filter kategori, daftar toko (profil + katalog), dan **Pesanan saya** (pembeli dapat membatalkan selama masih menunggu).
- **Stok** tersedia = `produk.stok` − pesanan (menunggu/diproses/selesai); dihitung, bukan disimpan. Pesanan dibuat atomik (`INSERT … SELECT … WHERE stok cukup`), jadi tidak bisa melebihi stok walau dipesan bersamaan; pesanan ditolak/dibatalkan otomatis mengembalikan stok.
- **Alur status**: `menunggu → diproses → selesai`; penjual dapat menolak (`ditolak`), pembeli dapat `dibatalkan` saat menunggu. Tiap perubahan mengirim notifikasi ke pihak lawan.
- **Pembayaran** langsung antara pembeli dan penjual (ambil di toko / COD); aplikasi hanya mencatat pesanan. Integrasi pembayaran/saldo Basadi bisa ditambahkan di `services/pasar.js`.
- **Privasi**: hanya `kontak` yang sengaja diisi di profil toko yang tampil ke pembeli. No HP pembeli hanya terlihat oleh penjual yang menerima pesanannya.
- Foto produk/toko dikompres di perangkat, disimpan di D1, dan disajikan lewat `/api/produk/:id/foto` & `/api/toko/:id/foto` (daftar produk tidak membawa data foto).
- Tabel baru: `toko`, `produk`, `pesanan` (sudah masuk backup/restore).

**Upgrade database lama** (data yang ada tidak berubah, aman diulang): `npm run db:schema` lalu `npm run deploy`.

## Backup & Restore (menu *Backup*, hanya Admin)
- **Backup**: unduh seluruh data (pengguna, transaksi, master data, foto) sebagai satu berkas JSON. Wajib konfirmasi PIN. Berkas memuat hash PIN → simpan aman.
- **Restore**: mengganti **seluruh** data dengan isi berkas, dalam satu batch D1 (atomik: gagal = data tidak berubah). Berkas divalidasi dulu (format, tabel/kolom dikenal, minimal satu admin aktif); wajib PIN + mengetik `PULIHKAN`.
- Tabel baru: daftarkan namanya di `TABLES` pada `src/services/backup.js` (urutan induk → anak); kolomnya dibaca otomatis dari skema.
- Untuk data sangat besar atau backup terjadwal, gunakan `npx wrangler d1 export bsd --remote --output=backup.sql` (dan `d1 execute --file` untuk memulihkan) atau Cloudflare D1 Time Travel.

## Keamanan
- Captcha penjumlahan stateless: jawaban tidak pernah dikirim ke browser (HMAC dengan `CAPTCHA_SECRET`), kedaluwarsa 5 menit, sekali pakai (tabel `captcha_used`).
- Sesi: cookie `HttpOnly; Secure; SameSite=Strict` berisi token HMAC (`SESSION_SECRET`); akun dimuat ulang dari D1 tiap request.
- PIN di-hash PBKDF2-SHA256 (bukan PIN polos seperti di `kepik.sql`).
- Saldo **dihitung** dari transaksi (tidak disimpan) dan penukaran dibuat atomik → tidak bisa tarik ganda.
- Header CSP ketat (`public/_headers`), cek Origin untuk request tulis, semua query memakai bind.

## Setup (sekali)
```bash
npm install
npx wrangler login
npx wrangler d1 create bsd            # salin database_id ke wrangler.toml
npm run db:schema && npm run db:seed        # buat tabel + data contoh
npx wrangler secret put SESSION_SECRET      # isi string acak panjang (mis. openssl rand -hex 32)
npx wrangler secret put CAPTCHA_SECRET      # string acak lain
node scripts/make-admin.mjs 0812xxxxxxxx "Nama Anda" 123456 > admin.sql
npx wrangler d1 execute bsd --remote --file=admin.sql   # super admin pertama
npm run deploy
```
Lokal: salin `.dev.vars.example` → `.dev.vars`, lalu `npm run db:local && npm run dev`.

## Upgrade database lama (sebelum fitur pengepul)
Urutan (boleh lewat wrangler maupun Cloudflare Studio, perintah dijalankan satu per satu):
```bash
npx wrangler d1 export bsd --remote --output=backup.sql                   # cadangan dulu
npm run db:schema                                                          # tabel penjualan, delegasi (IF NOT EXISTS, aman diulang)
npx wrangler d1 execute bsd --remote --file=migrations/001_pengepul.sql   # izinkan role pengepul, data tetap
npm run db:seed                                                            # kategori baru (opsional)
```
Database baru cukup `db:schema` + `db:seed`.

## Hubungkan GitHub → Cloudflare
1. `git init && git add . && git commit -m "Basadi" && git remote add origin <repo> && git push -u origin main`
2. Cloudflare Dashboard → **Workers & Pages → Create → Import a repository** → pilih repo.
3. Deploy command: `npx wrangler deploy` (build command dikosongkan). Setiap `git push` ke `main` otomatis deploy.
4. Pastikan secret ada di **Settings → Variables and Secrets** milik Worker (bukan di repo).

## Catatan
- Login memakai **No HP + PIN + captcha**. OTP (sesuai proposal) butuh gateway SMS/WhatsApp berbayar; titik pasangnya `src/services/auth.js`.
- Foto setoran dikompres di perangkat lalu disimpan di D1. Untuk volume besar pindahkan ke R2.
- Pembayaran DANA/OVO/GoPay dicatat dan diproses manual oleh admin; integrasi payout API bisa ditambah di `services/penukaran.js`.
- Untuk captcha yang lebih kuat, ganti `lib/captcha.js` dengan Cloudflare Turnstile (antarmuka `issue/check` tetap sama).
- Aktifkan Cloudflare Rate Limiting pada `/api/auth/*`.

## Demo 3 peran
```bash
npm run demo          # buat akun demo + contoh transaksi (aman diulang = reset)
npm run demo:clean    # hapus semua data demo
```
| Peran | No HP | PIN |
|---|---|---|
| Admin | 08990000001 | 123456 |
| Petugas (TPS Bank Sampah Cinta) | 08990000002 | 123456 |
| Pengguna | 08990000003 | 123456 |
| Pengepul | 08990000004 | 123456 |

**Jangan biarkan akun demo aktif di produksi** – jalankan `npm run demo:clean` sebelum dipakai sungguhan.
