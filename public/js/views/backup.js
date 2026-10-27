// Tampilan Backup & Restore database (super admin). Semua aksi wajib konfirmasi PIN.
import { api } from '../api.js';
import { $, esc, tgl, formHtml, submitForm, toast } from '../ui.js';

const PIN = { name: 'pin', label: 'PIN Anda (konfirmasi)', type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'current-password' };
const NAMA = { tps: 'TPS', users: 'Pengguna', jenis_sampah: 'Jenis sampah', edukasi: 'Edukasi', setoran: 'Setoran', penukaran: 'Penukaran', penjualan: 'Penjualan', delegasi: 'Delegasi', notifikasi: 'Notifikasi' };
const ringkas = (counts) => Object.entries(counts).map(([t, n]) => `${NAMA[t] || t}: ${n}`).join(' · ');

export async function backup(el) {
  el.innerHTML = `<h2>Backup & Restore</h2>
    <div class="card"><h3>Backup</h3><p class="muted">Unduh seluruh data (pengguna, transaksi, master data, foto) sebagai satu berkas JSON. Berkas memuat hash PIN, simpan di tempat aman.</p>
      <form id="fb">${formHtml([PIN], {}, 'Unduh Backup')}</form></div>
    <div class="card"><h3>Restore</h3><p class="muted"><b>Seluruh data saat ini akan diganti</b> dengan isi berkas. Proses atomik: bila gagal, data tidak berubah. Unduh backup terlebih dahulu.</p>
      <form id="fr">${formHtml([
        { name: 'file', label: 'Berkas backup (.json)', type: 'file', accept: 'application/json,.json' }, PIN,
        { name: 'ok', label: 'Ketik PULIHKAN untuk melanjutkan', autocomplete: 'off' }], {}, 'Pulihkan Data')}</form>
      <p class="muted" id="info"></p></div>`;

  submitForm($('#fb', el), async ({ pin }, form) => {
    const name = await api.download('/admin/backup', { pin });
    form.reset(); toast('Backup diunduh: ' + name);
  });

  let dump = null;
  $('#fr [name=file]', el).addEventListener('change', async (e) => {
    dump = null; $('#info', el).textContent = '';
    const f = e.target.files[0];
    if (!f) return;
    try {
      dump = JSON.parse(await f.text());
      const counts = Object.fromEntries(Object.entries(dump.tables).map(([t, r]) => [t, r.length]));
      $('#info', el).innerHTML = `Dibuat ${esc(tgl(dump.created_at.replace('T', ' ').slice(0, 19)))}<br>${esc(ringkas(counts))}`;
    } catch { dump = null; toast('Berkas bukan JSON backup yang valid', 'err'); e.target.value = ''; }
  });
  submitForm($('#fr', el), async ({ pin, ok }) => {
    if (!dump) throw new Error('Pilih berkas backup terlebih dahulu');
    if (ok.trim().toUpperCase() !== 'PULIHKAN') throw new Error('Ketik PULIHKAN untuk konfirmasi');
    const r = await api.post('/admin/restore', { pin, dump });
    toast('Data dipulihkan. ' + ringkas(r.counts));
    setTimeout(() => location.reload(), 1500);
  });
}
