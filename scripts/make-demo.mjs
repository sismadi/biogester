// Membuat SQL demo 3 peran + contoh transaksi (idempotent: aman dijalankan berulang).
//   node scripts/make-demo.mjs > demo.sql          -> buat/reset data demo
//   node scripts/make-demo.mjs clean > clean.sql   -> hapus semua data demo
// PIN demo di-hash saat skrip dijalankan; demo.sql tidak ikut git (lihat .gitignore).
import { hashPin } from '../src/lib/crypto.js';

const PIN = '123456';
const USERS = [
  { hp: '08990000001', nama: 'Admin Demo', role: 'super_admin', tps: 'NULL' },
  { hp: '08990000002', nama: 'Petugas Demo', role: 'admin_tps', tps: '1' },
  { hp: '08990000003', nama: 'Pengguna Demo', role: 'nasabah', tps: 'NULL' },
  { hp: '08990000004', nama: 'Pengepul Demo', role: 'pengepul', tps: 'NULL' },
];
const list = USERS.map((u) => `'${u.hp}'`).join(',');
const uid = (hp) => `(SELECT id FROM users WHERE no_hp='${hp}')`;
const jenis = (kode) => `(SELECT id FROM jenis_sampah WHERE kode='${kode}')`;
const ids = `(SELECT id FROM users WHERE no_hp IN (${list}))`;

const tokoIds = `(SELECT id FROM toko WHERE user_id IN ${ids})`;
const reset = `DELETE FROM pesanan WHERE pembeli_id IN ${ids} OR toko_id IN ${tokoIds};
DELETE FROM produk WHERE toko_id IN ${tokoIds};
DELETE FROM toko WHERE user_id IN ${ids};
DELETE FROM penjualan WHERE pengepul_id IN ${ids} OR created_by IN ${ids};
DELETE FROM delegasi WHERE user_id IN ${ids} OR oleh IN ${ids};
DELETE FROM notifikasi WHERE user_id IN ${ids};
DELETE FROM penukaran WHERE user_id IN ${ids};
DELETE FROM setoran WHERE user_id IN ${ids};
DELETE FROM users WHERE no_hp IN (${list});`;

if (process.argv[2] === 'clean') { console.log(reset); process.exit(0); }

const [admin, petugas, pengguna, pengepul] = USERS.map((u) => u.hp);
const jual = (kode, j, berat, harga, status, ago) =>
  `INSERT INTO penjualan(kode,tps_id,pengepul_id,jenis_id,berat_kg,harga_per_kg,nilai,status,created_by,created_at)
   VALUES('${kode}',1,${uid(pengepul)},${jenis(j)},${berat},${harga},${Math.round(berat * harga)},'${status}',${uid(petugas)},datetime('now','-${ago} days'));`;
const setoran = (kode, j, berat, harga, status, ver, cat, ago) =>
  `INSERT INTO setoran(kode,user_id,jenis_id,tps_id,berat_kg,harga_per_kg,nilai,status,catatan,verified_by,created_at)
   VALUES('${kode}',${uid(pengguna)},${jenis(j)},1,${berat},${harga},${Math.round(berat * harga)},'${status}','${cat}',${ver ? uid(petugas) : 'NULL'},datetime('now','-${ago} days'));`;
const tukar = (kode, nominal, metode, tujuan, status, ago) =>
  `INSERT INTO penukaran(kode,user_id,nominal,metode,tujuan,status,processed_by,created_at)
   VALUES('${kode}',${uid(pengguna)},${nominal},'${metode}','${tujuan}','${status}',${status === 'menunggu' ? 'NULL' : uid(admin)},datetime('now','-${ago} days'));`;
const notif = (judul, isi, ago) =>
  `INSERT INTO notifikasi(user_id,judul,isi,created_at) VALUES(${uid(pengguna)},'${judul}','${isi}',datetime('now','-${ago} days'));`;

// Marketplace: Petugas Demo punya toko POC; Pengguna Demo memesan. Stok tersedia produk POC = 40 - 2 (selesai) - 1 (menunggu) = 37.
const tokoSql = `INSERT INTO toko(user_id,nama,deskripsi,alamat,kontak) VALUES(${uid(petugas)},'Toko BioGester Ciangsana','POC hasil pengolahan sampah organik rumah tangga di BioGester Desa Ciangsana.','Komp. TNI AL Ciangsana, Gunung Putri, Bogor','081234567890');`;
const produk = (nama, kat, satuan, harga, stok, desk) =>
  `INSERT INTO produk(toko_id,nama,kategori,satuan,harga,stok,deskripsi) VALUES((SELECT id FROM toko WHERE user_id=${uid(petugas)}),'${nama}','${kat}','${satuan}',${harga},${stok},'${desk}');`;
const pesan = (kode, nama, jumlah, harga, status, metode, ago) =>
  `INSERT INTO pesanan(kode,produk_id,toko_id,pembeli_id,nama_produk,jumlah,harga_satuan,total,metode,status,created_at)
   SELECT '${kode}',p.id,p.toko_id,${uid(pengguna)},p.nama,${jumlah},${harga},${jumlah * harga},'${metode}','${status}',datetime('now','-${ago} days') FROM produk p WHERE p.nama='${nama}' AND p.toko_id=(SELECT id FROM toko WHERE user_id=${uid(petugas)});`;

const pinHash = await hashPin(PIN);
console.log([
  reset,
  ...USERS.map((u) => `INSERT INTO users(no_hp,nama,pin_hash,role,tps_id) VALUES('${u.hp}','${u.nama}','${pinHash}','${u.role}',${u.tps});`),
  // Saldo akhir Pengguna Demo: (20.000 + 3.000) - (10.000 selesai + 10.000 menunggu) = Rp 3.000
  setoran('DEMO-S1', 'PLS-BTL', 5, 4000, 'disetujui', true, '', 6),
  setoran('DEMO-S2', 'KRT-KRN', 3, 1000, 'disetujui', true, '', 4),
  setoran('DEMO-S3', 'KRT-KDS', 2, 1500, 'menunggu', false, '', 0),
  setoran('DEMO-S4', 'PLS-GLS', 1, 2000, 'ditolak', true, 'Sampah belum dipilah', 2),
  // Stok TPS 1 setelah demo: botol 5-2=3 kg, koran 3-1=2 kg (kardus 2 kg masih menunggu verifikasi)
  jual('DEMO-J1', 'PLS-BTL', 2, 4500, 'diterima', 2),
  jual('DEMO-J2', 'KRT-KRN', 1, 1000, 'menunggu', 0),
  tukar('DEMO-T1', 10000, 'DANA', '08990000003', 'selesai', 3),
  tukar('DEMO-T2', 10000, 'GoPay', '08990000003', 'menunggu', 0),
  notif('Setoran disetujui', 'DEMO-S1: 5 kg diterima, saldo bertambah Rp 20.000.', 6),
  notif('Setoran ditolak', 'DEMO-S4 ditolak. Sampah belum dipilah', 2),
  notif('Penukaran berhasil', 'DEMO-T1: Rp 10.000 sudah dikirim.', 3),
  tokoSql,
  produk('POC BioGester', 'POC', 'botol 1 L', 15000, 40, 'Pupuk organik cair dari sampah organik rumah tangga. Kocok sebelum dipakai; campur 1:10 dengan air.'),
  produk('Kompos Padat', 'Kompos', 'kg', 5000, 25, 'Kompos matang dari residu BioGester.'),
  pesan('DEMO-P1', 'POC BioGester', 2, 15000, 'selesai', 'Ambil di toko', 3),
  pesan('DEMO-P2', 'POC BioGester', 1, 15000, 'menunggu', 'COD / diantar', 0),
].join('\n'));
