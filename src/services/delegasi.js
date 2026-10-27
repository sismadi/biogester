// Service Delegasi: mengangkat pengguna menjadi petugas TPS / pengepul, atau mencabutnya kembali.
//   super_admin : semua pengguna (kecuali super_admin lain), ke peran apa pun.
//   admin_tps   : hanya pengguna -> petugas di TPS-nya sendiri, dan mencabut petugas TPS-nya sendiri.
import { json, body, fail, validate } from '../lib/http.js';
import { all, first, q, batch, notifStmt } from '../lib/db.js';
import { ADM } from '../lib/roles.js';

const DELEGATE = {
  user_id: { type: 'number', required: true, min: 1, label: 'Pengguna' },
  role: { required: true, oneOf: ['nasabah', 'admin_tps', 'pengepul'], label: 'Peran' },
  tps_id: { type: 'number', min: 1, label: 'TPS' },
};
const LABEL = { nasabah: 'Pengguna', admin_tps: 'Petugas TPS', pengepul: 'Pengepul' };
const like = (s) => '%' + s.replace(/[\\%_]/g, '\\$&') + '%';

// Aturan siapa boleh mengubah siapa -> satu fungsi, dipakai pencarian DAN eksekusi.
const canDelegate = (actor, target, toRole, toTps) =>
  actor.role === 'super_admin' ||
  (target.role === 'nasabah' && toRole === 'admin_tps' && toTps === actor.tps_id) ||
  (target.role === 'admin_tps' && target.tps_id === actor.tps_id && toRole === 'nasabah');

export const register = (r) => {
  // Cari pengguna (nama / no HP) untuk didelegasikan.
  r.add('GET', '/api/delegasi/cari', ADM, async ({ env, user, url }) => {
    const term = (url.searchParams.get('q') || '').trim();
    if (term.length < 2) return json([]);
    const scoped = user.role === 'admin_tps';
    return json(await all(env,
      `SELECT id,nama,no_hp,role,tps_id FROM users
       WHERE id!=?1 AND aktif=1 AND role!='super_admin' AND (nama LIKE ?2 ESCAPE '\\' OR no_hp LIKE ?2 ESCAPE '\\')
       ${scoped ? `AND (role='nasabah' OR (role='admin_tps' AND tps_id=?3))` : ''} ORDER BY nama LIMIT 20`,
      ...[user.id, like(term), ...(scoped ? [user.tps_id] : [])]));
  });

  // Delegasi aktif + riwayat.
  r.add('GET', '/api/delegasi', ADM, async ({ env, user }) => {
    const tps = user.role === 'admin_tps' ? user.tps_id : null;
    const [aktif, riwayat] = await Promise.all([
      all(env, `SELECT u.id,u.nama,u.no_hp,u.role,u.tps_id,t.nama AS tps FROM users u LEFT JOIN tps t ON t.id=u.tps_id
        WHERE u.aktif=1 AND u.id!=?2 AND ((?1 IS NULL AND u.role IN ('admin_tps','pengepul')) OR (u.role='admin_tps' AND u.tps_id=?1)) ORDER BY u.role,u.nama`, tps, user.id),
      all(env, `SELECT d.id,d.dari_role,d.ke_role,d.created_at,u.nama AS pengguna,o.nama AS oleh,t.nama AS tps
        FROM delegasi d JOIN users u ON u.id=d.user_id JOIN users o ON o.id=d.oleh LEFT JOIN tps t ON t.id=d.tps_id
        WHERE (?1 IS NULL OR d.tps_id=?1 OR d.oleh=?2) ORDER BY d.id DESC LIMIT 50`, tps, user.id),
    ]);
    return json({ aktif, riwayat });
  });

  r.add('POST', '/api/delegasi', ADM, async ({ req, env, user }) => {
    const d = validate(await body(req), DELEGATE);
    const target = await first(env, 'SELECT id,nama,role,tps_id FROM users WHERE id=? AND aktif=1', d.user_id);
    if (!target) fail(404, 'Pengguna tidak ditemukan');
    if (target.id === user.id) fail(409, 'Tidak bisa mengubah peran sendiri');
    if (target.role === 'super_admin') fail(409, 'Peran admin tidak dapat didelegasikan');
    const tps = d.role === 'admin_tps' ? (user.role === 'admin_tps' ? user.tps_id : d.tps_id) : null;
    if (d.role === 'admin_tps' && !tps) fail(422, 'Petugas wajib dikaitkan dengan satu TPS');
    if (tps && !(await first(env, 'SELECT id FROM tps WHERE id=?', tps))) fail(422, 'TPS tidak ditemukan');
    if (target.role === d.role && target.tps_id === tps) fail(409, 'Pengguna sudah memiliki peran tersebut');
    if (!canDelegate(user, target, d.role, tps)) fail(403, 'Anda tidak berwenang atas pengguna ini');
    await batch(env, [
      q(env, 'UPDATE users SET role=?,tps_id=? WHERE id=?', d.role, tps, target.id),
      q(env, 'INSERT INTO delegasi(user_id,dari_role,ke_role,tps_id,oleh) VALUES(?,?,?,?,?)', target.id, target.role, d.role, tps, user.id),
      notifStmt(env, target.id, 'Peran Anda berubah',
        d.role === 'nasabah' ? 'Peran Anda dikembalikan menjadi Pengguna.' : `Anda ditunjuk sebagai ${LABEL[d.role]}. Masuk ulang untuk melihat menu baru.`),
    ]);
    return json({ ok: true });
  });
};
