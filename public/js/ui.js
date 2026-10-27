// Helper UI bersama: escape, format, ikon, form generik, modal, toast.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
export const tgl = (s) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
export const badge = (st) => `<span class="badge ${esc(st)}">${esc(st)}</span>`;
export const ROLE_LABEL = { nasabah: 'Pengguna', admin_tps: 'Petugas', pengepul: 'Pengepul', super_admin: 'Admin' };
export const empty = (t) => `<p class="empty">${esc(t)}</p>`;

const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  swap: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  truck: '<path d="M1 4h13v12H1zM14 8h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
  paper: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  bottle: '<path d="M10 2h4v3l1.5 2.5A3 3 0 0 1 16 9v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9a3 3 0 0 1 .5-1.5L10 5z"/><path d="M8 13h8"/>',
  can: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  glass: '<path d="M8 2h8l-1 8a3 3 0 0 1-6 0z"/><path d="M12 13v8M8 22h8"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-9 0 10-3 16-9 16z"/><path d="M4 21c2-6 6-9 10-11"/>',
  shirt: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  drop: '<path d="M12 2.5S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v9h14v-9"/><path d="M10 21v-5h4v5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
};
// Ikon per kategori sampah (kunci = nama kategori huruf kecil). Kategori baru tanpa ikon memakai 'box'.
const KATEGORI_ICON = { kertas: 'paper', plastik: 'bottle', logam: 'can', kaca: 'glass', elektronik: 'chip', organik: 'leaf', tekstil: 'shirt', minyak: 'drop' };
export const katIcon = (k) => icon(KATEGORI_ICON[String(k ?? '').trim().toLowerCase()] || 'box');
export const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
export const logo = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="14" width="22" height="22" rx="5" fill="#fff" stroke="#17715a" stroke-width="2.5"/><path d="M14 14v-3h12v3M20 11V6" stroke="#17715a" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M20 6c3-3 8-1 8 2-3 2-7 1-8-2z" fill="#2e9a78"/><path d="M15 24a5 5 0 0 1 9-3M25 24a5 5 0 0 1-9 3" stroke="#17715a" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>';

/* formHtml(fields, values, submitLabel): satu pembangun form untuk login, setor, tukar, CRUD master.
   field: {name,label,type:'text|number|select|textarea|file',options:[{value,label}],optional,...atribut input} */
const ATTRS = ['type', 'placeholder', 'autocomplete', 'inputmode', 'maxlength', 'min', 'max', 'step', 'accept', 'capture'];
export function formHtml(fields, values = {}, submit = 'Simpan') {
  const control = (f) => {
    const v = values[f.name] ?? '';
    const req = f.optional ? '' : 'required';
    if (f.type === 'select')
      return `<select name="${esc(f.name)}" ${req}>${f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    if (f.type === 'textarea') return `<textarea name="${esc(f.name)}" rows="6" ${req}>${esc(v)}</textarea>`;
    const a = ATTRS.filter((k) => f[k] !== undefined).map((k) => `${k}="${esc(f[k])}"`).join(' ');
    return `<input name="${esc(f.name)}" ${a} ${f.type === 'file' ? '' : `value="${esc(v)}"`} ${req}>`;
  };
  return fields.map((f) => `<label class="field"><span>${esc(f.label)}</span>${control(f)}</label>`).join('') +
    `<button class="btn block" type="submit">${esc(submit)}</button>`;
}

/* submitForm: cegah submit ganda, tangkap error -> toast. */
export function submitForm(form, handler, onError) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try { await handler(Object.fromEntries(new FormData(form)), form); }
    catch (err) { toast(err.message, 'err'); onError?.(err); }
    finally { btn.disabled = false; }
  });
}

// Delegasi event; memasang ulang pada (elemen, event, selector) yang sama MENGGANTI handler lama (tidak menumpuk).
export function on(root, evt, sel, fn) {
  const reg = (root._h ||= {}), key = evt + sel;
  if (reg[key]) root.removeEventListener(evt, reg[key]);
  reg[key] = (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); };
  root.addEventListener(evt, reg[key]);
}

export function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind === 'err' ? 'err' : '');
  el.textContent = msg;
  $('#toast').append(el);
  setTimeout(() => el.remove(), 3500);
}
export function modal(html) {
  const d = $('#modal');
  d.innerHTML = html;
  if (!d.open) d.showModal();
  return d;
}
export const closeModal = () => $('#modal').close();

/* Kompres foto di perangkat (maks 800px JPEG) supaya ringan disimpan di D1. */
export async function compressImage(file, max = 800) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  for (let q = 0.8; q > 0.3; q -= 0.15) { const u = c.toDataURL('image/jpeg', q); if (u.length < 280000) return u; }
  throw new Error('Foto terlalu besar');
}

/* Pemilih dengan pencarian cepat + filter kategori (ikon per kategori). Dipakai setor sampah & jual ke pengepul.
   items: [{id,nama,kategori,kode,meta}]  -> mengisi <input type=hidden name=...> dan memicu event 'input' pada form. */
export function pickerHtml({ name, label, placeholder = 'Cari jenis sampah…' }) {
  return `<div class="field picker" data-picker="${esc(name)}"><span>${esc(label)}</span>
    <label class="search">${icon('search')}<input type="search" data-q placeholder="${esc(placeholder)}" autocomplete="off" aria-label="${esc(label)}"></label>
    <div class="chips" data-cats></div><div class="plist" role="listbox" data-list></div>
    <input type="hidden" name="${esc(name)}"></div>`;
}
const norm = (s) => String(s ?? '').toLowerCase();
export function bindPicker(root, items, { name, onPick } = {}) {
  const box = $(`[data-picker="${name}"]`, root), list = $('[data-list]', box), q = $('[data-q]', box), hid = $(`[name="${name}"]`, box);
  const cats = [...new Set(items.map((i) => i.kategori))].sort();
  let cat = '';
  const paint = () => {
    $('[data-cats]', box).innerHTML = ['', ...cats].map((c) =>
      `<button type="button" class="chip ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${c ? katIcon(c) : icon('grid')}${esc(c || 'Semua')}</button>`).join('');
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    const rows = items.filter((i) => (!cat || i.kategori === cat) && words.every((w) => norm(`${i.nama} ${i.kategori} ${i.kode}`).includes(w)));
    list.innerHTML = rows.length ? rows.map((i) => `<button type="button" role="option" class="popt ${String(i.id) === hid.value ? 'sel' : ''}" data-id="${i.id}" aria-selected="${String(i.id) === hid.value}">
      ${katIcon(i.kategori)}<span><b>${esc(i.nama)}</b><small>${esc(i.kategori)}</small></span><em>${esc(i.meta ?? '')}</em></button>`).join('') : empty('Tidak ditemukan.');
    list._rows = rows;
  };
  const pick = (id) => {
    hid.value = id; paint();
    hid.dispatchEvent(new Event('input', { bubbles: true }));
    onPick?.(items.find((i) => String(i.id) === String(id)));
  };
  q.addEventListener('input', (e) => { e.stopPropagation(); paint(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (list._rows?.[0]) pick(list._rows[0].id); } });
  box.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]'), o = e.target.closest('[data-id]');
    if (c) { cat = c.dataset.cat; paint(); } else if (o) pick(o.dataset.id);
  });
  paint();
  return { pick, value: () => hid.value };
}
