// Tampilan pengelolaan TPS: penjualan ke pengepul (+stok) dan delegasi peran.
import { api } from '../api.js';
import { ROLE_LABEL, $, esc, rupiah, tgl, badge, empty, katIcon, formHtml, submitForm, on, toast, modal, closeModal, pickerHtml, bindPicker } from '../ui.js';
import { reviewList } from './admin.js';

const kg = (n) => Number(n).toFixed(1) + ' kg';

/* ---- Penjualan ke pengepul ---- */
async function formJual(ctx, tpsList, refresh, tpsId) {
  const isSuper = ctx.user.role === 'super_admin';
  tpsId ??= isSuper ? tpsList[0]?.id : ctx.user.tps_id;
  const [stok, pengepul] = await Promise.all([api.get('/stok' + (tpsId ? `?tps_id=${tpsId}` : '')), api.get('/pengepul')]);
  if (!pengepul.length) return toast('Belum ada pengepul. Delegasikan pengguna menjadi pengepul dahulu.', 'err');
  const items = stok.map((s) => ({ ...s, meta: kg(s.stok) }));
  const fields = [
    ...(isSuper ? [{ name: 'tps_id', label: 'TPS asal', type: 'select', options: tpsList.map((t) => ({ value: t.id, label: t.nama })) }] : []),
    { name: 'pengepul_id', label: 'Pengepul', type: 'select', options: pengepul.map((p) => ({ value: p.id, label: `${p.nama} · ${p.no_hp}` })) },
    { name: 'berat_kg', label: 'Berat (kg)', type: 'number', step: '0.1', min: '0.1' },
    { name: 'harga_per_kg', label: 'Harga per kg (Rp)', type: 'number', min: '0', optional: true },
  ];
  const d = modal(`<h3>Jual ke Pengepul</h3><form>${items.length ? pickerHtml({ name: 'jenis_id', label: 'Jenis (stok tersedia)' }) : empty('Stok TPS kosong.')}
    ${formHtml(fields, { tps_id: tpsId }, 'Kirim Penawaran')}</form><div class="actions"><button class="btn ghost" id="tutup">Batal</button></div>`);
  $('#tutup', d).onclick = closeModal;
  const form = $('form', d);
  if (isSuper) form.tps_id.onchange = () => formJual(ctx, tpsList, refresh, form.tps_id.value);
  const pk = items.length && bindPicker(form, items, { name: 'jenis_id', onPick: (j) => { form.harga_per_kg.value = j.harga_per_kg; form.berat_kg.max = j.stok; } });
  submitForm(form, async (data) => {
    if (!pk || !pk.value()) throw new Error('Pilih jenis sampah terlebih dahulu');
    await api.post('/penjualan', { ...data, harga_per_kg: data.harga_per_kg === '' ? undefined : data.harga_per_kg });
    closeModal(); toast('Penawaran terkirim ke pengepul.'); refresh();
  });
}

export async function penjualan(el, ctx) {
  const tpsList = ctx.user.role === 'super_admin' ? await api.get('/tps') : [];
  const stok = await api.get('/stok' + (ctx.user.role === 'super_admin' ? '' : `?tps_id=${ctx.user.tps_id}`));
  const head = `<div class="row"><h2>Penjualan ke Pengepul</h2><button class="btn sm" id="jual">+ Jual</button></div>
    <h3>Stok${ctx.user.role === 'super_admin' ? ' semua TPS' : ' TPS'}</h3>
    <div class="stats">${stok.length ? stok.map((s) => `<div class="stat">${katIcon(s.kategori)}<span class="muted">${esc(s.nama)}</span><b>${kg(s.stok)}</b></div>`).join('') : empty('Stok kosong.')}</div>`;
  const holder = document.createElement('div');
  el.replaceChildren();
  el.insertAdjacentHTML('beforeend', head);
  el.append(holder);
  $('#jual', el).onclick = () => formJual(ctx, tpsList, () => penjualan(el, ctx));
  await reviewList(holder, {
    title: 'Riwayat Penjualan', endpoint: '/penjualan', statuses: ['menunggu', 'diterima', 'ditolak', 'dibatalkan'],
    row: {
      head: '<thead><tr><th>Tanggal</th><th>Pengepul</th><th>Jenis</th><th>Berat</th><th>Nilai</th><th></th></tr></thead>',
      body: (p) => `<tr><td>${tgl(p.created_at)}<br><span class="muted">${esc(p.kode)}</span></td><td>${esc(p.pengepul)}</td><td>${esc(p.jenis)}</td><td>${kg(p.berat_kg)}</td><td>${rupiah(p.nilai)}</td>
        <td>${p.status === 'menunggu' ? `<button class="btn sm bad" data-act="dibatalkan" data-id="${p.id}">Batalkan</button>` : badge(p.status)}</td></tr>`,
    },
    onRowClick: async (status, id, refresh) => {
      if (!confirm('Batalkan penawaran ini?')) return;
      try { await api.patch('/penjualan/' + id, { status }); toast('Penawaran dibatalkan'); penjualan(el, ctx); } catch (e) { toast(e.message, 'err'); }
    },
  });
}

/* ---- Delegasi peran ---- */
function formDelegasi(ctx, tpsList, u, refresh) {
  const isSuper = ctx.user.role === 'super_admin';
  const roles = isSuper ? ['nasabah', 'admin_tps', 'pengepul'] : ['nasabah', 'admin_tps'];
  const d = modal(`<h3>${esc(u.nama)}</h3><p class="muted">${esc(u.no_hp)} · saat ini ${esc(ROLE_LABEL[u.role])}</p><form>${formHtml([
    { name: 'role', label: 'Jadikan', type: 'select', options: roles.map((v) => ({ value: v, label: ROLE_LABEL[v] })) },
    ...(isSuper ? [{ name: 'tps_id', label: 'TPS (wajib untuk Petugas)', type: 'select', optional: true, options: [{ value: '', label: '-' }, ...tpsList.map((t) => ({ value: t.id, label: t.nama }))] }] : []),
  ], { role: u.role === 'nasabah' ? 'admin_tps' : 'nasabah', tps_id: u.tps_id ?? '' }, 'Terapkan')}</form>
    <div class="actions"><button class="btn ghost" id="tutup">Batal</button></div>`);
  $('#tutup', d).onclick = closeModal;
  const form = $('form', d);
  if (isSuper) { const t = form.tps_id.closest('label'); const sync = () => { const h = form.role.value !== 'admin_tps'; t.classList.toggle('hidden', h); form.tps_id.required = !h; }; form.role.onchange = sync; sync(); }
  submitForm(form, async (data) => {
    await api.post('/delegasi', { user_id: u.id, role: data.role, tps_id: data.tps_id || undefined });
    closeModal(); toast('Peran diperbarui'); refresh();
  });
}

export async function delegasi(el, ctx) {
  const [info, tpsList] = await Promise.all([api.get('/delegasi'), ctx.user.role === 'super_admin' ? api.get('/tps') : []]);
  el.innerHTML = `<h2>Delegasi Petugas & Pengepul</h2>
    <div class="card"><label class="field"><span>Cari pengguna (nama / no HP)</span><span class="search">${'<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'}<input type="search" id="cari" placeholder="Min. 2 huruf atau angka" autocomplete="off"></span></label>
      <div id="hasil"></div></div>
    <h3>Petugas & pengepul aktif</h3><div class="tablewrap">${info.aktif.length ? `<table><thead><tr><th>Nama</th><th>No HP</th><th>Peran</th><th>TPS</th></tr></thead><tbody>${info.aktif.map((u) =>
      `<tr class="click" data-uid="${u.id}"><td>${esc(u.nama)}</td><td>${esc(u.no_hp)}</td><td>${esc(ROLE_LABEL[u.role])}</td><td>${esc(u.tps || '-')}</td></tr>`).join('')}</tbody></table>` : empty('Belum ada.')}</div>
    <h3>Riwayat delegasi</h3><div class="card">${info.riwayat.length ? info.riwayat.map((r) => `<div class="item"><div><b>${esc(r.pengguna)}</b>: ${esc(ROLE_LABEL[r.dari_role])} → ${esc(ROLE_LABEL[r.ke_role])}${r.tps ? ` (${esc(r.tps)})` : ''}<br><span class="muted">oleh ${esc(r.oleh)} · ${tgl(r.created_at)}</span></div></div>`).join('') : empty('Belum ada riwayat.')}</div>`;
  const refresh = () => delegasi(el, ctx);
  let found = [], timer;
  const hasil = $('#hasil', el);
  $('#cari', el).addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const t = e.target.value.trim();
      if (t.length < 2) { found = []; hasil.innerHTML = ''; return; }
      try {
        found = await api.get('/delegasi/cari?q=' + encodeURIComponent(t));
        hasil.innerHTML = found.length ? found.map((u) => `<div class="item"><div><b>${esc(u.nama)}</b><br><span class="muted">${esc(u.no_hp)} · ${esc(ROLE_LABEL[u.role])}</span></div>
          <div class="end"><button class="btn sm" data-uid="${u.id}">Atur peran</button></div></div>`).join('') : empty('Pengguna tidak ditemukan.');
      } catch (err) { toast(err.message, 'err'); }
    }, 250);
  });
  const open = (id) => { const u = [...found, ...info.aktif].find((x) => String(x.id) === id); if (u) formDelegasi(ctx, tpsList, u, refresh); };
  on(el, 'click', 'button[data-uid]', (e, b) => open(b.dataset.uid));
  on(el, 'click', 'tr[data-uid]', (e, tr) => open(tr.dataset.uid));
}
