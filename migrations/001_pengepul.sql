-- Migrasi untuk database LAMA: izinkan role 'pengepul' pada users.
-- SQLite tidak bisa mengubah CHECK, jadi tabel users dibangun ulang (data tetap).
-- Aman dijalankan di Cloudflare Studio (perintah dijalankan satu per satu) maupun wrangler:
-- tabel yang merujuk users dikosongkan sementara (isinya dicadangkan dulu), sehingga tidak ada pelanggaran foreign key.
-- Urutan:
--   1) wrangler d1 export biogester --remote --output=backup.sql      (cadangan, sangat disarankan)
--   2) jalankan schema.sql   (membuat tabel penjualan & delegasi bila belum ada)
--   3) jalankan file ini
--   4) jalankan seed.sql     (opsional: kategori baru)
-- Jika file berhenti di tengah, data aman di tabel _*_bak: perbaiki masalahnya lalu jalankan ulang dari awal.
-- Database baru TIDAK perlu file ini.

DROP TABLE IF EXISTS _users_bak;
DROP TABLE IF EXISTS _setoran_bak;
DROP TABLE IF EXISTS _penukaran_bak;
DROP TABLE IF EXISTS _penjualan_bak;
DROP TABLE IF EXISTS _delegasi_bak;
DROP TABLE IF EXISTS _notifikasi_bak;
DROP TABLE IF EXISTS _notif_bak;

CREATE TABLE _users_bak AS SELECT * FROM users;
CREATE TABLE _setoran_bak AS SELECT * FROM setoran;
CREATE TABLE _penukaran_bak AS SELECT * FROM penukaran;
CREATE TABLE _penjualan_bak AS SELECT * FROM penjualan;
CREATE TABLE _delegasi_bak AS SELECT * FROM delegasi;
CREATE TABLE _notifikasi_bak AS SELECT * FROM notifikasi;

DELETE FROM notifikasi;
DELETE FROM delegasi;
DELETE FROM penjualan;
DELETE FROM penukaran;
DELETE FROM setoran;

DROP TABLE users;
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no_hp TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'nasabah' CHECK (role IN ('nasabah','admin_tps','pengepul','super_admin')),
  tps_id INTEGER REFERENCES tps(id) ON DELETE SET NULL,
  aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO users(id,no_hp,nama,pin_hash,role,tps_id,aktif,created_at)
  SELECT id,no_hp,nama,pin_hash,role,tps_id,aktif,created_at FROM _users_bak;

INSERT INTO setoran SELECT * FROM _setoran_bak;
INSERT INTO penukaran SELECT * FROM _penukaran_bak;
INSERT INTO penjualan SELECT * FROM _penjualan_bak;
INSERT INTO delegasi SELECT * FROM _delegasi_bak;
INSERT INTO notifikasi SELECT * FROM _notifikasi_bak;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

DROP TABLE _users_bak;
DROP TABLE _setoran_bak;
DROP TABLE _penukaran_bak;
DROP TABLE _penjualan_bak;
DROP TABLE _delegasi_bak;
DROP TABLE _notifikasi_bak;
