// WebCrypto murni (jalan di Cloudflare Workers & Node 20+).
const enc = new TextEncoder();
const dec = new TextDecoder();
export const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const hmacKey = (secret, usage) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);

export const mac = async (secret, text) =>
  b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), enc.encode(text)));

/* Token bertanda tangan HMAC: base64url(payload).signature  (payload memuat exp) */
export async function sign(secret, payload, ttlSec) {
  const p = b64u(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })));
  return `${p}.${await mac(secret, p)}`;
}
export async function verify(secret, token) {
  try {
    if (!token || !token.includes('.')) return null;
    const [p, s] = token.split('.');
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, ['verify']), unb64u(s), enc.encode(p));
    if (!ok) return null;
    const data = JSON.parse(dec.decode(unb64u(p)));
    return data.exp > Date.now() / 1000 ? data : null;
  } catch { return null; }
}

/* Hash PIN: PBKDF2-SHA256, 100.000 iterasi (batas maksimum Workers). Format: pbkdf2$iter$salt$hash */
const ITER = 100000;
const derive = async (pin, salt, iter) => {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
};
export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64u(salt)}$${await derive(pin, salt, ITER)}`;
}
export async function verifyPin(pin, stored) {
  const [, iter, salt, hash] = String(stored).split('$');
  const got = await derive(pin, unb64u(salt), Number(iter));
  let diff = got.length ^ hash.length;                       // perbandingan waktu-konstan
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return diff === 0;
}
