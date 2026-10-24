// Compartí Tekoha (docs/viral-loop.md): the affiliate sign-up, built by pipeline/build-compartir.mjs. A visitor gives an
// email, a language and their barrio; the page makes their code (seven characters from crypto.getRandomValues, kept in
// localStorage "tekoha_mycode"; a visitor who already has one from Tasá keeps it), shows the personal link at once with
// copy and share buttons, and sends the sign-up through the shared capture (pages-src/capture.js): REST with the anon key,
// else an email to the Tekoha address, else a "muy pronto" line. /compartir/?c=<code> shows how many joined with a link,
// from counts.json (codes and counts only, rebuilt with every pages build from api.referral_counts). One number, one prize.
import { capture, myCode, validEmail, CODE } from "./capture.js?v=0b69dfac46";

const CFG = JSON.parse(document.getElementById("cfg").textContent || "{}");
const GOAL = CFG.goal || 3;
const $ = (s, el = document) => el.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"']/g, (c) => ESC[c]));
const fold = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

const T = {
  es: {
    lang: "es", other: "EN", otherLabel: "Read in English", homes: "Casas",
    h1: "Compartí Tekoha", rule: `Cuando ${GOAL} personas se suscriban a Tekoha Semanal con tu link, te mandamos cada semana las bajas de precio de tu barrio. Gratis.`,
    email: "Tu email", emailPh: "tu@email.com", langQ: "¿En qué idioma?", es: "Español", en: "English",
    barrio: "Tu barrio", barrioPh: "Por ejemplo: Villa Morra, Asunción", barrioHint: "El barrio donde vivís o donde buscás. Si no está en la lista, escribilo igual.",
    send: "Quiero mi link", needEmail: "Escribí tu email.", needBarrio: "Escribí tu barrio.",
    mine: "Tu link", copy: "Copiar el link", copied: "Copiado", share: "Compartir", wa: "Mandar por WhatsApp",
    shareText: (link) => `Tekoha: casas, precios y alquileres de Paraguay, gratis cada martes en tu correo. Suscribite con mi link: ${link}`,
    ok: "Listo: quedaste anotado. Tu link ya cuenta.", mailNote: "Para anotarte, enviá el correo que se abre con todo escrito. Tu link ya cuenta desde ahora.",
    mailBtn: "Enviar el correo", soon: "Tu link ya cuenta. La inscripción abre muy pronto: volvé a esta página en unos días.",
    fail: "No se pudo anotar. Probá de nuevo.", again: "Anotarme de nuevo",
    joined: (n) => (n === 0 ? "Todavía nadie se sumó con tu link." : n === 1 ? "1 persona se sumó con tu link." : `${n} personas se sumaron con tu link.`),
    joinedOther: (n) => (n === 1 ? "Con este link se sumó 1 persona." : `Con este link se sumaron ${n} personas.`),
    left: (n) => (n === 1 ? "Falta 1." : `Faltan ${n}.`),
    won: "Ganaste: cada semana te mandamos las bajas de precio de tu barrio.", wonWait: "Ganaste. Tu premio empieza cuando arranque el envío.",
    counted: (d) => `Contamos una vez por día${d ? `; la última cuenta es del ${d}` : ""}. Cuenta cada persona que se suscribe por primera vez con tu link.`,
    noCounts: "Todavía no hay cuentas: contamos una vez por día.",
    otherH: "Un link de Tekoha", wantOwn: "¿Querés tu propio link?", wantOwnBtn: "Pedir mi link",
    months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    moreH: "Mientras tanto", moreP: "Jugá Tasá: una casa por día, adiviná el precio. Es lo que más se comparte.", tasaBtn: "Jugar Tasá",
    foot: "Tekoha cuenta los avisos públicos de casas de Paraguay y manda un resumen gratis cada martes. Tu email no se publica ni se comparte.",
    footTasa: "Tasá", footCasa: "Buscar casa",
  },
  en: {
    lang: "en", other: "ES", otherLabel: "Leer en español", homes: "Homes",
    h1: "Share Tekoha", rule: `When ${GOAL} people join Tekoha Weekly with your link, we send you the price drops of your barrio every week. Free.`,
    email: "Your email", emailPh: "you@email.com", langQ: "Which language?", es: "Español", en: "English",
    barrio: "Your barrio", barrioPh: "For example: Villa Morra, Asunción", barrioHint: "The barrio where you live or where you are looking. If it is not on the list, write it anyway.",
    send: "Get my link", needEmail: "Write your email.", needBarrio: "Write your barrio.",
    mine: "Your link", copy: "Copy the link", copied: "Copied", share: "Share", wa: "Send on WhatsApp",
    shareText: (link) => `Tekoha: homes, prices and rents in Paraguay, free every Tuesday in your inbox. Sign up with my link: ${link}`,
    ok: "Done: you are signed up. Your link counts already.", mailNote: "To sign up, send the email that opens with everything written. Your link counts from now on.",
    mailBtn: "Send the email", soon: "Your link counts already. Sign-up opens very soon: come back to this page in a few days.",
    fail: "That did not go through. Try again.", again: "Sign me up again",
    joined: (n) => (n === 0 ? "Nobody has joined with your link yet." : n === 1 ? "1 person joined with your link." : `${n} people joined with your link.`),
    joinedOther: (n) => (n === 1 ? "1 person joined with this link." : `${n} people joined with this link.`),
    left: (n) => (n === 1 ? "1 to go." : `${n} to go.`),
    won: "You won: every week we send you the price drops of your barrio.", wonWait: "You won. Your prize starts when sending starts.",
    counted: (d) => `We count once a day${d ? `; the last count is from ${d}` : ""}. Each person who signs up for the first time with your link counts.`,
    noCounts: "No counts yet: we count once a day.",
    otherH: "A Tekoha link", wantOwn: "Want your own link?", wantOwnBtn: "Get my link",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    moreH: "Meanwhile", moreP: "Play Tasá: one home a day, guess the price. It is the thing people share most.", tasaBtn: "Play Tasá",
    foot: "Tekoha counts the public home listings of Paraguay and sends a free summary every Tuesday. Your email is never published or shared.",
    footTasa: "Tasá", footCasa: "Find a home",
  },
};
let S = store.get("casa-lang") === "en" ? T.en : T.es;
const linkOf = (code) => `${CFG.link}?r=${code}`;
const shortDate = (iso) => { if (!iso) return null; const d = new Date(iso); return `${d.getUTCDate()} ${S.months[d.getUTCMonth()]}`; };

let counts = null, barrios = null;
const countsP = fetch(`counts.json?v=${CFG.v}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => (counts = j));
const loadBarrios = () => barrios || (barrios = fetch(`barrios.json?v=${CFG.v}`).then((r) => (r.ok ? r.json() : [])).catch(() => []));

function toast(t) {
  const el = document.createElement("div");
  el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch {}
    t.remove();
  }
  toast(S.copied);
}

function header() {
  document.documentElement.lang = S.lang;
  $("#ncasa").textContent = S.homes;
  const lb = $("#lang");
  lb.textContent = S.other; lb.setAttribute("aria-label", S.otherLabel);
  $("#foot").innerHTML = `<p>${esc(S.foot)}</p><p><a href="../tasa/">${esc(S.footTasa)}</a><a href="../casa/">${esc(S.footCasa)}</a></p>`;
}

function linkBox(code) {
  const link = linkOf(code), text = S.shareText(link);
  return `<div class="mylink"><h2>${esc(S.mine)}</h2><code id="link">${esc(link)}</code><div class="acts">` +
    `<a class="btn pri" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${esc(S.wa)}</a>` +
    `<button class="btn" type="button" id="copy">${esc(S.copy)}</button>${navigator.share ? `<button class="btn" type="button" id="share">${esc(S.share)}</button>` : ""}</div></div>`;
}
function countBox(code, own) {
  if (!counts) return `<div class="count"><p>${esc(S.noCounts)}</p></div>`;
  const n = Math.max(0, +(counts.c?.[code] || 0));
  const bar = `<div class="bar" aria-hidden="true">${Array.from({ length: GOAL }, (_, i) => `<i${i < n ? ' class="on"' : ""}></i>`).join("")}</div>`;
  const prize = n >= GOAL ? (counts.sending ? S.won : S.wonWait) : S.left(GOAL - n);
  return `<div class="count"><p class="big">${esc(own ? S.joined(n) : S.joinedOther(n))}</p>${bar}${own ? `<p>${esc(prize)}</p>` : ""}` +
    `<p class="small">${esc(S.counted(shortDate(counts.as_of)))}</p></div>`;
}
function wireLink(code) {
  const text = S.shareText(linkOf(code));
  $("#copy")?.addEventListener("click", () => copy(linkOf(code)));
  $("#share")?.addEventListener("click", () => navigator.share({ text }).catch(() => {}));
}
const moreHtml = () => `<div class="more"><h2>${esc(S.moreH)}</h2><p>${esc(S.moreP)}</p><a class="btn" href="../tasa/">${esc(S.tasaBtn)}</a></div>`;

// The status of one link: the visitor's own (with its share buttons) or someone else's.
async function showStatus(code, note = null) {
  await countsP;
  const own = code === myCode();
  const reg = (() => { try { return JSON.parse(store.get("tekoha_aff") || "null"); } catch { return null; } })();
  const retry = own && reg && reg.code === code && reg.via !== "rest" ? `<p><a href="./?again=1">${esc(S.again)}</a></p>` : "";
  $("#main").innerHTML = `<h1>${esc(own ? S.h1 : S.otherH)}</h1>` + (note ? `<div id="note">${note}</div>` : "") +
    (own ? linkBox(code) : "") + countBox(code, own) +
    (own ? `<p class="rule">${esc(S.rule)}</p>${retry}` : `<p class="rule">${esc(S.rule)}</p><p>${esc(S.wantOwn)}</p><a class="btn pri" href="./">${esc(S.wantOwnBtn)}</a>`) + moreHtml();
  if (own) wireLink(code);
}

function showForm() {
  $("#main").innerHTML = `<h1>${esc(S.h1)}</h1><p class="rule">${esc(S.rule)}</p><form id="aff" novalidate>` +
    `<label class="fld"><span class="lab">${esc(S.email)}</span><input class="inp" id="ae" type="email" autocomplete="email" placeholder="${esc(S.emailPh)}" required></label>` +
    `<fieldset class="fld" style="border:0;margin:0 0 14px;padding:0"><legend class="lab">${esc(S.langQ)}</legend><div class="seg">` +
    `<label><input type="radio" name="al" value="es"${S.lang === "es" ? " checked" : ""}><span>${esc(S.es)}</span></label>` +
    `<label><input type="radio" name="al" value="en"${S.lang === "en" ? " checked" : ""}><span>${esc(S.en)}</span></label></div></fieldset>` +
    `<label class="fld"><span class="lab">${esc(S.barrio)}</span><input class="inp" id="ab" list="bl" autocomplete="off" placeholder="${esc(S.barrioPh)}" maxlength="80" required>` +
    `<datalist id="bl"></datalist><span class="hint">${esc(S.barrioHint)}</span></label>` +
    `<input class="hp" id="aw" tabindex="-1" autocomplete="off" aria-hidden="true">` +
    `<button class="btn pri wide" type="submit">${esc(S.send)}</button><p class="msg" id="amsg" role="status"></p></form>` + moreHtml();
  const ab = $("#ab");
  const fill = async () => {
    const list = await loadBarrios();
    if ($("#bl").childElementCount || !list.length) return;
    $("#bl").innerHTML = list.map(([b, c]) => `<option value="${esc(b ? `${b}, ${c}` : c)}">`).join("");
  };
  ab.addEventListener("focus", fill, { once: true });
  $("#aff").addEventListener("submit", send);
}

// What the visitor typed in the barrio box, matched against the list: { barrio, city, mk }, or the words as typed.
async function placeOf(text) {
  const list = await loadBarrios(), t = fold(text);
  for (const [b, c, mk] of list) if (fold(b ? `${b}, ${c}` : c) === t || (b && fold(b) === t)) return { barrio: b || null, city: c, mk };
  return { barrio: text.slice(0, 80), city: null, mk: null };
}

async function send(e) {
  e.preventDefault();
  const m = $("#amsg"), email = $("#ae").value.trim(), btext = $("#ab").value.trim(), lang = document.querySelector("input[name=al]:checked")?.value || S.lang;
  if ($("#aw").value) return;
  if (!validEmail(email)) { m.className = "msg bad"; m.textContent = S.needEmail; $("#ae").focus(); return; }
  if (!btext) { m.className = "msg bad"; m.textContent = S.needBarrio; $("#ab").focus(); return; }
  const btn = $("#aff button[type=submit]");
  btn.disabled = true;
  const code = myCode(true), place = await placeOf(btext);
  const r = await capture(CFG, { kind: "affiliate", email, source: "compartir", payload: { code, lang, ...place } });
  btn.disabled = false;
  let note;
  if (r.via === "rest" && r.ok) note = `<p class="msg okm">${esc(S.ok)}</p>`;
  else if (r.href) note = `<p class="msg">${esc(r.via === "rest" ? S.fail : S.mailNote)}</p><p><a class="btn pri wide" href="${esc(r.href)}">${esc(S.mailBtn)}</a></p>`;
  else if (r.via === "soon") note = `<p class="msg">${esc(S.soon)}</p>`;
  else { m.className = "msg bad"; m.textContent = S.fail; return; }
  store.set("tekoha_aff", JSON.stringify({ code, at: new Date().toISOString().slice(0, 10), via: r.via === "rest" && r.ok ? "rest" : r.via }));
  history.replaceState(null, "", `?c=${code}`);
  await showStatus(code, note);
  if (r.href && r.via === "mail") location.href = r.href;
}

function route() {
  const q = new URLSearchParams(location.search);
  const c = (q.get("c") || "").toLowerCase();
  const reg = (() => { try { return JSON.parse(store.get("tekoha_aff") || "null"); } catch { return null; } })();
  // ?c=<code>&m=1 is the link under each reader's letter (pipeline/send-newsletter.mjs): the code is theirs, so this
  // browser takes it as its own, and the form asks for the barrio when this browser has not signed it up yet.
  if (CODE.test(c) && q.get("m") === "1") {
    store.set("tekoha_mycode", c);
    history.replaceState(null, "", `?c=${c}`);
    return reg && reg.code === c ? showStatus(c) : showForm();
  }
  if (CODE.test(c)) return showStatus(c);
  if (!q.get("again") && reg && CODE.test(reg.code) && reg.code === myCode()) return showStatus(reg.code);
  return showForm();
}

$("#lang").addEventListener("click", () => {
  S = S.lang === "es" ? T.en : T.es;
  store.set("casa-lang", S.lang);
  header();
  route();
});
header();
route();
