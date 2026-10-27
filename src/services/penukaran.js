// Service Penukaran saldo (DANA/OVO/GoPay/Voucher/Tunai).
import { json, body, fail, validate } from '../lib/http.js';
import { all, first, run, q, batch, notifStmt, newCode, SALDO_SQL } from '../lib/db.js';
import { ADM, NAS, STAFF } from '../lib/roles.js';

const CREATE = (min) => ({
  nominal: { type: 'number', required: true, min, label: 'Nominal' },
  metode: { required: true, oneOf: ['DANA', 'OVO', 'GoPay', 'Voucher', 'Tunai'], label: 'Metode' },
  tujuan: { max: 60, label: 'Nomor tujuan' },
});
const REVIEW = { status: { required: true, oneOf: ['selesai', 'ditolak'], label: 'Status' } };

export const register = (r) => {
  r.add('GET', '/api/penukaran', STAFF, async ({ env, user, url }) => {
    const status = url.searchParams.get('status'), own = user.role === 'nasabah';
    return json(await all(env,
      `SELECT p.id,p.kode,p.nominal,p.metode,p.tujuan,p.status,p.created_at,u.nama AS nasabah,u.no_hp
       FROM penukaran p JOIN users u ON u.id=p.user_id WHERE 1=1${own ? ' AND p.user_id=?' : ''}${status ? ' AND p.status=?' : ''}
       ORDER BY p.id DESC LIMIT 200`, ...(own ? [user.id] : []), ...(status ? [status] : [])));
  });

  r.add('POST', '/api/penukaran', NAS, async ({ req, env, user }) => {
    const d = validate(await body(req), CREATE(Number(env.MIN_TUKAR) || 10000));
    if (d.metode !== 'Tunai' && !d.tujuan) fail(422, 'Nomor tujuan wajib diisi');
    const kode = newCode('TKR');
    // Atomik: baris hanya dibuat jika saldo mencukupi -> tidak bisa tarik ganda lewat request paralel.
    const res = await run(env,
      `INSERT INTO penukaran(kode,user_id,nominal,metode,tujuan) SELECT ?2,?1,?3,?4,?5 WHERE ${SALDO_SQL} >= ?3`,
      user.id, kode, d.nominal, d.metode, d.tujuan || '');
    if (!res.meta.changes) fail(422, 'Saldo tidak mencukupi');
    return json({ kode }, 201);
  });

  r.add('PATCH', '/api/penukaran/:id', ADM, async ({ req, env, user, params }) => {
    const d = validate(await body(req), REVIEW);
    const row = await first(env, 'SELECT id,user_id,kode,nominal,status FROM penukaran WHERE id=?', params.id);
    if (!row) fail(404, 'Penukaran tidak ditemukan');
    if (row.status !== 'menunggu') fail(409, 'Penukaran sudah diproses');
    const ok = d.status === 'selesai';
    await batch(env, [
      q(env, `UPDATE penukaran SET status=?,processed_by=? WHERE id=? AND status='menunggu'`, d.status, user.id, row.id),
      notifStmt(env, row.user_id, ok ? 'Penukaran berhasil' : 'Penukaran ditolak',
        ok ? `${row.kode}: Rp ${row.nominal.toLocaleString('id-ID')} sudah dikirim.` : `${row.kode} ditolak, saldo dikembalikan.`),
    ]);
    return json({ ok: true });
  });
};
