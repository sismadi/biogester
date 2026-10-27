// Layar masuk / daftar dengan captcha (token bertanda tangan dari server).
import { api } from '../api.js';
import { $, formHtml, submitForm, logo } from '../ui.js';

export function authView(root, onDone) {
  let mode = 'login';
  const draw = async () => {
    const cap = await api.get('/captcha');
    const fields = [
      ...(mode === 'register' ? [{ name: 'nama', label: 'Nama lengkap', autocomplete: 'name', maxlength: 100 }] : []),
      { name: 'no_hp', label: 'Nomor HP', type: 'tel', placeholder: '08xxxxxxxxxx', autocomplete: 'username', inputmode: 'numeric' },
      { name: 'pin', label: 'PIN (6 digit)', type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: mode === 'login' ? 'current-password' : 'new-password' },
      { name: 'captcha_answer', label: cap.question, type: 'number' },
    ];
    root.innerHTML = `
      <main class="auth"><div class="auth-card">
        <div class="brand">${logo}<div>Basadi<small>BANK SAMPAH DIGITAL</small></div></div>
        <h2>${mode === 'login' ? 'Masuk' : 'Buat akun'}</h2>
        <form>${formHtml(fields, {}, mode === 'login' ? 'Masuk' : 'Daftar')}</form>
        <p class="switch">${mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
          <button type="button" id="sw">${mode === 'login' ? 'Daftar' : 'Masuk'}</button></p>
      </div></main>`;
    submitForm($('form', root), async (d) => {
      await api.post('/auth/' + mode, { ...d, captcha_token: cap.token });
      onDone();
    }, draw);
    $('#sw', root).onclick = () => { mode = mode === 'login' ? 'register' : 'login'; draw(); };
  };
  return draw();
}
