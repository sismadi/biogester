DELETE FROM pesanan WHERE pembeli_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004')) OR toko_id IN (SELECT id FROM toko WHERE user_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004')));
DELETE FROM produk WHERE toko_id IN (SELECT id FROM toko WHERE user_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004')));
DELETE FROM toko WHERE user_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004'));
DELETE FROM penjualan WHERE pengepul_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004')) OR created_by IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004'));
DELETE FROM delegasi WHERE user_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004')) OR oleh IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004'));
DELETE FROM notifikasi WHERE user_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004'));
DELETE FROM penukaran WHERE user_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004'));
DELETE FROM setoran WHERE user_id IN (SELECT id FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004'));
DELETE FROM users WHERE no_hp IN ('08990000001','08990000002','08990000003','08990000004');
INSERT INTO users(no_hp,nama,pin_hash,role,tps_id) VALUES('08990000001','Admin Demo','pbkdf2$100000$OVS9-Yzqay7cpbdvoT232g$4QBV5k4_7f5CwKZqIQrYsxS-xOjKCIrNQOV-dQ36KdA','super_admin',NULL);
INSERT INTO users(no_hp,nama,pin_hash,role,tps_id) VALUES('08990000002','Petugas Demo','pbkdf2$100000$OVS9-Yzqay7cpbdvoT232g$4QBV5k4_7f5CwKZqIQrYsxS-xOjKCIrNQOV-dQ36KdA','admin_tps',1);
INSERT INTO users(no_hp,nama,pin_hash,role,tps_id) VALUES('08990000003','Pengguna Demo','pbkdf2$100000$OVS9-Yzqay7cpbdvoT232g$4QBV5k4_7f5CwKZqIQrYsxS-xOjKCIrNQOV-dQ36KdA','nasabah',NULL);
INSERT INTO users(no_hp,nama,pin_hash,role,tps_id) VALUES('08990000004','Pengepul Demo','pbkdf2$100000$OVS9-Yzqay7cpbdvoT232g$4QBV5k4_7f5CwKZqIQrYsxS-xOjKCIrNQOV-dQ36KdA','pengepul',NULL);
INSERT INTO setoran(kode,user_id,jenis_id,tps_id,berat_kg,harga_per_kg,nilai,status,catatan,verified_by,created_at)
   VALUES('DEMO-S1',(SELECT id FROM users WHERE no_hp='08990000003'),(SELECT id FROM jenis_sampah WHERE kode='PLS-BTL'),1,5,4000,20000,'disetujui','',(SELECT id FROM users WHERE no_hp='08990000002'),datetime('now','-6 days'));
INSERT INTO setoran(kode,user_id,jenis_id,tps_id,berat_kg,harga_per_kg,nilai,status,catatan,verified_by,created_at)
   VALUES('DEMO-S2',(SELECT id FROM users WHERE no_hp='08990000003'),(SELECT id FROM jenis_sampah WHERE kode='KRT-KRN'),1,3,1000,3000,'disetujui','',(SELECT id FROM users WHERE no_hp='08990000002'),datetime('now','-4 days'));
INSERT INTO setoran(kode,user_id,jenis_id,tps_id,berat_kg,harga_per_kg,nilai,status,catatan,verified_by,created_at)
   VALUES('DEMO-S3',(SELECT id FROM users WHERE no_hp='08990000003'),(SELECT id FROM jenis_sampah WHERE kode='KRT-KDS'),1,2,1500,3000,'menunggu','',NULL,datetime('now','-0 days'));
INSERT INTO setoran(kode,user_id,jenis_id,tps_id,berat_kg,harga_per_kg,nilai,status,catatan,verified_by,created_at)
   VALUES('DEMO-S4',(SELECT id FROM users WHERE no_hp='08990000003'),(SELECT id FROM jenis_sampah WHERE kode='PLS-GLS'),1,1,2000,2000,'ditolak','Sampah belum dipilah',(SELECT id FROM users WHERE no_hp='08990000002'),datetime('now','-2 days'));
INSERT INTO penjualan(kode,tps_id,pengepul_id,jenis_id,berat_kg,harga_per_kg,nilai,status,created_by,created_at)
   VALUES('DEMO-J1',1,(SELECT id FROM users WHERE no_hp='08990000004'),(SELECT id FROM jenis_sampah WHERE kode='PLS-BTL'),2,4500,9000,'diterima',(SELECT id FROM users WHERE no_hp='08990000002'),datetime('now','-2 days'));
INSERT INTO penjualan(kode,tps_id,pengepul_id,jenis_id,berat_kg,harga_per_kg,nilai,status,created_by,created_at)
   VALUES('DEMO-J2',1,(SELECT id FROM users WHERE no_hp='08990000004'),(SELECT id FROM jenis_sampah WHERE kode='KRT-KRN'),1,1000,1000,'menunggu',(SELECT id FROM users WHERE no_hp='08990000002'),datetime('now','-0 days'));
INSERT INTO penukaran(kode,user_id,nominal,metode,tujuan,status,processed_by,created_at)
   VALUES('DEMO-T1',(SELECT id FROM users WHERE no_hp='08990000003'),10000,'DANA','08990000003','selesai',(SELECT id FROM users WHERE no_hp='08990000001'),datetime('now','-3 days'));
INSERT INTO penukaran(kode,user_id,nominal,metode,tujuan,status,processed_by,created_at)
   VALUES('DEMO-T2',(SELECT id FROM users WHERE no_hp='08990000003'),10000,'GoPay','08990000003','menunggu',NULL,datetime('now','-0 days'));
INSERT INTO notifikasi(user_id,judul,isi,created_at) VALUES((SELECT id FROM users WHERE no_hp='08990000003'),'Setoran disetujui','DEMO-S1: 5 kg diterima, saldo bertambah Rp 20.000.',datetime('now','-6 days'));
INSERT INTO notifikasi(user_id,judul,isi,created_at) VALUES((SELECT id FROM users WHERE no_hp='08990000003'),'Setoran ditolak','DEMO-S4 ditolak. Sampah belum dipilah',datetime('now','-2 days'));
INSERT INTO notifikasi(user_id,judul,isi,created_at) VALUES((SELECT id FROM users WHERE no_hp='08990000003'),'Penukaran berhasil','DEMO-T1: Rp 10.000 sudah dikirim.',datetime('now','-3 days'));
INSERT INTO toko(user_id,nama,deskripsi,alamat,kontak) VALUES((SELECT id FROM users WHERE no_hp='08990000002'),'Toko BioGester Ciangsana','POC hasil pengolahan sampah organik rumah tangga di BioGester Desa Ciangsana.','Komp. TNI AL Ciangsana, Gunung Putri, Bogor','081234567890');
INSERT INTO produk(toko_id,nama,kategori,satuan,harga,stok,deskripsi) VALUES((SELECT id FROM toko WHERE user_id=(SELECT id FROM users WHERE no_hp='08990000002')),'POC BioGester','POC','botol 1 L',15000,40,'Pupuk organik cair dari sampah organik rumah tangga. Kocok sebelum dipakai; campur 1:10 dengan air.');
INSERT INTO produk(toko_id,nama,kategori,satuan,harga,stok,deskripsi) VALUES((SELECT id FROM toko WHERE user_id=(SELECT id FROM users WHERE no_hp='08990000002')),'Kompos Padat','Kompos','kg',5000,25,'Kompos matang dari residu BioGester.');
INSERT INTO pesanan(kode,produk_id,toko_id,pembeli_id,nama_produk,jumlah,harga_satuan,total,metode,status,created_at)
   SELECT 'DEMO-P1',p.id,p.toko_id,(SELECT id FROM users WHERE no_hp='08990000003'),p.nama,2,15000,30000,'Ambil di toko','selesai',datetime('now','-3 days') FROM produk p WHERE p.nama='POC BioGester' AND p.toko_id=(SELECT id FROM toko WHERE user_id=(SELECT id FROM users WHERE no_hp='08990000002'));
INSERT INTO pesanan(kode,produk_id,toko_id,pembeli_id,nama_produk,jumlah,harga_satuan,total,metode,status,created_at)
   SELECT 'DEMO-P2',p.id,p.toko_id,(SELECT id FROM users WHERE no_hp='08990000003'),p.nama,1,15000,15000,'COD / diantar','menunggu',datetime('now','-0 days') FROM produk p WHERE p.nama='POC BioGester' AND p.toko_id=(SELECT id FROM toko WHERE user_id=(SELECT id FROM users WHERE no_hp='08990000002'));
