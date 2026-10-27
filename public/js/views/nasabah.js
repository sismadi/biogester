// Tampilan Nasabah: beranda, setor, tukar, riwayat, lokasi TPS, edukasi, notifikasi.
import { api } from '../api.js';
import { $, esc, rupiah, tgl, badge, empty, icon, formHtml, submitForm, on, toast, compressImage, pickerHtml, bindPicker } from '../ui.js';

const riwayatList = (rows) => rows.length ? rows.map((r) => `
  <div class="item">
    <div><b>${r.tipe === 'setor' ? 'Setor' : 'Tukar'}</b> · ${esc(r.ket)}<br><span class="muted">${tgl(r.created_at)} · ${esc(r.kode)}</span></div>
    <div class="end"><span class="amt ${r.tipe === 'tukar' ? 'out' : ''}">${r.tipe === 'tukar' ? '−' : '+'}${rupiah(r.jumlah)}</span><br>${badge(r.status)}</div>
  </div>`).join('') : empty('Belum ada transaksi.');

export async function beranda(el, { user }) {
  const [s, r] = await Promise.all([api.get('/saldo'), api.get('/riwayat')]);
  el.innerHTML = `
    <h2>Halo, ${esc(user.nama.split(' ')[0])}</h2>
    <section class="saldo"><span>Saldo</span><strong>${rupiah(s.saldo)}</strong></section>
    <div class="quick"><a href="#/setor">${icon('upload')}Setor Sampah</a><a href="#/tukar">${icon('swap')}Tukar Saldo</a></div>
    <div class="stat"><span class="muted">Sampah terkumpul bulan ini</span><b>${Number(s.kg_bulan_ini).toFixed(1)} kg</b></div>
    <h3>Aktivitas terakhir</h3><div class="card">${riwayatList(r.slice(0, 5))}</div>`;
}

export async function setor(el) {
  const [jenis, tps] = await Promise.all([api.get('/jenis'), api.get('/tps')]);
  const aktif = jenis.filter((j) => j.aktif).map((j) => ({ ...j, meta: rupiah(j.harga_per_kg) + '/kg' }));
  const fields = [
    { name: 'tps_id', label: 'Lokasi setor', type: 'select', options: tps.map((t) => ({ value: t.id, label: t.nama })) },
    { name: 'berat_kg', label: 'Berat (kg)', type: 'number', step: '0.1', min: '0.1', max: '1000' },
    { name: 'foto', label: 'Unggah foto', type: 'file', accept: 'image/*', optional: true },
  ];
  el.innerHTML = `<h2>Setor Sampah</h2><div class="card"><form>${pickerHtml({ name: 'jenis_id', label: 'Jenis sampah' })}${formHtml(fields, {}, 'Kirim')}
    <div class="estimate" id="est">Estimasi: Rp 0</div><img id="prev" class="preview hidden" alt="Pratinjau foto"></form></div>
    <p class="muted">Nilai final ditetapkan admin TPS setelah sampah ditimbang.</p>`;
  const form = $('form', el), hargaOf = (id) => aktif.find((j) => String(j.id) === id)?.harga_per_kg || 0;
  const pk = bindPicker(form, aktif, { name: 'jenis_id' });
  const est = () => { $('#est', el).textContent = 'Estimasi: ' + rupiah(Math.round((Number(form.berat_kg.value) || 0) * hargaOf(pk.value()))); };
  form.addEventListener('input', est);
  form.foto.addEventListener('change', async () => {
    const f = form.foto.files[0], img = $('#prev', el);
    if (!f) return img.classList.add('hidden');
    try { img.src = await compressImage(f); img.classList.remove('hidden'); } catch (e) { toast(e.message, 'err'); form.foto.value = ''; }
  });
  submitForm(form, async (d) => {
    if (!d.jenis_id) throw new Error('Pilih jenis sampah terlebih dahulu');
    const foto = $('#prev', el).classList.contains('hidden') ? '' : $('#prev', el).src;
    await api.post('/setoran', { jenis_id: d.jenis_id, tps_id: d.tps_id, berat_kg: d.berat_kg, foto });
    toast('Setoran terkirim, menunggu verifikasi TPS.');
    location.hash = '#/riwayat';
  });
}

export async function tukar(el) {
  const [s, list] = await Promise.all([api.get('/saldo'), api.get('/penukaran')]);
  const fields = [
    { name: 'nominal', label: 'Nominal (Rp)', type: 'number', min: '10000', step: '1000' },
    { name: 'metode', label: 'Metode penukaran', type: 'select', options: ['DANA', 'OVO', 'GoPay', 'Voucher', 'Tunai'].map((v) => ({ value: v, label: v })) },
    { name: 'tujuan', label: 'Nomor e-wallet / kode (kosongkan jika Tunai)', optional: true, maxlength: 60 },
  ];
  el.innerHTML = `<h2>Tukar Saldo</h2><section class="saldo"><span>Saldo tersedia</span><strong>${rupiah(s.saldo)}</strong></section>
    <div class="card"><form>${formHtml(fields, {}, 'Tukar Sekarang')}</form></div>
    <h3>Pengajuan saya</h3><div class="card">${list.length ? list.map((p) => `
      <div class="item"><div><b>${esc(p.metode)}</b> ${esc(p.tujuan)}<br><span class="muted">${tgl(p.created_at)}</span></div>
      <div class="end"><span class="amt out">${rupiah(p.nominal)}</span><br>${badge(p.status)}</div></div>`).join('') : empty('Belum ada pengajuan.')}</div>`;
  submitForm($('form', el), async (d) => { await api.post('/penukaran', d); toast('Pengajuan terkirim.'); tukar(el); });
}

export async function riwayat(el) {
  el.innerHTML = `<h2>Riwayat</h2><div class="card">${riwayatList(await api.get('/riwayat'))}</div>`;
}

const km = (a, b, c, d) => { // haversine
  const t = (x) => x * Math.PI / 180, h = Math.sin(t(c - a) / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(t(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
export async function tps(el) {
  let rows = await api.get('/tps');
  const draw = () => {
    el.innerHTML = `<h2>Lokasi TPS / Mitra</h2><button class="btn ghost" id="near">Urutkan dari terdekat</button><div class="actions"></div>` +
      (rows.length ? rows.map((t) => `<div class="card"><b>${esc(t.nama)}</b>${t.jarak != null ? ` <span class="badge">${t.jarak.toFixed(1)} km</span>` : ''}
        <p class="muted">${esc(t.alamat)}${t.telpon ? ' · ' + esc(t.telpon) : ''}</p>
        ${t.lat != null ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}">Buka di Maps</a>` : ''}</div>`).join('') : empty('Belum ada TPS.'));
    $('#near', el).onclick = () => navigator.geolocation?.getCurrentPosition(
      (p) => { rows = rows.map((t) => ({ ...t, jarak: t.lat != null ? km(p.coords.latitude, p.coords.longitude, t.lat, t.lng) : null }))
        .sort((a, b) => (a.jarak ?? 1e9) - (b.jarak ?? 1e9)); draw(); },
      () => toast('Izin lokasi ditolak', 'err'));
  };
  draw();
}

export async function edukasi(el) {
  const rows = await api.get('/edukasi');
  el.innerHTML = `<h2>Edukasi</h2>` + (rows.length ? rows.map((e) => `<details class="card"><summary>${esc(e.judul)} <span class="badge">${esc(e.kategori)}</span></summary><p>${esc(e.isi)}</p></details>`).join('') : empty('Belum ada konten.'));
}

export async function notif(el) {
  const rows = await api.get('/notifikasi');
  el.innerHTML = `<h2>Notifikasi</h2>` + (rows.length ? rows.map((n) => `<div class="card ${n.dibaca ? '' : 'unread'}"><b>${esc(n.judul)}</b><p>${esc(n.isi)}</p><span class="muted">${tgl(n.created_at)}</span></div>`).join('') : empty('Tidak ada notifikasi.'));
  if (rows.some((n) => !n.dibaca)) api.post('/notifikasi/baca').catch(() => {});
}
