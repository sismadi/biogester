// Klien API tunggal: semua view memanggil lewat sini (cookie sesi HttpOnly dikirim otomatis).
async function send(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || 'Terjadi kesalahan'), { status: res.status });
  }
  return res;
}
const request = async (method, path, body) => (await send(method, path, body)).json().catch(() => ({}));
export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
  // Unduh respons sebagai berkas (nama dari header content-disposition).
  async download(p, b = {}) {
    const res = await send('POST', p, b);
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'download';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await res.blob()), download: name });
    a.click(); URL.revokeObjectURL(a.href);
    return name;
  },
};
