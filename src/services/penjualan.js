// Service Penjualan ke Pengepul: petugas TPS menjual stok ke pengepul; pengepul menerima/menolak.
// Stok dihitung (setoran disetujui - penjualan aktif), tidak disimpan -> tidak bisa "drift".
import { json, body, fail, validate } from '../lib/http.js';
import { all, first, run, q, batch, notifStmt, newCode } from '../lib/db.js';
import { ADM, PGP } from '../lib/roles.js';
import { scopeBy } from '../lib/scope.js';

const CREATE = {
  pengepul_id: { type: 'number', required: true, min: 1, label: 'Pengepul' },
  jenis_id: { type: 'number', required: true, min: 1, label: 'Jenis sampah' },
  tps_id: { type: 'number', min: 1, label: 'TPS' },
  berat_kg: { type: 'number', required: true, min: 0.1, max: 100000, label: 'Berat' },
  harga_per_kg: { type: 'number', min: 0, max: 10000000, label: 'Harga/kg' },
};
const REVIEW = {
  status: { required: true, oneOf: ['diterima', 'ditolak', 'dibatalkan'], label: 'Status' },
  catatan: { max: 200 },
};
const INBOUND = ['diterima', 'ditolak'];   // diputuskan pengepul; 'dibatalkan' hanya oleh TPS

// Stok satu jenis di satu TPS (?2 = tps_id, ?4 = jenis_id pada statement pemanggil).
const STOK_SQL = `(COALESCE((SELECT SUM(berat_kg) FROM setoran WHERE tps_id=?2 AND jenis_id=?4 AND status='disetujui'),0)
  - COALESCE((SELECT SUM(berat_kg) FROM penjualan WHERE tps_id=?2 AND jenis_id=?4 AND status IN ('menunggu','diterima')),0))`;

const SELECT = `SELECT p.id,p.kode,p.berat_kg,p.harga_per_kg,p.nilai,p.status,p.catatan,p.created_at,
  j.nama AS jenis,j.kategori,t.nama AS tps,u.nama AS pengepul,c.nama AS petugas
  FROM penjualan p JOIN jenis_sampah j ON j.id=p.jenis_id JOIN tps t ON t.id=p.tps_id
  JOIN users u ON u.id=p.pengepul_id JOIN users c ON c.id=p.created_by`;
const visible = (u) => scopeBy(u, { own: 'p.pengepul_id', tps: 'p.tps_id' });

export const register = (r) => {
  // Daftar pengepul aktif (untuk memilih tujuan penjualan).
  r.add('GET', '/api/pengepul', ADM, async ({ env }) =>
    json(await all(env, `SELECT id,nama,no_hp FROM users WHERE role='pengepul' AND aktif=1 ORDER BY nama`)));

  // Stok per jenis: admin_tps = TPS miliknya, super_admin = ?tps_id (kosong -> semua TPS).
  r.add('GET', '/api/stok', ADM, async ({ env, user, url }) => {
    const tps = user.role === 'admin_tps' ? user.tps_id : Number(url.searchParams.get('tps_id')) || null;
    return json(await all(env,
      `SELECT * FROM (SELECT j.id,j.kode,j.nama,j.kategori,j.harga_per_kg,
         ROUND(COALESCE(i.b,0)-COALESCE(o.b,0),3) AS stok
       FROM jenis_sampah j
       LEFT JOIN (SELECT jenis_id,SUM(berat_kg) b FROM setoran WHERE status='disetujui' AND (?1 IS NULL OR tps_id=?1) GROUP BY jenis_id) i ON i.jenis_id=j.id
       LEFT JOIN (SELECT jenis_id,SUM(berat_kg) b FROM penjualan WHERE status IN ('menunggu','diterima') AND (?1 IS NULL OR tps_id=?1) GROUP BY jenis_id) o ON o.jenis_id=j.id)
       WHERE stok>0 ORDER BY kategori,nama`, tps));
  });

  r.add('GET', '/api/penjualan', [...ADM, ...PGP], async ({ env, user, url }) => {
    const v = visible(user), status = url.searchParams.get('status');
    return json(await all(env, `${SELECT} WHERE 1=1${v.sql}${status ? ' AND p.status=?' : ''} ORDER BY p.id DESC LIMIT 200`,
      ...v.p, ...(status ? [status] : [])));
  });

  r.add('POST', '/api/penjualan', ADM, async ({ req, env, user }) => {
    const d = validate(await body(req), CREATE);
    const tps = user.role === 'admin_tps' ? user.tps_id : d.tps_id;
    if (!tps) fail(422, 'TPS wajib dipilih');
    if (!(await first(env, 'SELECT id FROM tps WHERE id=?', tps))) fail(422, 'TPS tidak ditemukan');
    const pgp = await first(env, `SELECT id FROM users WHERE id=? AND role='pengepul' AND aktif=1`, d.pengepul_id);
    if (!pgp) fail(422, 'Pengepul tidak ditemukan');
    const jenis = await first(env, 'SELECT harga_per_kg FROM jenis_sampah WHERE id=?', d.jenis_id);
    if (!jenis) fail(422, 'Jenis sampah tidak ditemukan');
    const harga = d.harga_per_kg ?? jenis.harga_per_kg, kode = newCode('JUL');
    // Atomik: baris hanya dibuat jika stok cukup -> tidak bisa jual melebihi stok lewat request paralel.
    const res = await run(env,
      `INSERT INTO penjualan(kode,tps_id,pengepul_id,jenis_id,berat_kg,harga_per_kg,nilai,created_by)
       SELECT ?1,?2,?3,?4,?5,?6,?7,?8 WHERE ROUND(${STOK_SQL},3) >= ROUND(?5,3)`,
      kode, tps, d.pengepul_id, d.jenis_id, d.berat_kg, harga, Math.round(d.berat_kg * harga), user.id);
    if (!res.meta.changes) fail(422, 'Stok tidak mencukupi');
    await run(env, 'INSERT INTO notifikasi(user_id,judul,isi) VALUES(?,?,?)', d.pengepul_id, 'Penawaran baru',
      `${kode}: ${d.berat_kg} kg senilai Rp ${Math.round(d.berat_kg * harga).toLocaleString('id-ID')} menunggu konfirmasi Anda.`);
    return json({ kode }, 201);
  });

  r.add('PATCH', '/api/penjualan/:id', [...ADM, ...PGP], async ({ req, env, user, params }) => {
    const d = validate(await body(req), REVIEW), v = visible(user);
    const isPgp = user.role === 'pengepul';
    if (isPgp !== INBOUND.includes(d.status)) fail(403, isPgp ? 'Pengepul hanya dapat menerima atau menolak' : 'TPS hanya dapat membatalkan');
    const row = await first(env, `SELECT p.id,p.kode,p.created_by,p.pengepul_id,p.nilai,p.status FROM penjualan p WHERE p.id=?${v.sql}`, params.id, ...v.p);
    if (!row) fail(404, 'Penjualan tidak ditemukan');
    if (row.status !== 'menunggu') fail(409, 'Penjualan sudah diproses');
    const [to, judul] = isPgp ? [row.created_by, `Penjualan ${d.status}`] : [row.pengepul_id, 'Penawaran dibatalkan'];
    await batch(env, [
      q(env, `UPDATE penjualan SET status=?,catatan=? WHERE id=? AND status='menunggu'`, d.status, d.catatan || '', row.id),
      notifStmt(env, to, judul, `${row.kode} ${d.status}. ${d.catatan || ''}`.trim()),
    ]);
    return json({ ok: true });
  });

  // Ringkasan untuk dashboard pengepul.
  r.add('GET', '/api/pengepul/stats', PGP, async ({ env, user }) =>
    json(await first(env,
      `SELECT
        (SELECT COUNT(*) FROM penjualan WHERE pengepul_id=?1 AND status='menunggu') AS menunggu,
        (SELECT COALESCE(SUM(berat_kg),0) FROM penjualan WHERE pengepul_id=?1 AND status='diterima') AS total_kg,
        (SELECT COALESCE(SUM(nilai),0) FROM penjualan WHERE pengepul_id=?1 AND status='diterima') AS total_nilai,
        (SELECT COALESCE(SUM(berat_kg),0) FROM penjualan WHERE pengepul_id=?1 AND status='diterima' AND created_at>=date('now','start of month')) AS kg_bulan_ini`,
      user.id)));
};
