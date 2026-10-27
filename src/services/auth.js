// Service Autentikasi: captcha, daftar, masuk, keluar, profil.
import { json, body, fail, validate } from '../lib/http.js';
import { first, run } from '../lib/db.js';
import { hashPin, verifyPin } from '../lib/crypto.js';
import { issueCaptcha, checkCaptcha } from '../lib/captcha.js';
import { sessionCookie, clearCookie } from '../lib/auth.js';

const LOGIN = {
  no_hp: { required: true, label: 'Nomor HP', pattern: /^08\d{8,12}$/, msg: 'Nomor HP tidak valid (contoh 0812xxxxxxxx)' },
  pin: { required: true, label: 'PIN', pattern: /^\d{6}$/, msg: 'PIN harus 6 digit angka' },
  captcha_token: { required: true, label: 'Captcha', max: 700 },
  captcha_answer: { required: true, label: 'Jawaban captcha', type: 'number' },
};
const REGISTER = { nama: { required: true, label: 'Nama', max: 100 }, ...LOGIN };

const publicUser = (u) => ({ id: u.id, nama: u.nama, no_hp: u.no_hp, role: u.role, tps_id: u.tps_id });
const withSession = async (env, user, status = 200) =>
  json({ user: publicUser(user) }, status, { 'set-cookie': await sessionCookie(env, user) });

export const register = (r) => {
  r.add('GET', '/api/captcha', null, async ({ env }) => json(await issueCaptcha(env)));

  r.add('POST', '/api/auth/register', null, async ({ req, env }) => {
    const d = validate(await body(req), REGISTER);
    await checkCaptcha(env, d.captcha_token, d.captcha_answer);
    if (await first(env, 'SELECT id FROM users WHERE no_hp=?', d.no_hp)) fail(409, 'Nomor HP sudah terdaftar');
    await run(env, 'INSERT INTO users(no_hp,nama,pin_hash) VALUES(?,?,?)', d.no_hp, d.nama, await hashPin(d.pin));
    const user = await first(env, 'SELECT id,no_hp,nama,role,tps_id FROM users WHERE no_hp=?', d.no_hp);
    return withSession(env, user, 201);
  });

  r.add('POST', '/api/auth/login', null, async ({ req, env }) => {
    const d = validate(await body(req), LOGIN);
    await checkCaptcha(env, d.captcha_token, d.captcha_answer);
    const user = await first(env, 'SELECT * FROM users WHERE no_hp=? AND aktif=1', d.no_hp);
    if (!user || !(await verifyPin(d.pin, user.pin_hash))) fail(401, 'Nomor HP atau PIN salah');
    return withSession(env, user);
  });

  r.add('POST', '/api/auth/logout', null, () => json({ ok: true }, 200, { 'set-cookie': clearCookie }));
  r.add('GET', '/api/me', [], ({ user }) => json({ user: publicUser(user) }));
};
