// Tampilan Pengepul: ringkasan pembelian + konfirmasi penawaran dari TPS.
import { api } from '../api.js';
import { $, esc, rupiah, tgl, badge, katIcon, toast } from '../ui.js';
import { reviewList } from './admin.js';

const kg = (n) => Number(n).toFixed(1) + ' kg';

export async function pembelian(el) {
  const s = await api.get('/pengepul/stats');
  const holder = document.createElement('div');
  el.innerHTML = `<h2>Pembelian</h2><div class="stats">
    <div class="stat"><span class="muted">Menunggu konfirmasi</span><b>${s.menunggu}</b></div>
    <div class="stat"><span class="muted">Diterima bulan ini</span><b>${kg(s.kg_bulan_ini)}</b></div>
    <div class="stat"><span class="muted">Total diterima</span><b>${kg(s.total_kg)}</b></div>
    <div class="stat"><span class="muted">Total nilai</span><b>${rupiah(s.total_nilai)}</b></div></div>`;
  el.append(holder);
  await reviewList(holder, {
    title: 'Penawaran dari TPS', endpoint: '/penjualan', statuses: ['menunggu', 'diterima', 'ditolak', 'dibatalkan'],
    row: {
      head: '<thead><tr><th>Tanggal</th><th>TPS</th><th>Jenis</th><th>Berat</th><th>Harga/kg</th><th>Nilai</th><th></th></tr></thead>',
      body: (p) => `<tr><td>${tgl(p.created_at)}<br><span class="muted">${esc(p.kode)}</span></td><td>${esc(p.tps)}</td><td>${katIcon(p.kategori)} ${esc(p.jenis)}</td><td>${kg(p.berat_kg)}</td><td>${rupiah(p.harga_per_kg)}</td><td>${rupiah(p.nilai)}</td>
        <td>${p.status === 'menunggu' ? `<div class="row-actions"><button class="btn sm" data-act="diterima" data-id="${p.id}">Terima</button><button class="btn sm bad" data-act="ditolak" data-id="${p.id}">Tolak</button></div>` : badge(p.status)}</td></tr>`,
    },
    onRowClick: async (status, id) => {
      try { await api.patch('/penjualan/' + id, { status }); toast('Tersimpan'); pembelian(el); } catch (e) { toast(e.message, 'err'); }
    },
  });
}
