// Service Dompet: saldo & riwayat gabungan (setor + tukar) milik nasabah.
import { json } from '../lib/http.js';
import { all, first, SALDO_SQL } from '../lib/db.js';
import { NAS } from '../lib/roles.js';

export const register = (r) => {
  r.add('GET', '/api/saldo', NAS, async ({ env, user }) =>
    json(await first(env,
      `SELECT ${SALDO_SQL} AS saldo,
        COALESCE((SELECT SUM(berat_kg) FROM setoran WHERE user_id=?1 AND status='disetujui' AND created_at>=date('now','start of month')),0) AS kg_bulan_ini`,
      user.id)));

  r.add('GET', '/api/riwayat', NAS, async ({ env, user }) =>
    json(await all(env,
      `SELECT 'setor' AS tipe,s.kode,s.nilai AS jumlah,s.status,s.created_at,j.nama||' '||s.berat_kg||' kg' AS ket
         FROM setoran s JOIN jenis_sampah j ON j.id=s.jenis_id WHERE s.user_id=?1
       UNION ALL SELECT 'tukar',kode,nominal,status,created_at,metode FROM penukaran WHERE user_id=?1
       ORDER BY created_at DESC LIMIT 100`, user.id)));
};
