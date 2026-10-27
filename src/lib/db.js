// Pembungkus tipis D1: semua query lewat sini (selalu prepared statement + bind).
import { fail } from './http.js';
export const q = (env, sql, ...p) => env.DB.prepare(sql).bind(...p);
export const all = async (env, sql, ...p) => (await q(env, sql, ...p).all()).results;
export const first = (env, sql, ...p) => q(env, sql, ...p).first();
export const run = (env, sql, ...p) => q(env, sql, ...p).run();
export const batch = (env, stmts) => env.DB.batch(stmts);

// Nama tabel/kolom hanya berasal dari konfigurasi server, nilai selalu di-bind.
export const insertRow = (env, table, d) => {
  const c = Object.keys(d);
  return run(env, `INSERT INTO ${table}(${c.join(',')}) VALUES(${c.map(() => '?').join(',')})`, ...Object.values(d));
};
export const updateRow = (env, table, id, d) => {
  const c = Object.keys(d);
  if (!c.length) fail(422, 'Tidak ada data yang diubah');
  return run(env, `UPDATE ${table} SET ${c.map((k) => k + '=?').join(',')} WHERE id=?`, ...Object.values(d), id);
};

// Notifikasi sebagai statement (agar bisa ikut atomik dalam batch()).
export const notifStmt = (env, userId, judul, isi) =>
  q(env, 'INSERT INTO notifikasi(user_id,judul,isi) VALUES(?,?,?)', userId, judul, isi);

// Saldo = total setoran disetujui - penukaran yang belum ditolak. Dihitung, tidak disimpan -> tidak bisa "drift".
export const SALDO_SQL = `(COALESCE((SELECT SUM(nilai) FROM setoran WHERE user_id=?1 AND status='disetujui'),0)
  - COALESCE((SELECT SUM(nominal) FROM penukaran WHERE user_id=?1 AND status!='ditolak'),0))`;

export const newCode = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${crypto.getRandomValues(new Uint8Array(2)).join('')}`;
