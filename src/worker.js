// Gateway backend (Cloudflare Worker). Menerima /api/*, memeriksa sesi + role, lalu meneruskan ke service.
// Tiap service = 1 file di services/ yang hanya mendaftarkan route -> mudah dipecah jadi Worker terpisah
// (service binding) kelak tanpa mengubah logikanya.
import { Router } from './lib/router.js';
import { json, fail, HttpError } from './lib/http.js';
import { currentUser } from './lib/auth.js';
import * as auth from './services/auth.js';
import * as setoran from './services/setoran.js';
import * as penukaran from './services/penukaran.js';
import * as dompet from './services/dompet.js';
import * as master from './services/master.js';
import * as penjualan from './services/penjualan.js';
import * as delegasi from './services/delegasi.js';
import * as pasar from './services/pasar.js';
import * as backup from './services/backup.js';

const router = new Router();
[auth, setoran, penukaran, dompet, master, penjualan, delegasi, pasar, backup].forEach((s) => s.register(router));

const errorResponse = (e) => {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  const msg = String(e?.message || e);
  if (msg.includes('UNIQUE')) return json({ error: 'Data sudah ada' }, 409);
  if (msg.includes('FOREIGN KEY')) return json({ error: 'Data masih dipakai data lain' }, 409);
  console.error(e);
  return json({ error: 'Terjadi kesalahan pada server' }, 500);
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (!env.SESSION_SECRET || !env.CAPTCHA_SECRET) fail(500, 'Secret Cloudflare belum diatur');
      // Lapis CSRF tambahan di atas SameSite=Strict: request tulis harus berasal dari origin yang sama.
      const origin = req.headers.get('origin');
      if (!['GET', 'HEAD'].includes(req.method) && origin && origin !== url.origin) fail(403, 'Origin tidak diizinkan');

      const hit = router.match(req.method, url.pathname);
      if (!hit) fail(404, 'Endpoint tidak ditemukan');
      const { route, params } = hit;

      let user = null;
      if (route.roles) {
        user = await currentUser(req, env);
        if (!user) fail(401, 'Silakan masuk terlebih dahulu');
        if (route.roles.length && !route.roles.includes(user.role)) fail(403, 'Akses ditolak');
      }
      return await route.handler({ req, env, url, params, user });
    } catch (e) { return errorResponse(e); }
  },
};
