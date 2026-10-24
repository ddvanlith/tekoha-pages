// The footer's one-line signup to Tekoha Semanal (Spanish) or Tekoha Weekly (English), docs/leads-and-sponsor.md. It goes
// through the shared capture (pages-src/capture.js, docs/viral-loop.md): with the public anon key a newsletter row
// (kind newsletter, the source naming the list by the language on screen and the place: weekly-es-casa, weekly-en-casa)
// into public.signups, where row security accepts inserts only; without the key a ready email to the public address, which
// the inbox reader turns into the same row; with no public address either, a line saying the sign-up opens soon. The row
// carries the visitor's referral code and their own code (payload.ref, payload.code), so each reader has a personal link.
// It is its own module so the app's screens stay as they are; it follows the language toggle through the lang attribute
// of <html>.
import CFG from "./config.js?v=e0881558d9";
import { capture, myCode, validEmail } from "./capture.js?v=e0881558d9";

const T = {
  es: { line: "Tekoha Semanal: casas, precios y alquileres de Paraguay, gratis cada martes en tu correo.", label: "Tu email",
    ph: "tu@email.com", btn: "Suscribirme", ok: "Listo. Te llega el martes.", bad: "No se pudo. Probá de nuevo.", need: "Escribí tu email.",
    mail: "Enviar el correo para suscribirme", mailNote: "Se abre tu correo con todo escrito: envialo y quedás suscripto.", soon: "La suscripción abre pronto." },
  en: { line: "Tekoha Weekly: homes, prices and rents in Paraguay, free in your inbox every Tuesday.", label: "Your email",
    ph: "you@email.com", btn: "Sign up", ok: "Done. It arrives on Tuesday.", bad: "That did not go through. Try again.", need: "Write your email.",
    mail: "Send the email to sign up", mailNote: "Your email app opens with everything written: send it and you are signed up.", soon: "Sign-up opens soon." },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const box = document.getElementById("nlf");
const lang = () => (document.documentElement.lang === "en" ? "en" : "es");
// The header sets the lang attribute on every redraw, not only on a switch; an unchanged language keeps the box as it is.
let drawn = null;

function draw() {
  if (!box || drawn === lang()) return;
  drawn = lang();
  const t = T[drawn], typed = box.querySelector("input")?.value || "";
  if (!CFG.anon && !CFG.leadsEmail) { box.innerHTML = `<p>${t.line} ${t.soon}</p>`; return; }
  box.innerHTML = `<form novalidate><label for="nle">${t.line}</label><span class="nlr"><input class="inp" id="nle" type="email" autocomplete="email" ` +
    `placeholder="${t.ph}" aria-label="${t.label}"><button class="btn pri" type="submit">${t.btn}</button></span><span class="msg" role="status"></span></form>`;
  box.querySelector("input").value = typed;
  box.querySelector("form").addEventListener("submit", send);
}

async function send(e) {
  e.preventDefault();
  const t = T[lang()], input = box.querySelector("input"), m = box.querySelector(".msg"), btn = box.querySelector("button");
  const email = input.value.trim();
  if (!validEmail(email)) { m.className = "msg bad"; m.textContent = t.need; input.focus(); return; }
  btn.disabled = true;
  const r = await capture({ supabase: CFG.supabase, anon: CFG.anon, to: CFG.leadsEmail },
    { kind: "newsletter", email, source: `weekly-${lang()}-casa`, payload: { lang: lang(), code: myCode(true) } });
  btn.disabled = false;
  if (r.via === "rest" && r.ok) { m.className = "msg okm"; m.textContent = t.ok; input.value = ""; return; }
  if (r.href) {
    m.className = "msg";
    m.innerHTML = `${esc(r.via === "rest" ? t.bad : t.mailNote)} <a href="${esc(r.href)}">${esc(t.mail)}</a>`;
    if (r.via === "mail") location.href = r.href;
    return;
  }
  m.className = "msg bad"; m.textContent = r.via === "soon" ? t.soon : t.bad;
}

draw();
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
