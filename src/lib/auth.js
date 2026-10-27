// Sesi stateless: cookie HttpOnly berisi token HMAC (kunci SESSION_SECRET di Cloudflare).
// User dimuat ulang dari D1 tiap request, jadi akun yang dinonaktifkan langsung kehilangan akses.
import { sign, verify } from './crypto.js';
import { first } from './db.js';

const COOKIE = 'basadi_session';
const attrs = 'HttpOnly; Secure; SameSite=Strict; Path=/';

const readCookie = (req, name) =>
  (req.headers.get('cookie') || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1];

export async function currentUser(req, env) {
  const s = await verify(env.SESSION_SECRET, readCookie(req, COOKIE));
  return s ? first(env, 'SELECT id,no_hp,nama,role,tps_id FROM users WHERE id=? AND aktif=1', s.uid) : null;
}
export async function sessionCookie(env, user) {
  const ttl = Number(env.SESSION_TTL) || 604800;
  return `${COOKIE}=${await sign(env.SESSION_SECRET, { uid: user.id }, ttl)}; ${attrs}; Max-Age=${ttl}`;
}
export const clearCookie = `${COOKIE}=; ${attrs}; Max-Age=0`;
