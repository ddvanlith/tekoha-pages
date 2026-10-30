// One way to take a sign-up on every Tekoha page (docs/viral-loop.md, "Capture"), in this order:
//   1. the Supabase anon key exists (SUPABASE_ANON_KEY at build time): insert into public.signups by REST, under the
//      insert-only row security of migrations 028 to 030;
//   2. else the public Tekoha address exists (TEKOHA_PUBLIC_EMAIL at build time): a prefilled email to it, subject
//      "[tekoha:<kind>] <code>" and a body of plain "key: value" lines, which pipeline/inbox-check.mjs turns into the same
//      row once the visitor sends it;
//   3. else nothing can take it yet, and the page says so in one short line.
// Every sign-up carries the visitor's referrer as payload.ref (localStorage "tekoha_ref", left by pages-src/ref.js), and a
// newsletter or affiliate sign-up the visitor's own code as payload.code (localStorage "tekoha_mycode"), so each reader
// has one personal link. The builders copy this file next to each app (casa/, compartir/).
export const CODE = /^[a-z0-9]{7}$/;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
export const validEmail = (e) => typeof e === "string" && EMAIL.test(e) && e.length < 200;
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function refCode() {
  const r = get("tekoha_ref");
  return r && CODE.test(r) && r !== get("tekoha_mycode") ? r : null;
}
// The visitor's own code; with create, a new one when there is none: seven characters from crypto.getRandomValues.
export function myCode(create = false) {
  const c = get("tekoha_mycode");
  if (c && CODE.test(c)) return c;
  if (!create) return null;
  const A = "abcdefghijklmnopqrstuvwxyz0123456789", buf = new Uint8Array(16), out = [];
  // 252 is the largest multiple of 36 below 256: a byte at or above it is drawn again, so every character is as likely.
  while (out.length < 7) { crypto.getRandomValues(buf); for (const x of buf) if (x < 252 && out.length < 7) out.push(A[x % 36]); }
  const code = out.join("");
  put("tekoha_mycode", code);
  return code;
}

// The email's body: one "key: value" line per field, values on one line; the message, if any, last and as written. The
// sign-up's kind rides in the subject only, so a lead's own "kind" (the kind of home) stays a payload field.
// pipeline/inbox-check.mjs reads these keys back (signupFromMail).
export function mailBody(fields) {
  const lines = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === "" || k === "message") continue;
    lines.push(`${k}: ${String(typeof v === "object" ? JSON.stringify(v) : v).replace(/[\r\n]+/g, " ").slice(0, 300)}`);
  }
  if (fields.message) lines.push(`message: ${String(fields.message).slice(0, 1500)}`);
  return lines.join("\n");
}
export function mailtoHref(to, kind, code, fields) {
  const subject = `[tekoha:${kind}] ${code || "-"}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody(fields))}`;
}

// cfg: { supabase, anon, to }. A sign-up: { kind, email, phone, source, payload }.
// Returns { via: "rest", ok: true }, { via: "mail", href } (the page opens it or shows it as a button), or { via: "soon" };
// a REST insert that fails returns { via: "rest", ok: false, href } with the email as the way out when there is one.
export async function capture(cfg, { kind, email = null, phone = null, source, payload = {} }) {
  const p = { ...payload };
  if (!p.ref) { const r = refCode(); if (r) p.ref = r; }
  for (const k of Object.keys(p)) if (p[k] == null || p[k] === "") delete p[k];
  const code = kind === "affiliate" ? p.code : p.ref;
  const href = cfg.to ? mailtoHref(cfg.to, kind, code, { email, phone, source, ...p }) : null;
  if (cfg.anon) {
    try {
      const r = await fetch(`${cfg.supabase}/rest/v1/signups`, { method: "POST",
        headers: { apikey: cfg.anon, Authorization: `Bearer ${cfg.anon}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ email: email || null, source: String(source || "").slice(0, 39), kind, phone: phone || null, payload: p }) });
      if (r.ok) return { via: "rest", ok: true };
    } catch {}
    return { via: "rest", ok: false, href };
  }
  if (href) return { via: "mail", href };
  return { via: "soon" };
}
