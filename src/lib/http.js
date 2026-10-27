// Utilitas HTTP + validasi yang dipakai semua service (satu sumber kebenaran).
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new HttpError(status, message); };

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export async function body(req) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) fail(415, 'Gunakan Content-Type JSON');
  try { return await req.json(); } catch { return fail(400, 'JSON tidak valid'); }
}

/* validate(data, rules) -> objek bersih hanya berisi field yang ada di rules.
   rule: { type:'number'|'string', required, min, max, pattern, msg, oneOf, default, label } */
export function validate(data, rules) {
  const out = {};
  for (const [k, r] of Object.entries(rules)) {
    const label = r.label || k;
    let v = data?.[k];
    if (v === undefined || v === null) {
      if (r.required) fail(422, `${label} wajib diisi`);
      if (r.default !== undefined) out[k] = r.default;
      continue;
    }
    if (v === '') {
      if (r.required) fail(422, `${label} wajib diisi`);
      if (r.type !== 'number') out[k] = '';
      continue;
    }
    if (r.type === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) fail(422, `${label} harus berupa angka`);
      if (r.min !== undefined && v < r.min) fail(422, `${label} minimal ${r.min}`);
      if (r.max !== undefined && v > r.max) fail(422, `${label} maksimal ${r.max}`);
    } else {
      v = String(v).trim();
      if (r.max && v.length > r.max) fail(422, `${label} terlalu panjang`);
      if (r.pattern && !r.pattern.test(v)) fail(422, r.msg || `${label} tidak valid`);
      if (r.oneOf && !r.oneOf.includes(v)) fail(422, `${label} tidak valid`);
    }
    out[k] = v;
  }
  return out;
}
