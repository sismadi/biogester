// Entry frontend: sesi, shell, router hash. Menu & halaman sepenuhnya digerakkan oleh tabel ROUTES.
import { api } from './api.js';
import { ROLE_LABEL, $, esc, icon, logo, toast } from './ui.js';
import { authView } from './views/auth.js';
import * as N from './views/nasabah.js';
import * as A from './views/admin.js';
import * as K from './views/kelola.js';
import * as P from './views/pengepul.js';
import * as B from './views/backup.js';
import * as M from './views/pasar.js';

const NAS = ['nasabah'], PGP = ['pengepul'], ADM = ['admin_tps', 'super_admin'], SUP = ['super_admin'];
const ALL = [...NAS, ...PGP, ...ADM];
const ROUTES = [
  { path: 'beranda', label: 'Beranda', icon: 'home', roles: NAS, view: N.beranda },
  { path: 'setor', label: 'Setor', icon: 'upload', roles: NAS, view: N.setor },
  { path: 'tukar', label: 'Tukar', icon: 'swap', roles: NAS, view: N.tukar },
  { path: 'riwayat', label: 'Riwayat', icon: 'clock', roles: NAS, view: N.riwayat },
  { path: 'tps', label: 'Lokasi', icon: 'pin', roles: NAS, view: N.tps },
  { path: 'edukasi', label: 'Edukasi', icon: 'book', roles: NAS, view: N.edukasi, hidden: true },
  { path: 'notif', label: 'Notifikasi', icon: 'bell', roles: [...NAS, ...PGP, ...ADM], view: N.notif, hidden: true },

  { path: 'pembelian', label: 'Pembelian', icon: 'truck', roles: PGP, view: P.pembelian, wide: true },
  { path: 'tps', label: 'Lokasi', icon: 'pin', roles: PGP, view: N.tps },

  { path: 'dashboard', label: 'Dashboard', icon: 'grid', roles: ADM, view: A.dashboard, wide: true },
  { path: 'verifikasi', label: 'Setoran', icon: 'check', roles: ADM, view: A.verifikasiSetoran, wide: true },
  { path: 'penukaran', label: 'Penukaran', icon: 'swap', roles: ADM, view: A.verifikasiTukar, wide: true },
  { path: 'penjualan', label: 'Penjualan', icon: 'truck', roles: ADM, view: K.penjualan, wide: true },
  { path: 'delegasi', label: 'Delegasi', icon: 'userplus', roles: ADM, view: K.delegasi, wide: true },
  { path: 'm-jenis', label: 'Harga', icon: 'tag', roles: SUP, view: (e, c) => A.master(e, c, 'jenis'), wide: true },
  { path: 'm-tps', label: 'TPS', icon: 'pin', roles: SUP, view: (e, c) => A.master(e, c, 'tps'), wide: true },
  { path: 'm-edukasi', label: 'Edukasi', icon: 'book', roles: SUP, view: (e, c) => A.master(e, c, 'edukasi'), wide: true },
  { path: 'backup', label: 'Backup', icon: 'db', roles: SUP, view: B.backup },
  { path: 'pengguna', label: 'Pengguna', icon: 'users', roles: SUP, view: A.pengguna, wide: true },

  // Marketplace POC: semua peran dapat membeli dan membuka toko sendiri.
  { path: 'pasar', label: 'Pasar', icon: 'cart', roles: ALL, view: M.pasar, wide: true },
  { path: 'toko', label: 'Toko', icon: 'store', roles: ALL, view: M.toko, wide: true },
];
const HOME = { nasabah: 'beranda', pengepul: 'pembelian', admin_tps: 'dashboard', super_admin: 'dashboard' };

const root = $('#app');
let ctx = null;

function shell() {
  const allowed = ROUTES.filter((r) => r.roles.includes(ctx.user.role));
  root.innerHTML = `<div class="shell">
    <header class="topbar"><div class="brand">${logo}<span>Basadi</span></div>
      <div class="tools"><span class="who">${esc(ctx.user.nama)} · ${ROLE_LABEL[ctx.user.role]}</span>
        <a class="iconbtn" href="#/notif" aria-label="Notifikasi">${icon('bell')}</a>${ctx.user.role === 'nasabah' ? `<a class="iconbtn" href="#/edukasi" aria-label="Edukasi">${icon('book')}</a>` : ''}
        <button class="iconbtn" id="logout" aria-label="Keluar">${icon('out')}</button></div></header>
    <nav class="nav">${allowed.filter((r) => !r.hidden).map((r) => `<a href="#/${r.path}" data-p="${r.path}">${icon(r.icon)}<span>${r.label}</span></a>`).join('')}</nav>
    <main class="content" id="view"></main></div>`;
  $('#logout').onclick = async () => { await api.post('/auth/logout'); start(); };
}

async function route() {
  if (!ctx) return;
  const path = location.hash.replace(/^#\//, '') || HOME[ctx.user.role];
  const r = ROUTES.find((x) => x.path === path && x.roles.includes(ctx.user.role));
  if (!r) { location.hash = '#/' + HOME[ctx.user.role]; return; }
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.p === r.path));
  const view = $('#view');
  view.classList.toggle('wide', !!r.wide);
  view.dataset.page = r.path; // hook CSS per halaman (tata letak desktop)
  view.innerHTML = '<p class="empty">Memuat…</p>';
  try { await r.view(view, ctx); }
  catch (e) {
    if (e.status === 401) return start();
    view.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
  }
}

async function start() {
  try {
    ctx = { user: (await api.get('/me')).user };
    shell();
    route();
  } catch {
    ctx = null;
    authView(root, start).catch((e) => toast(e.message, 'err'));
  }
}

window.addEventListener('hashchange', route);
start();
