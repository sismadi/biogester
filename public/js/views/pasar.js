// Tampilan Pasar POC: etalase produk, daftar toko, pesanan saya (pasar) + profil toko, katalog, pesanan masuk (toko).
// Semua peran memakainya. CSP melarang style inline, jadi seluruh gaya ada di app.css.
import { api } from '../api.js';
import { $, esc, rupiah, tgl, badge, empty, icon, formHtml, submitForm, on, toast, modal, closeModal, compressImage } from '../ui.js';

const KATEGORI = ['POC', 'Kompos', 'Perlengkapan', 'Lainnya'];
const METODE = ['Ambil di toko', 'COD / diantar'];
const fotoUrl = (kind, o) => `/api/${kind}/${o.id}/foto?v=${encodeURIComponent(o.updated_at || '')}`;
const thumb = (kind, o, cls = '') =>
  `<div class="thumb ${cls}">${o.ada_foto ? `<img src="${fotoUrl(kind, o)}" alt="" loading="lazy">` : icon(kind === 'toko' ? 'store' : 'drop')}</div>`;
const opts = (list) => list.map((v) => ({ value: v, label: v }));
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- kartu & modal bersama ---------- */
const kartuProduk = (p) => `<button type="button" class="pcard" data-pid="${p.id}">${thumb('produk', p)}
  <b>${esc(p.nama)}</b><span class="muted">${esc(p.toko)}</span>
  <strong>${rupiah(p.harga)}<small> / ${esc(p.satuan)}</small></strong>
  ${p.tersedia > 0 ? `<span class="muted">Tersedia ${p.tersedia}</span>` : '<span class="badge ditolak">Habis</span>'}</button>`;

function detailProduk(p, done) {
  const bisa = p.tersedia > 0 && !p.milik_saya;
  const d = modal(`<h3>${esc(p.nama)}</h3>${thumb('produk', p, 'big')}
    <p><b>${rupiah(p.harga)}</b> / ${esc(p.satuan)} · <span class="badge">${esc(p.kategori)}</span></p>
    <p class="muted">Toko <button type="button" class="link" data-toko="${p.toko_id}">${esc(p.toko)}</button>${p.toko_alamat ? ' · ' + esc(p.toko_alamat) : ''}${p.kontak ? ' · ' + esc(p.kontak) : ''}</p>
    ${p.deskripsi ? `<p class="prewrap">${esc(p.deskripsi)}</p>` : ''}
    ${bisa ? `<div class="estimate" id="tot"></div><form>${formHtml([
      { name: 'jumlah', label: `Jumlah (tersedia ${p.tersedia})`, type: 'number', min: '1', max: String(p.tersedia), step: '1' },
      { name: 'metode', label: 'Pengambilan', type: 'select', options: opts(METODE) },
      { name: 'catatan', label: 'Catatan untuk penjual', optional: true, maxlength: 200 },
    ], { jumlah: 1 }, 'Pesan Sekarang')}</form><p class="muted">Pembayaran langsung ke penjual saat serah terima.</p>`
      : `<p class="muted">${p.milik_saya ? 'Ini produk toko Anda.' : 'Stok sedang habis.'}</p>`}
    <div class="actions"><button class="btn ghost" id="tutup">Tutup</button></div>`);
  $('#tutup', d).onclick = closeModal;
  on(d, 'click', '[data-toko]', (e, b) => detailToko(b.dataset.toko, done));
  if (!bisa) return;
  const form = $('form', d), tot = () => { $('#tot', d).textContent = 'Total: ' + rupiah((Number(form.jumlah.value) || 0) * p.harga); };
  form.addEventListener('input', tot); tot();
  submitForm(form, async (data) => {
    await api.post('/pesanan', { produk_id: p.id, jumlah: data.jumlah, metode: data.metode, catatan: data.catatan });
    closeModal(); toast('Pesanan terkirim ke penjual.'); done?.();
  });
}

async function detailToko(id, done) {
  const [t, rows] = await Promise.all([api.get('/toko/' + id), api.get('/pasar?toko_id=' + id)]).catch((e) => { toast(e.message, 'err'); return []; });
  if (!t) return;
  const d = modal(`<div class="tokohead">${thumb('toko', t)}<div><h3>${esc(t.nama)}</h3><p class="muted">oleh ${esc(t.pemilik)}</p></div></div>
    ${t.deskripsi ? `<p class="prewrap">${esc(t.deskripsi)}</p>` : ''}
    <p class="muted">${[t.alamat, t.kontak].filter(Boolean).map(esc).join(' · ')}</p>
    ${rows.length ? `<div class="pgrid">${rows.map(kartuProduk).join('')}</div>` : empty('Belum ada produk.')}
    <div class="actions"><button class="btn ghost" id="tutup">Tutup</button></div>`);
  $('#tutup', d).onclick = closeModal;
  on(d, 'click', '[data-pid]', (e, b) => detailProduk(rows.find((x) => String(x.id) === b.dataset.pid), done));
}

/* ---------- daftar pesanan (dipakai Pasar = pesanan saya, Toko = pesanan masuk) ---------- */
const STATUS = ['', 'menunggu', 'diproses', 'selesai', 'ditolak', 'dibatalkan'];
function aksi(o, peran) {
  const b = (st, label, cls = '') => `<button class="btn sm ${cls}" data-st="${st}" data-id="${o.id}">${label}</button>`;
  if (peran === 'beli') return o.status === 'menunggu' ? b('dibatalkan', 'Batalkan', 'bad') : '';
  if (o.status === 'menunggu') return b('diproses', 'Terima') + b('ditolak', 'Tolak', 'bad');
  if (o.status === 'diproses') return b('selesai', 'Selesai') + b('ditolak', 'Batalkan', 'bad');
  return '';
}
async function pesananPanel(holder, peran) {
  let status = '';
  const draw = async () => {
    const rows = await api.get(`/pesanan?peran=${peran}${status ? '&status=' + status : ''}`);
    holder.innerHTML = `<div class="chips">${STATUS.map((s) => `<button class="chip ${s === status ? 'on' : ''}" data-s="${s}">${s || 'semua'}</button>`).join('')}</div>` +
      (rows.length ? `<div class="olist">${rows.map((o) => `<div class="card pesanan"><div class="row"><b>${esc(o.nama_produk)} × ${o.jumlah}</b>${badge(o.status)}</div>
        <p class="muted">${esc(o.kode)} · ${tgl(o.created_at)} · ${esc(o.metode)}</p>
        <p><b>${rupiah(o.total)}</b> <span class="muted">(${rupiah(o.harga_satuan)} / satuan)</span></p>
        <p class="muted">${peran === 'beli' ? `Toko ${esc(o.toko)}${o.kontak_toko ? ' · ' + esc(o.kontak_toko) : ''}` : `Pembeli ${esc(o.pembeli)} · ${esc(o.hp_pembeli)}`}</p>
        ${o.catatan ? `<p>Catatan: ${esc(o.catatan)}</p>` : ''}${o.catatan_penjual ? `<p>Dari penjual: ${esc(o.catatan_penjual)}</p>` : ''}
        <div class="row-actions">${aksi(o, peran)}</div></div>`).join('')}</div>` : empty('Belum ada pesanan.'));
  };
  on(holder, 'click', '.chip', (e, b) => { status = b.dataset.s; draw().catch((x) => toast(x.message, 'err')); });
  on(holder, 'click', '[data-st]', async (e, b) => {
    const st = b.dataset.st;
    let catatan = '';
    if (peran === 'jual' && ['ditolak'].includes(st)) { catatan = prompt('Alasan (opsional):'); if (catatan === null) return; }
    else if (!confirm(st === 'dibatalkan' ? 'Batalkan pesanan ini?' : 'Lanjutkan?')) return;
    try { await api.patch('/pesanan/' + b.dataset.id, { status: st, catatan }); toast('Tersimpan'); await draw(); } catch (err) { toast(err.message, 'err'); }
  });
  await draw();
}

/* ---------- PASAR ---------- */
let tab = 'produk', kat = '', cari = '';
export async function pasar(el) {
  const rerender = () => pasar(el);
  el.innerHTML = `<h2>Pasar POC</h2><div class="chips tabs">${[['produk', 'Produk'], ['toko', 'Toko'], ['pesanan', 'Pesanan saya']]
    .map(([k, l]) => `<button class="chip ${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="isi"></div>`;
  on(el, 'click', '[data-tab]', (e, b) => { tab = b.dataset.tab; rerender(); });
  const isi = $('#isi', el);
  const done = () => { tab = 'pesanan'; rerender(); };

  if (tab === 'pesanan') return pesananPanel(isi, 'beli');

  if (tab === 'toko') {
    const rows = await api.get('/toko');
    isi.innerHTML = rows.length ? `<div class="pgrid">${rows.map((t) => `<button type="button" class="pcard" data-tid="${t.id}">${thumb('toko', t)}<b>${esc(t.nama)}</b>
      <span class="muted">${esc(t.alamat || t.pemilik)}</span><span class="muted">${t.jml_produk} produk</span></button>`).join('')}</div>` : empty('Belum ada toko yang buka.');
    on(isi, 'click', '[data-tid]', (e, b) => detailToko(b.dataset.tid, done));
    return;
  }

  isi.innerHTML = `<label class="search">${icon('search')}<input type="search" id="cari" value="${esc(cari)}" placeholder="Cari POC, kompos, atau toko…" autocomplete="off" aria-label="Cari produk"></label>
    <div class="chips mt">${['', ...KATEGORI].map((c) => `<button class="chip ${c === kat ? 'on' : ''}" data-kat="${esc(c)}">${esc(c || 'Semua')}</button>`).join('')}</div><div id="grid"></div>`;
  const grid = $('#grid', isi);
  let rows = [];
  const load = async () => {
    rows = await api.get(`/pasar?q=${encodeURIComponent(cari)}&kategori=${encodeURIComponent(kat)}`);
    grid.innerHTML = rows.length ? `<div class="pgrid">${rows.map(kartuProduk).join('')}</div>` : empty('Belum ada produk yang cocok.');
  };
  $('#cari', isi).addEventListener('input', debounce((e) => { cari = e.target.value.trim(); load().catch((x) => toast(x.message, 'err')); }));
  on(isi, 'click', '[data-kat]', (e, b) => {
    kat = b.dataset.kat;
    isi.querySelectorAll('[data-kat]').forEach((c) => c.classList.toggle('on', c === b));
    load().catch((x) => toast(x.message, 'err'));
  });
  on(grid, 'click', '[data-pid]', (e, b) => detailProduk(rows.find((x) => String(x.id) === b.dataset.pid), done));
  await load();
}

/* ---------- TOKO SAYA ---------- */
// Pilih/hapus foto: st.v = undefined (tidak berubah) | data URL (baru) | '' (hapus).
function fotoInput(form, currentUrl) {
  const st = { v: undefined };
  const wrap = document.createElement('div');
  wrap.className = 'fotoprev';
  wrap.innerHTML = '<img class="preview hidden" alt="Pratinjau foto"><button type="button" class="btn sm bad hidden">Hapus foto</button>';
  form.foto.closest('label').after(wrap);
  const img = $('img', wrap), del = $('button', wrap);
  const show = (src) => { img.src = src; img.classList.remove('hidden'); del.classList.remove('hidden'); };
  if (currentUrl) show(currentUrl);
  form.foto.addEventListener('change', async () => {
    const f = form.foto.files[0];
    if (!f) return;
    try { st.v = await compressImage(f); show(st.v); } catch (e) { toast(e.message, 'err'); form.foto.value = ''; }
  });
  del.onclick = () => { st.v = ''; form.foto.value = ''; img.classList.add('hidden'); del.classList.add('hidden'); };
  return st;
}

function formToko(container, t, done) {
  const baru = !t;
  const fields = [
    { name: 'nama', label: 'Nama toko', maxlength: 80 },
    { name: 'deskripsi', label: 'Deskripsi toko', type: 'textarea', optional: true },
    { name: 'alamat', label: 'Alamat / lokasi pengambilan', optional: true, maxlength: 200 },
    { name: 'kontak', label: 'WhatsApp / telepon (tampil ke pembeli)', optional: true, maxlength: 30, inputmode: 'tel' },
    ...(baru ? [] : [{ name: 'aktif', label: 'Status toko', type: 'select', options: [{ value: 1, label: 'Buka' }, { value: 0, label: 'Tutup (disembunyikan)' }] }]),
    { name: 'foto', label: 'Foto / logo toko', type: 'file', accept: 'image/*', optional: true },
  ];
  container.innerHTML = `<form>${formHtml(fields, t || {}, baru ? 'Buka Toko' : 'Simpan')}</form>`;
  const form = $('form', container), st = fotoInput(form, t?.ada_foto ? fotoUrl('toko', t) : '');
  submitForm(form, async (d) => {
    await api.put('/toko/saya', { nama: d.nama, deskripsi: d.deskripsi, alamat: d.alamat, kontak: d.kontak, ...(baru ? {} : { aktif: d.aktif }), foto: st.v });
    toast(baru ? 'Toko dibuka.' : 'Profil toko disimpan.'); done();
  });
}

function formProduk(p, done) {
  const fields = [
    { name: 'nama', label: 'Nama produk', maxlength: 100 },
    { name: 'kategori', label: 'Kategori', type: 'select', options: opts(KATEGORI) },
    { name: 'satuan', label: 'Satuan (mis. botol 1 L)', maxlength: 30 },
    { name: 'harga', label: 'Harga per satuan (Rp)', type: 'number', min: '0', step: '500' },
    { name: 'stok', label: 'Stok total (termasuk yang sudah dipesan)', type: 'number', min: String(p?.komit ?? 0), step: '1' },
    { name: 'deskripsi', label: 'Deskripsi (komposisi, cara pakai)', type: 'textarea', optional: true },
    { name: 'aktif', label: 'Tampilkan di pasar', type: 'select', options: [{ value: 1, label: 'Ya' }, { value: 0, label: 'Sembunyikan' }] },
    { name: 'foto', label: 'Foto produk', type: 'file', accept: 'image/*', optional: true },
  ];
  const d = modal(`<h3>${p ? 'Ubah Produk' : 'Produk Baru'}</h3><form>${formHtml(fields, p || { kategori: 'POC', satuan: 'botol 1 L', stok: 0, aktif: 1 }, 'Simpan')}</form>
    <div class="actions">${p ? '<button class="btn bad" id="hapus">Hapus</button>' : ''}<button class="btn ghost" id="tutup">Batal</button></div>`);
  $('#tutup', d).onclick = closeModal;
  const form = $('form', d), st = fotoInput(form, p?.ada_foto ? fotoUrl('produk', p) : '');
  submitForm(form, async (x) => {
    const body = { nama: x.nama, kategori: x.kategori, satuan: x.satuan, harga: x.harga, stok: x.stok, deskripsi: x.deskripsi, aktif: x.aktif, foto: st.v };
    if (p) await api.put('/produk/' + p.id, body); else await api.post('/produk', body);
    closeModal(); toast('Produk disimpan.'); done();
  });
  if (p) $('#hapus', d).onclick = async () => {
    if (!confirm('Hapus produk ini?')) return;
    try { await api.del('/produk/' + p.id); closeModal(); toast('Produk dihapus.'); done(); } catch (e) { toast(e.message, 'err'); }
  };
}

export async function toko(el) {
  const t = await api.get('/toko/saya');
  const rerender = () => toko(el);
  if (!t) {
    el.innerHTML = `<h2>Buka Toko</h2><p class="muted">Jual POC dan produk BioGester Anda ke warga lain. Setelah toko dibuka, tambahkan produk ke katalog.</p><div class="card" id="f"></div>`;
    return formToko($('#f', el), null, rerender);
  }
  const produk = await api.get('/produk/saya');
  el.innerHTML = `<div class="row"><h2>Toko Saya</h2><button class="btn sm ghost" id="ubah">Ubah profil</button></div>
    <div class="card tokohead">${thumb('toko', t)}<div><b>${esc(t.nama)}</b> ${t.aktif ? '' : '<span class="badge dibatalkan">Tutup</span>'}
      ${t.deskripsi ? `<p class="prewrap">${esc(t.deskripsi)}</p>` : ''}<p class="muted">${[t.alamat, t.kontak].filter(Boolean).map(esc).join(' · ') || 'Alamat dan kontak belum diisi'}</p></div></div>
    <div class="row"><h3>Katalog Produk</h3><button class="btn sm" id="tambah">+ Produk</button></div>
    ${produk.length ? `<div class="pgrid">${produk.map((p) => `<button type="button" class="pcard" data-eid="${p.id}">${thumb('produk', p)}<b>${esc(p.nama)}</b>
      <strong>${rupiah(p.harga)}<small> / ${esc(p.satuan)}</small></strong><span class="muted">Tersedia ${p.tersedia} · dipesan ${p.komit}</span>
      ${p.aktif ? '' : '<span class="badge dibatalkan">Tersembunyi</span>'}</button>`).join('')}</div>` : empty('Katalog masih kosong. Tambahkan produk pertama Anda.')}
    <h3>Pesanan Masuk</h3><div id="pm"></div>`;
  $('#ubah', el).onclick = () => {
    const d = modal('<h3>Ubah Profil Toko</h3><div id="f"></div><div class="actions"><button class="btn ghost" id="tutup">Batal</button></div>');
    $('#tutup', d).onclick = closeModal;
    formToko($('#f', d), t, () => { closeModal(); rerender(); });
  };
  $('#tambah', el).onclick = () => formProduk(null, rerender);
  on(el, 'click', '[data-eid]', (e, b) => formProduk(produk.find((x) => String(x.id) === b.dataset.eid), rerender));
  await pesananPanel($('#pm', el), 'jual');
}
