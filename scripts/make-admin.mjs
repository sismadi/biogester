// Membuat SQL INSERT untuk admin pertama (PIN di-hash, tidak ada kredensial default di repo).
// Pakai: node scripts/make-admin.mjs 0812xxxxxxxx "Nama" 123456 [super_admin|admin_tps] > admin.sql
import { hashPin } from '../src/lib/crypto.js';
const [, , hp, nama, pin, role = 'super_admin'] = process.argv;
if (!/^08\d{8,12}$/.test(hp || '') || !nama || !/^\d{6}$/.test(pin || '')) {
  console.error('Pemakaian: node scripts/make-admin.mjs 0812xxxxxxxx "Nama" 123456 [role]');
  process.exit(1);
}
const esc = (s) => s.replace(/'/g, "''");
console.log(`INSERT INTO users(no_hp,nama,pin_hash,role) VALUES('${hp}','${esc(nama)}','${await hashPin(pin)}','${role}');`);
