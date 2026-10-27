// Service Master: CRUD generik (jenis sampah, TPS, edukasi) + notifikasi + pengguna + statistik.
// Satu factory crud() menghasilkan 4 endpoint per resource -> tambah resource = tambah 1 objek konfigurasi.
import { json, body, fail, validate } from '../lib/http.js';
import { all, first, run, insertRow, updateRow } from '../lib/db.js';
import { ADM, SUP, ROLES } from '../lib/roles.js';

const SUPER = SUP;
const RESOURCES = [
  { path: '/api/jenis', table: 'jenis_sampah', order: 'kategori,nama', rules: {
      kode: { required: true, max: 20 }, nama: { required: true, max: 80 }, kategori: { required: true, max: 40 },
      harga_per_kg: { type: 'number', required: true, min: 0, max: 10000000, label: 'Harga/kg' },
      aktif: { type: 'number', min: 0, max: 1, default: 1 } } },
  { path: '/api/tps', table: 'tps', order: 'nama', rules: {
      nama: { required: true, max: 100 }, alamat: { max: 255 }, telpon: { max: 30 },
      lat: { type: 'number', min: -90, max: 90 }, lng: { type: 'number', min: -180, max: 180 } } },
  { path: '/api/edukasi', table: 'edukasi', order: 'id DESC', rules: {
      judul: { required: true, max: 150 }, kategori: { max: 40, default: 'Umum' }, isi: { required: true, max: 5000 } } },
];

function crud(r, { path, table, order, rules }) {
  r.add('GET', path, [], async ({ env }) => json(await all(env, `SELECT * FROM ${table} ORDER BY ${order}`)));
  r.add('POST', path, SUPER, async ({ req, env }) =>
    json({ id: (await insertRow(env, table, validate(await body(req), rules))).meta.last_row_id }, 201));
  r.add('PUT', `${path}/:id`, SUPER, async ({ req, env, params }) => {
    await updateRow(env, table, params.id, validate(await body(req), rules));
    return json({ ok: true });
  });
  r.add('DELETE', `${path}/:id`, SUPER, async ({ env, params }) => {
    await run(env, `DELETE FROM ${table} WHERE id=?`, params.id);
    return json({ ok: true });
  });
}

const USER_PATCH = {
  role: { oneOf: ROLES },
  tps_id: { type: 'number', min: 1 },
  aktif: { type: 'number', min: 0, max: 1 },
};

export const register = (r) => {
  RESOURCES.forEach((res) => crud(r, res));

  r.add('GET', '/api/notifikasi', [], async ({ env, user }) =>
    json(await all(env, 'SELECT id,judul,isi,dibaca,created_at FROM notifikasi WHERE user_id=? ORDER BY id DESC LIMIT 50', user.id)));
  r.add('POST', '/api/notifikasi/baca', [], async ({ env, user }) => {
    await run(env, 'UPDATE notifikasi SET dibaca=1 WHERE user_id=? AND dibaca=0', user.id);
    return json({ ok: true });
  });

  r.add('GET', '/api/admin/users', SUPER, async ({ env }) =>
    json(await all(env, 'SELECT id,no_hp,nama,role,tps_id,aktif,created_at FROM users ORDER BY id DESC LIMIT 300')));
  r.add('PATCH', '/api/admin/users/:id', SUPER, async ({ req, env, user, params }) => {
    if (Number(params.id) === user.id) fail(409, 'Tidak bisa mengubah akun sendiri');
    const d = validate(await body(req), USER_PATCH);
    if (d.role === 'admin_tps' && !d.tps_id && !(await first(env, 'SELECT tps_id FROM users WHERE id=?', params.id))?.tps_id)
      fail(422, 'Petugas wajib dikaitkan dengan satu TPS');
    await updateRow(env, 'users', params.id, d);
    return json({ ok: true });
  });

  // Statistik dashboard: super_admin = semua TPS, admin_tps = TPS miliknya (?1 NULL -> semua).
  r.add('GET', '/api/admin/stats', ADM, async ({ env, user }) => {
    const scope = user.role === 'admin_tps' ? user.tps_id : null;
    const [row] = await all(env,
      `SELECT
        (SELECT COUNT(*) FROM setoran s WHERE s.status='menunggu' AND (?1 IS NULL OR s.tps_id=?1)) AS setoran_menunggu,
        (SELECT COALESCE(SUM(berat_kg),0) FROM setoran s WHERE s.status='disetujui' AND (?1 IS NULL OR s.tps_id=?1)) AS total_kg,
        (SELECT COALESCE(SUM(nilai),0) FROM setoran s WHERE s.status='disetujui' AND (?1 IS NULL OR s.tps_id=?1)) AS total_nilai,
        (SELECT COUNT(*) FROM penukaran WHERE status='menunggu') AS tukar_menunggu,
        (SELECT COUNT(*) FROM users WHERE role='nasabah') AS nasabah`, scope);
    return json(row);
  });
};
