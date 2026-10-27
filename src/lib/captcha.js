// Captcha penjumlahan stateless: jawaban TIDAK dikirim ke klien, hanya HMAC-nya (kunci CAPTCHA_SECRET di Cloudflare).
import { sign, verify, mac } from './crypto.js';
import { run } from './db.js';
import { fail } from './http.js';

const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

export async function issueCaptcha(env) {
  const a = rnd(20) + 1, b = rnd(20) + 1, n = crypto.randomUUID();
  const token = await sign(env.CAPTCHA_SECRET, { n, h: await mac(env.CAPTCHA_SECRET, `${n}:${a + b}`) }, 300);
  return { token, question: `Berapa hasil ${a} + ${b} ?` };
}

export async function checkCaptcha(env, token, answer) {
  const p = await verify(env.CAPTCHA_SECRET, token);
  if (!p || p.h !== (await mac(env.CAPTCHA_SECRET, `${p.n}:${Number(answer)}`))) fail(422, 'Jawaban captcha salah atau kedaluwarsa');
  try { await run(env, 'INSERT INTO captcha_used(nonce,exp) VALUES(?,?)', p.n, p.exp); }
  catch { fail(422, 'Captcha sudah dipakai, muat ulang'); }
  await run(env, 'DELETE FROM captcha_used WHERE exp<?', Math.floor(Date.now() / 1000));
}
