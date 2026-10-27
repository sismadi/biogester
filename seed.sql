-- Data contoh (harga mengacu bs_cartbarang / data_transaksi_pengepul di kepik.sql).
INSERT OR IGNORE INTO tps (id,nama,alamat,lat,lng,telpon) VALUES
 (1,'Bank Sampah Cinta','Komp. TNI AL Ciangsana, Gunung Putri, Bogor',-6.3926,106.9061,'081382845578'),
 (2,'Bank Sampah Cimanggis','Cimanggis, Depok',-6.3680,106.8650,'08129205077');

INSERT OR IGNORE INTO jenis_sampah (kode,nama,kategori,harga_per_kg,aktif) VALUES
 ('KRT-KRN','Koran','Kertas',1000,1),
 ('KRT-BKU','Buku Tulis','Kertas',2000,1),
 ('KRT-KDS','Kardus','Kertas',1500,1),
 ('PLS-GLS','Gelas Plastik','Plastik',2000,1),
 ('PLS-BTL','Botol Plastik','Plastik',4000,1),
 ('PLS-SLP','Selopan','Plastik',3000,1),
 ('LOG-KLG','Kaleng','Logam',5000,1),
 ('LOG-ALM','Aluminium','Logam',12000,1),
 ('KCA-BTL','Botol Kaca','Kaca',500,1),
 ('ELK-KBL','Kabel Bekas','Elektronik',8000,1),
 ('MYK-JLT','Minyak Jelantah','Minyak',6000,1),
 ('TKS-PKN','Pakaian Bekas','Tekstil',1000,1);

INSERT OR IGNORE INTO edukasi (id,judul,kategori,isi) VALUES
 (1,'Cara memilah sampah di rumah','Pemilahan','Pisahkan sampah menjadi organik, anorganik (plastik, kertas, logam), dan residu. Bilas botol dan gelas plastik sebelum disetor agar harganya lebih baik.'),
 (2,'Kenapa kertas basah dihargai rendah?','Tips','Kertas yang basah atau berminyak sulit didaur ulang dan beratnya menipu. Simpan kertas di tempat kering.'),
 (3,'Apa itu ekonomi sirkular?','Green Lifestyle','Ekonomi sirkular menjaga bahan tetap dipakai selama mungkin: dipakai, dikumpulkan, didaur ulang, lalu dipakai lagi, bukan dibuang.');
