// Service Backup/Restore (hanya super_admin, wajib konfirmasi PIN).
//   Backup : seluruh tabel data -> satu berkas JSON (termasuk hash PIN & foto, jadi simpan dengan aman).
//   Restore: MENGGANTI seluruh data dengan isi berkas, dalam SATU batch D1 (transaksi) -> gagal = tidak ada yang berubah.
// Kolom diambil dari skema D1 yang berjalan (pragma_table_info), jadi tabel/kolom baru tidak perlu mengubah kode ini
// selain mendaftarkan nama tabelnya di TABLES.
import { json, body, fail, validate } from '../lib/http.js';
import { all, first, q, batch } from '../lib/db.js';
import { verifyPin } from '../lib/crypto.js';
import { SUP } from '../lib/roles.js';

// Urutan induk -> anak (insert maju, delete mundur) agar foreign key terpenuhi.
const TABLES = ['tps', 'users', 'jenis_sampah', 'edukasi', 'setoran', 'penukaran', 'penjualan', 'delegasi', 'toko', 'produk', 'pesanan', 'notifikasi'];
const FORMAT = { app: 'basadi', version: 1 };
const MAX_PARAMS = 90;          // batas parameter per statement D1 = 100
const MAX_CHUNK_BYTES = 400_000; // batas ukuran parameter per statement (foto base64 besar)

const PIN = { pin: { required: true, label: 'PIN', pattern: /^\d{6}$/, msg: 'PIN harus 6 digit angka' } };

async function confirmPin(env, user, data) {
  const { pin } = validate(data, PIN);
  const row = await first(env, 'SELECT pin_hash FROM users WHERE id=?', user.id);
  if (!row || !(await verifyPin(pin, row.pin_hash))) fail(403, 'PIN salah');
}

const columns = async (env, table) =>
  (await all(env, 'SELECT name FROM pragma_table_info(?)', table)).map((c) => c.name);

export async function exportAll(env) {
  const tables = {};
  for (const t of TABLES) tables[t] = await all(env, `SELECT * FROM ${t} ORDER BY id`);
  return { ...FORMAT, created_at: new Date().toISOString(), tables };
}

const isScalar = (v) => v === null || ['string', 'number'].includes(typeof v);

// Validasi berkas + ubah jadi daftar statement. Semua kesalahan ditolak SEBELUM data apa pun diubah.
async function planRestore(env, dump) {
  if (dump?.app !== FORMAT.app || dump.version !== FORMAT.version || typeof dump.tables !== 'object')
    fail(422, 'Berkas bukan backup Basadi yang valid');
  const unknown = Object.keys(dump.tables).filter((t) => !TABLES.includes(t));
  if (unknown.length) fail(422, `Tabel tidak dikenal: ${unknown.join(', ')}`);

  const inserts = [], counts = {};
  for (const t of TABLES) {
    const rows = dump.tables[t] ?? [];
    if (!Array.isArray(rows)) fail(422, `Data tabel ${t} tidak valid`);
    const cols = await columns(env, t);
    counts[t] = rows.length;
    let batchRows = [], params = 0, bytes = 0;
    const flush = () => {
      if (!batchRows.length) return;
      const one = `(${cols.map(() => '?').join(',')})`;
      inserts.push(q(env, `INSERT INTO ${t}(${cols.join(',')}) VALUES ${batchRows.map(() => one).join(',')}`, ...batchRows.flat()));
      batchRows = []; params = 0; bytes = 0;
    };
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail(422, `Baris tabel ${t} tidak valid`);
      const extra = Object.keys(row).filter((k) => !cols.includes(k));
      if (extra.length) fail(422, `Kolom tidak dikenal pada ${t}: ${extra.join(', ')}`);
      const vals = cols.map((c) => row[c] ?? null);
      if (!vals.every(isScalar)) fail(422, `Nilai tidak valid pada tabel ${t}`);
      const size = vals.reduce((n, v) => n + (typeof v === 'string' ? v.length : 8), 0);
      if (params + cols.length > MAX_PARAMS || bytes + size > MAX_CHUNK_BYTES) flush();
      batchRows.push(vals); params += cols.length; bytes += size;
    }
    flush();
  }
  const admins = (dump.tables.users ?? []).filter((u) => u.role === 'super_admin' && u.aktif === 1);
  if (!admins.length) fail(422, 'Backup harus memuat minimal satu admin aktif, kalau tidak Anda tidak bisa masuk lagi');
  return { inserts, counts };
}

export const register = (r) => {
  r.add('POST', '/api/admin/backup', SUP, async ({ req, env, user }) => {
    await confirmPin(env, user, await body(req));
    const dump = await exportAll(env), stamp = dump.created_at.slice(0, 16).replace(/[-:T]/g, '');
    return new Response(JSON.stringify(dump), { headers: {
      'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'content-disposition': `attachment; filename="basadi-backup-${stamp}.json"` } });
  });

  r.add('POST', '/api/admin/restore', SUP, async ({ req, env, user }) => {
    const data = await body(req);
    await confirmPin(env, user, data);
    const { inserts, counts } = await planRestore(env, data.dump);
    const wipe = [...TABLES].reverse().map((t) => q(env, `DELETE FROM ${t}`));
    await batch(env, [...wipe, ...inserts]);   // atomik: DELETE semua + INSERT semua dalam satu transaksi
    return json({ ok: true, counts });
  });
};
