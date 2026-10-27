// Satu sumber kebenaran daftar peran & kelompok akses (dipakai semua service).
export const NAS = ['nasabah'];                 // pengguna
export const PGP = ['pengepul'];                // pengepul
export const ADM = ['admin_tps', 'super_admin']; // petugas TPS + admin
export const SUP = ['super_admin'];
export const STAFF = [...NAS, ...ADM];           // semua kecuali pengepul
export const ROLES = ['nasabah', 'admin_tps', 'pengepul', 'super_admin'];
