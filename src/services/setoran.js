// Service Setoran: nasabah menyetor, admin TPS memverifikasi (berat bisa dikoreksi hasil timbang).
import { json, body, fail, validate } from '../lib/http.js';
import { all, first, run, q, batch, notifStmt, newCode } from '../lib/db.js';
import { ADM, NAS, STAFF } from '../lib/roles.js';
import { scopeBy } from '../lib/scope.js';

const CREATE = {
  jenis_id: { type: 'number', required: true, min: 1, label: 'Jenis sampah' },
  tps_id: { type: 'number', required: true, min: 1, label: 'TPS' },
  berat_kg: { type: 'number', required: true, min: 0.1, max: 1000, label: 'Berat' },
  foto: { max: 300000, pattern: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, msg: 'Foto tidak valid' },
};
const REVIEW = {
  status: { required: true, oneOf: ['disetujui', 'ditolak'], label: 'Status' },
  berat_kg: { type: 'number', min: 0.1, max: 1000, label: 'Berat' },
  catatan: { max: 200 },
};

const SELECT = `SELECT s.id,s.kode,s.berat_kg,s.harga_per_kg,s.nilai,s.status,s.catatan,s.created_at,
  j.nama AS jenis,t.nama AS tps,u.nama AS nasabah
  FROM setoran s JOIN jenis_sampah j ON j.id=s.jenis_id JOIN tps t ON t.id=s.tps_id JOIN users u ON u.id=s.user_id`;

const visible = (u) => scopeBy(u, { own: 's.user_id', tps: 's.tps_id' });

export const register = (r) => {
  r.add('GET', '/api/setoran', STAFF, async ({ env, user, url }) => {
    const v = visible(user), status = url.searchParams.get('status');
    return json(await all(env, `${SELECT} WHERE 1=1${v.sql}${status ? ' AND s.status=?' : ''} ORDER BY s.id DESC LIMIT 200`, ...v.p, ...(status ? [status] : [])));
  });

  r.add('GET', '/api/setoran/:id', STAFF, async ({ env, user, params }) => {
    const v = visible(user);
    const row = await first(env, `${SELECT.replace('SELECT s.id', 'SELECT s.foto,s.id')} WHERE s.id=?${v.sql}`, params.id, ...v.p);
    return row ? json(row) : fail(404, 'Setoran tidak ditemukan');
  });

  r.add('POST', '/api/setoran', NAS, async ({ req, env, user }) => {
    const d = validate(await body(req), CREATE);
    const jenis = await first(env, 'SELECT harga_per_kg FROM jenis_sampah WHERE id=? AND aktif=1', d.jenis_id);
    if (!jenis) fail(422, 'Jenis sampah tidak tersedia');
    if (!(await first(env, 'SELECT id FROM tps WHERE id=?', d.tps_id))) fail(422, 'TPS tidak ditemukan');
    const kode = newCode('SET');
    await run(env, `INSERT INTO setoran(kode,user_id,jenis_id,tps_id,berat_kg,harga_per_kg,nilai,foto) VALUES(?,?,?,?,?,?,?,?)`,
      kode, user.id, d.jenis_id, d.tps_id, d.berat_kg, jenis.harga_per_kg, Math.round(d.berat_kg * jenis.harga_per_kg), d.foto || null);
    return json({ kode }, 201);
  });

  r.add('PATCH', '/api/setoran/:id', ADM, async ({ req, env, user, params }) => {
    const d = validate(await body(req), REVIEW), v = visible(user);
    const row = await first(env, `SELECT s.id,s.user_id,s.kode,s.harga_per_kg,s.berat_kg,s.status FROM setoran s WHERE s.id=?${v.sql}`, params.id, ...v.p);
    if (!row) fail(404, 'Setoran tidak ditemukan');
    if (row.status !== 'menunggu') fail(409, 'Setoran sudah diproses');
    const berat = d.berat_kg ?? row.berat_kg, nilai = Math.round(berat * row.harga_per_kg);
    const ok = d.status === 'disetujui';
    await batch(env, [
      q(env, `UPDATE setoran SET status=?,berat_kg=?,nilai=?,catatan=?,verified_by=? WHERE id=? AND status='menunggu'`,
        d.status, berat, nilai, d.catatan || '', user.id, row.id),
      notifStmt(env, row.user_id, ok ? 'Setoran disetujui' : 'Setoran ditolak',
        ok ? `${row.kode}: ${berat} kg diterima, saldo bertambah Rp ${nilai.toLocaleString('id-ID')}.` : `${row.kode} ditolak. ${d.catatan || ''}`.trim()),
    ]);
    return json({ ok: true });
  });
};
