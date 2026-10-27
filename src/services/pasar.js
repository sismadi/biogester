// Service Pasar: marketplace jual-beli POC (pupuk organik cair) dan produk turunan BioGester.
// Setiap akun (semua peran) dapat membuka SATU toko (profil + katalog produk) dan membeli dari toko lain.
// Seperti stok TPS, stok tersedia DIHITUNG (stok total - pesanan aktif), bukan disimpan -> tidak bisa "drift";
// pesanan dibuat atomik sehingga tidak bisa melebihi stok walau dipesan bersamaan.
// Pembayaran dilakukan langsung antara pembeli & penjual (ambil di toko / COD); aplikasi hanya mencatat pesanan.
import { json, body, fail, validate } from '../lib/http.js';
import { all, first, run, insertRow, updateRow, notifStmt, newCode } from '../lib/db.js';

export const KATEGORI = ['POC', 'Kompos', 'Perlengkapan', 'Lainnya'];
const METODE = ['Ambil di toko', 'COD / diantar'];
const AKTIF_ST = `'menunggu','diproses','selesai'`;   // status pesanan yang menahan stok

const FOTO = { max: 300000, pattern: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, msg: 'Foto tidak valid' };
const TOKO = {
  nama: { required: true, max: 80, label: 'Nama toko' },
  deskripsi: { max: 500 },
  alamat: { max: 200 },
  kontak: { max: 30, pattern: /^[0-9+\-\s]{6,30}$/, msg: 'Kontak tidak valid (angka, spasi, + atau -)' },
  foto: FOTO,
  aktif: { type: 'number', min: 0, max: 1 },
};
const PRODUK = {
  nama: { required: true, max: 100, label: 'Nama produk' },
  kategori: { required: true, oneOf: KATEGORI, label: 'Kategori' },
  satuan: { required: true, max: 30, label: 'Satuan' },
  deskripsi: { max: 1000 },
  harga: { type: 'number', required: true, min: 0, max: 100000000, label: 'Harga' },
  stok: { type: 'number', required: true, min: 0, max: 1000000, label: 'Stok' },
  foto: FOTO,
  aktif: { type: 'number', min: 0, max: 1 },
};
const PESAN = {
  produk_id: { type: 'number', required: true, min: 1, label: 'Produk' },
  jumlah: { type: 'number', required: true, min: 1, max: 100000, label: 'Jumlah' },
  metode: { required: true, oneOf: METODE, label: 'Metode' },
  catatan: { max: 200 },
};
const REVIEW = {
  status: { required: true, oneOf: ['diproses', 'selesai', 'ditolak', 'dibatalkan'], label: 'Status' },
  catatan: { max: 200 },
};
// Alur status: penjual memproses/menolak/menyelesaikan; pembeli hanya dapat membatalkan selama masih menunggu.
const SELLER_FLOW = { menunggu: ['diproses', 'ditolak'], diproses: ['selesai', 'ditolak'] };
const BUYER_FLOW = { menunggu: ['dibatalkan'] };

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const whole = (d, ...keys) => keys.forEach((k) => { if (k in d && !Number.isInteger(d[k])) fail(422, `${k === 'harga' ? 'Harga' : 'Stok'} harus bilangan bulat`); });
const cleanFoto = (d) => { if ('foto' in d) d.foto = d.foto || null; return d; };   // '' = hapus foto; tidak dikirim = tidak berubah

// Jumlah yang sedang ditahan pesanan aktif untuk produk p; tersedia = stok - ditahan.
const KOMIT = `(SELECT COALESCE(SUM(o.jumlah),0) FROM pesanan o WHERE o.produk_id=p.id AND o.status IN (${AKTIF_ST}))`;

const TOKO_SELECT = `SELECT t.id,t.nama,t.deskripsi,t.alamat,t.kontak,t.aktif,t.updated_at,(t.foto IS NOT NULL) AS ada_foto,u.nama AS pemilik
  FROM toko t JOIN users u ON u.id=t.user_id`;
const PRODUK_SELECT = `SELECT p.id,p.nama,p.kategori,p.deskripsi,p.satuan,p.harga,p.updated_at,(p.foto IS NOT NULL) AS ada_foto,
  t.id AS toko_id,t.nama AS toko,t.alamat AS toko_alamat,t.kontak,t.user_id AS penjual_id,(p.stok-${KOMIT}) AS tersedia
  FROM produk p JOIN toko t ON t.id=p.toko_id`;

const myToko = (env, user) => first(env, 'SELECT id,aktif FROM toko WHERE user_id=?', user.id);
const imageResponse = (dataUrl) => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) fail(404, 'Foto tidak ada');
  return new Response(Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)), {
    headers: { 'content-type': m[1], 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
};
const ownProduk = async (env, user, id) => {
  const row = await first(env, `SELECT p.id,${KOMIT} AS komit FROM produk p JOIN toko t ON t.id=p.toko_id WHERE p.id=? AND t.user_id=?`, id, user.id);
  return row || fail(404, 'Produk tidak ditemukan');
};

export const register = (r) => {
  /* ---- Profil toko ---- */
  r.add('GET', '/api/toko/saya', [], async ({ env, user }) => json((await first(env, `${TOKO_SELECT} WHERE t.user_id=?`, user.id)) ?? null));

  r.add('PUT', '/api/toko/saya', [], async ({ req, env, user }) => {
    const d = cleanFoto(validate(await body(req), TOKO)), ada = await myToko(env, user);
    if (ada) await updateRow(env, 'toko', ada.id, { ...d, updated_at: now() });
    else await insertRow(env, 'toko', { ...d, user_id: user.id });
    return json({ ok: true }, ada ? 200 : 201);
  });

  // Daftar toko yang buka dan punya produk tampil.
  r.add('GET', '/api/toko', [], async ({ env }) =>
    json(await all(env, `SELECT * FROM (${TOKO_SELECT.replace('u.nama AS pemilik', `u.nama AS pemilik,
      (SELECT COUNT(*) FROM produk p WHERE p.toko_id=t.id AND p.aktif=1) AS jml_produk`)} WHERE t.aktif=1) WHERE jml_produk>0 ORDER BY nama`)));

  r.add('GET', '/api/toko/:id/foto', [], async ({ env, params }) =>
    imageResponse((await first(env, 'SELECT foto FROM toko WHERE id=?', params.id))?.foto));

  r.add('GET', '/api/toko/:id', [], async ({ env, user, params }) => {
    const row = await first(env, `${TOKO_SELECT} WHERE t.id=? AND (t.aktif=1 OR t.user_id=?)`, params.id, user.id);
    return row ? json(row) : fail(404, 'Toko tidak ditemukan');
  });

  /* ---- Katalog produk milik sendiri ---- */
  r.add('GET', '/api/produk/saya', [], async ({ env, user }) =>
    json(await all(env, `SELECT p.id,p.nama,p.kategori,p.deskripsi,p.satuan,p.harga,p.stok,p.aktif,p.updated_at,(p.foto IS NOT NULL) AS ada_foto,
      ${KOMIT} AS komit,(p.stok-${KOMIT}) AS tersedia FROM produk p JOIN toko t ON t.id=p.toko_id WHERE t.user_id=? ORDER BY p.id DESC`, user.id)));

  r.add('POST', '/api/produk', [], async ({ req, env, user }) => {
    const d = cleanFoto(validate(await body(req), PRODUK));
    whole(d, 'harga', 'stok');
    const t = await myToko(env, user);
    if (!t) fail(409, 'Buat profil toko terlebih dahulu');
    return json({ id: (await insertRow(env, 'produk', { ...d, toko_id: t.id })).meta.last_row_id }, 201);
  });

  r.add('PUT', '/api/produk/:id', [], async ({ req, env, user, params }) => {
    const d = cleanFoto(validate(await body(req), PRODUK)), p = await ownProduk(env, user, params.id);
    whole(d, 'harga', 'stok');
    if (d.stok < p.komit) fail(422, `Stok tidak boleh di bawah pesanan aktif (${p.komit})`);
    await updateRow(env, 'produk', p.id, { ...d, updated_at: now() });
    return json({ ok: true });
  });

  r.add('DELETE', '/api/produk/:id', [], async ({ env, user, params }) => {
    const p = await ownProduk(env, user, params.id);
    if (await first(env, 'SELECT id FROM pesanan WHERE produk_id=? LIMIT 1', p.id)) fail(409, 'Produk sudah pernah dipesan; sembunyikan saja dari pasar');
    await run(env, 'DELETE FROM produk WHERE id=?', p.id);
    return json({ ok: true });
  });

  r.add('GET', '/api/produk/:id/foto', [], async ({ env, params }) =>
    imageResponse((await first(env, 'SELECT foto FROM produk WHERE id=?', params.id))?.foto));

  /* ---- Pasar (etalase publik bagi semua akun yang masuk) ---- */
  r.add('GET', '/api/pasar', [], async ({ env, user, url }) => {
    const q = (url.searchParams.get('q') || '').replace(/[%_\\]/g, ' ').trim().slice(0, 60);
    const kat = url.searchParams.get('kategori'), tokoId = Number(url.searchParams.get('toko_id')) || null;
    const w = [], p = [];
    if (q) { w.push('(p.nama LIKE ? OR t.nama LIKE ? OR p.deskripsi LIKE ?)'); p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (kat) { w.push('p.kategori=?'); p.push(kat); }
    if (tokoId) { w.push('t.id=?'); p.push(tokoId); }
    const rows = await all(env, `${PRODUK_SELECT} WHERE p.aktif=1 AND t.aktif=1${w.map((x) => ' AND ' + x).join('')} ORDER BY p.id DESC LIMIT 120`, ...p);
    return json(rows.map(({ penjual_id, ...x }) => ({ ...x, milik_saya: penjual_id === user.id })));
  });

  /* ---- Pesanan ---- */
  r.add('POST', '/api/pesanan', [], async ({ req, env, user }) => {
    const d = validate(await body(req), PESAN);
    if (!Number.isInteger(d.jumlah)) fail(422, 'Jumlah harus bilangan bulat');
    const p = await first(env, `SELECT p.id,p.nama,p.harga,t.user_id AS penjual FROM produk p JOIN toko t ON t.id=p.toko_id WHERE p.id=? AND p.aktif=1 AND t.aktif=1`, d.produk_id);
    if (!p) fail(404, 'Produk tidak tersedia');
    if (p.penjual === user.id) fail(409, 'Tidak bisa membeli produk toko sendiri');
    const kode = newCode('PSN');
    // Atomik: baris hanya dibuat jika stok tersedia cukup -> tidak bisa memesan melebihi stok lewat request paralel.
    const res = await run(env,
      `INSERT INTO pesanan(kode,produk_id,toko_id,pembeli_id,nama_produk,jumlah,harga_satuan,total,metode,catatan)
       SELECT ?1,p.id,p.toko_id,?2,p.nama,?3,p.harga,p.harga*?3,?4,?5 FROM produk p
       WHERE p.id=?6 AND p.aktif=1 AND p.stok-${KOMIT} >= ?3`,
      kode, user.id, d.jumlah, d.metode, d.catatan || '', p.id);
    if (!res.meta.changes) fail(422, 'Stok tidak mencukupi');
    await notifStmt(env, p.penjual, 'Pesanan baru', `${kode}: ${d.jumlah} × ${p.nama} (${rp(p.harga * d.jumlah)}) dari ${user.nama}.`).run();
    return json({ kode }, 201);
  });

  // ?peran=beli (pesanan saya) | jual (pesanan masuk ke toko saya), opsional ?status=
  r.add('GET', '/api/pesanan', [], async ({ env, user, url }) => {
    const jual = url.searchParams.get('peran') === 'jual', status = url.searchParams.get('status');
    return json(await all(env,
      `SELECT o.id,o.kode,o.produk_id,o.nama_produk,o.jumlah,o.harga_satuan,o.total,o.metode,o.catatan,o.catatan_penjual,o.status,o.created_at,
         t.nama AS toko,t.kontak AS kontak_toko,b.nama AS pembeli,b.no_hp AS hp_pembeli
       FROM pesanan o JOIN toko t ON t.id=o.toko_id JOIN users b ON b.id=o.pembeli_id
       WHERE ${jual ? 't.user_id=?' : 'o.pembeli_id=?'}${status ? ' AND o.status=?' : ''} ORDER BY o.id DESC LIMIT 200`,
      user.id, ...(status ? [status] : [])));
  });

  r.add('PATCH', '/api/pesanan/:id', [], async ({ req, env, user, params }) => {
    const d = validate(await body(req), REVIEW);
    const row = await first(env,
      `SELECT o.id,o.kode,o.status,o.pembeli_id,t.user_id AS penjual_id FROM pesanan o JOIN toko t ON t.id=o.toko_id
       WHERE o.id=? AND (o.pembeli_id=? OR t.user_id=?)`, params.id, user.id, user.id);
    if (!row) fail(404, 'Pesanan tidak ditemukan');
    const seller = row.penjual_id === user.id;
    if (!(seller ? SELLER_FLOW : BUYER_FLOW)[row.status]?.includes(d.status)) fail(409, 'Perubahan status tidak diizinkan');
    // Dijaga status lama -> dua permintaan bersamaan tidak bisa mengubah pesanan dua kali.
    const res = await run(env, `UPDATE pesanan SET status=?,catatan_penjual=?,updated_at=? WHERE id=? AND status=?`,
      d.status, seller ? d.catatan || '' : '', now(), row.id, row.status);
    if (!res.meta.changes) fail(409, 'Pesanan sudah diproses');
    await notifStmt(env, seller ? row.pembeli_id : row.penjual_id, `Pesanan ${d.status}`, `${row.kode} ${d.status}. ${seller ? d.catatan || '' : ''}`.trim()).run();
    return json({ ok: true });
  });
};
