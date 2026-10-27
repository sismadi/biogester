// Filter visibilitas per peran (satu aturan untuk list DAN detail -> akses tidak bisa berbeda).
//   super_admin: semua · admin_tps: TPS miliknya · selain itu (nasabah/pengepul): baris miliknya sendiri.
// cols = { own: 'kolom pemilik', tps: 'kolom tps' } (nama kolom dari konfigurasi server, bukan input user).
export const scopeBy = (u, { own, tps }) =>
  u.role === 'super_admin' ? { sql: '', p: [] }
  : u.role === 'admin_tps' ? { sql: ` AND ${tps}=?`, p: [u.tps_id] }
  : { sql: ` AND ${own}=?`, p: [u.id] };
