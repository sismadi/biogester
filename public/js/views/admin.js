// Tampilan Admin TPS & Super Admin: dashboard, verifikasi, master data (CRUD generik), pengguna.
import { api } from '../api.js';
import { ROLE_LABEL, $, esc, rupiah, tgl, badge, empty, formHtml, submitForm, on, toast, modal, closeModal } from '../ui.js';

export async function dashboard(el) {
  const s = await api.get('/admin/stats');
  el.innerHTML = `<h2>Dashboard</h2><div class="stats">
    <div class="stat"><span class="muted">Setoran menunggu</span><b>${s.setoran_menunggu}</b></div>
    <div class="stat"><span class="muted">Penukaran menunggu</span><b>${s.tukar_menunggu}</b></div>
    <div class="stat"><span class="muted">Sampah terkelola</span><b>${Number(s.total_kg).toFixed(1)} kg</b></div>
    <div class="stat"><span class="muted">Nilai tersalur</span><b>${rupiah(s.total_nilai)}</b></div>
    <div class="stat"><span class="muted">Nasabah</span><b>${s.nasabah}</b></div></div>`;
}

/* Daftar dengan filter status (dipakai verifikasi setoran & penukaran). */
export function reviewList(el, { title, endpoint, statuses, row, onRowClick }) {
  let status = statuses[0];
  const draw = async () => {
    const rows = await api.get(`${endpoint}?status=${status}`);
    el.innerHTML = `<h2>${title}</h2><div class="chips">${statuses.map((s) => `<button class="chip ${s === status ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div>
      <div class="tablewrap">${rows.length ? `<table>${row.head}<tbody>${rows.map(row.body).join('')}</tbody></table>` : empty('Tidak ada data.')}</div>`;
    on(el, 'click', '.chip', (e, b) => { status = b.dataset.s; draw(); });
    on(el, 'click', '[data-act]', (e, b) => onRowClick(b.dataset.act, b.dataset.id, draw));
  };
  return draw();
}

export function verifikasiSetoran(el) {
  return reviewList(el, {
    title: 'Verifikasi Setoran', endpoint: '/setoran', statuses: ['menunggu', 'disetujui', 'ditolak'],
    row: {
      head: '<thead><tr><th>Tanggal</th><th>Nasabah</th><th>Jenis</th><th>Berat</th><th>Nilai</th><th>Status</th></tr></thead>',
      body: (s) => `<tr class="click" data-act="open" data-id="${s.id}"><td>${tgl(s.created_at)}</td><td>${esc(s.nasabah)}</td><td>${esc(s.jenis)}</td><td>${s.berat_kg} kg</td><td>${rupiah(s.nilai)}</td><td>${badge(s.status)}</td></tr>`,
    },
    onRowClick: async (act, id, refresh) => {
      const s = await api.get('/setoran/' + id), pending = s.status === 'menunggu';
      const d = modal(`<h3>${esc(s.kode)}</h3><p>${esc(s.nasabah)} · ${esc(s.jenis)} · ${esc(s.tps)}</p>
        ${s.foto ? `<img class="preview" src="${esc(s.foto)}" alt="Foto setoran">` : '<p class="muted">Tidak ada foto.</p>'}
        <form>${pending ? formHtml([
          { name: 'berat_kg', label: 'Berat hasil timbang (kg)', type: 'number', step: '0.1', min: '0.1' },
          { name: 'catatan', label: 'Catatan', optional: true, maxlength: 200 }], { berat_kg: s.berat_kg }, 'Setujui') : `<p>Status: ${badge(s.status)} · ${rupiah(s.nilai)}</p>`}</form>
        <div class="actions">${pending ? '<button class="btn bad" id="tolak">Tolak</button>' : ''}<button class="btn ghost" id="tutup">Tutup</button></div>`);
      $('#tutup', d).onclick = closeModal;
      if (!pending) return;
      const send = async (status, data) => { await api.patch('/setoran/' + id, { ...data, status }); closeModal(); toast('Tersimpan'); refresh(); };
      submitForm($('form', d), (data) => send('disetujui', data));
      $('#tolak', d).onclick = () => send('ditolak', { catatan: $('[name=catatan]', d).value }).catch((e) => toast(e.message, 'err'));
    },
  });
}

export function verifikasiTukar(el) {
  return reviewList(el, {
    title: 'Penukaran Saldo', endpoint: '/penukaran', statuses: ['menunggu', 'selesai', 'ditolak'],
    row: {
      head: '<thead><tr><th>Tanggal</th><th>Nasabah</th><th>Metode / Tujuan</th><th>Nominal</th><th></th></tr></thead>',
      body: (p) => `<tr><td>${tgl(p.created_at)}</td><td>${esc(p.nasabah)}<br><span class="muted">${esc(p.no_hp)}</span></td><td>${esc(p.metode)} ${esc(p.tujuan)}</td><td>${rupiah(p.nominal)}</td>
        <td>${p.status === 'menunggu' ? `<button class="btn sm" data-act="selesai" data-id="${p.id}">Selesai</button> <button class="btn sm bad" data-act="ditolak" data-id="${p.id}">Tolak</button>` : badge(p.status)}</td></tr>`,
    },
    onRowClick: async (status, id, refresh) => {
      try { await api.patch('/penukaran/' + id, { status }); toast('Tersimpan'); refresh(); } catch (e) { toast(e.message, 'err'); }
    },
  });
}

/* ---- Master data: UI dihasilkan dari konfigurasi (field + kolom tabel) ---- */
const MASTER = {
  jenis: { title: 'Jenis Sampah & Harga', path: '/jenis',
    fields: [{ name: 'kode', label: 'Kode', maxlength: 20 }, { name: 'nama', label: 'Nama' }, { name: 'kategori', label: 'Kategori' },
      { name: 'harga_per_kg', label: 'Harga per kg (Rp)', type: 'number', min: '0' },
      { name: 'aktif', label: 'Status', type: 'select', options: [{ value: 1, label: 'Aktif' }, { value: 0, label: 'Nonaktif' }] }],
    cols: [['kode', 'Kode'], ['nama', 'Nama'], ['kategori', 'Kategori'], ['harga_per_kg', 'Harga/kg', rupiah], ['aktif', 'Status', (v) => (v ? 'Aktif' : 'Nonaktif')]] },
  tps: { title: 'Lokasi TPS', path: '/tps',
    fields: [{ name: 'nama', label: 'Nama' }, { name: 'alamat', label: 'Alamat', optional: true }, { name: 'telpon', label: 'Telepon', optional: true },
      { name: 'lat', label: 'Latitude', type: 'number', step: 'any', optional: true }, { name: 'lng', label: 'Longitude', type: 'number', step: 'any', optional: true }],
    cols: [['nama', 'Nama'], ['alamat', 'Alamat'], ['telpon', 'Telepon']] },
  edukasi: { title: 'Konten Edukasi', path: '/edukasi',
    fields: [{ name: 'judul', label: 'Judul' }, { name: 'kategori', label: 'Kategori', optional: true }, { name: 'isi', label: 'Isi', type: 'textarea' }],
    cols: [['judul', 'Judul'], ['kategori', 'Kategori']] },
};

export async function master(el, ctx, key) {
  const cfg = MASTER[key];
  const rows = await api.get(cfg.path);
  el.innerHTML = `<div class="row"><h2>${cfg.title}</h2><button class="btn sm" id="add">+ Tambah</button></div>
    <div class="tablewrap">${rows.length ? `<table><thead><tr>${cfg.cols.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map((r) =>
      `<tr class="click" data-id="${r.id}">${cfg.cols.map(([k, , f]) => `<td>${esc(f ? f(r[k]) : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : empty('Belum ada data.')}</div>`;
  const open = (row) => {
    const d = modal(`<h3>${row ? 'Ubah' : 'Tambah'} data</h3><form>${formHtml(cfg.fields, row || { aktif: 1 })}</form>
      <div class="actions">${row ? '<button class="btn bad" id="hapus">Hapus</button>' : ''}<button class="btn ghost" id="tutup">Batal</button></div>`);
    $('#tutup', d).onclick = closeModal;
    submitForm($('form', d), async (data) => {
      row ? await api.put(`${cfg.path}/${row.id}`, data) : await api.post(cfg.path, data);
      closeModal(); toast('Tersimpan'); master(el, ctx, key);
    });
    if (row) $('#hapus', d).onclick = async () => {
      if (!confirm('Hapus data ini?')) return;
      try { await api.del(`${cfg.path}/${row.id}`); closeModal(); master(el, ctx, key); } catch (e) { toast(e.message, 'err'); }
    };
  };
  $('#add', el).onclick = () => open(null);
  on(el, 'click', 'tr[data-id]', (e, tr) => open(rows.find((r) => String(r.id) === tr.dataset.id)));
}

export async function pengguna(el) {
  const [users, tps] = await Promise.all([api.get('/admin/users'), api.get('/tps')]);
  el.innerHTML = `<h2>Pengguna</h2><div class="tablewrap"><table><thead><tr><th>Nama</th><th>No HP</th><th>Role</th><th>TPS</th><th>Status</th></tr></thead><tbody>${users.map((u) =>
    `<tr class="click" data-id="${u.id}"><td>${esc(u.nama)}</td><td>${esc(u.no_hp)}</td><td>${esc(ROLE_LABEL[u.role])}</td><td>${esc(tps.find((t) => t.id === u.tps_id)?.nama || '-')}</td><td>${u.aktif ? 'Aktif' : 'Nonaktif'}</td></tr>`).join('')}</tbody></table></div>`;
  on(el, 'click', 'tr[data-id]', (e, tr) => {
    const u = users.find((x) => String(x.id) === tr.dataset.id);
    const d = modal(`<h3>${esc(u.nama)}</h3><form>${formHtml([
      { name: 'role', label: 'Role', type: 'select', options: Object.entries(ROLE_LABEL).map(([v, label]) => ({ value: v, label })) },
      { name: 'tps_id', label: 'TPS (wajib untuk Petugas)', type: 'select', optional: true, options: [{ value: '', label: '-' }, ...tps.map((t) => ({ value: t.id, label: t.nama }))] },
      { name: 'aktif', label: 'Status', type: 'select', options: [{ value: 1, label: 'Aktif' }, { value: 0, label: 'Nonaktif' }] }], u)}</form>
      <div class="actions"><button class="btn ghost" id="tutup">Batal</button></div>`);
    $('#tutup', d).onclick = closeModal;
    submitForm($('form', d), async (data) => { await api.patch('/admin/users/' + u.id, data); closeModal(); toast('Tersimpan'); pengguna(el); });
  });
}
