// Tasá, el juego diario de precios (docs/viral-loop.md; built by pipeline/build-tasa.mjs). One home a day: its photos and
// facts; the player guesses the asking price in USD (the guaraní figure shows while they type), five tries, "higher" or
// "lower" and how far off after each, a win within 10%. Then the ask, the home's Casa page, our estimate with its error,
// the result to share (plain text: copy, the phone's share sheet, WhatsApp), the streak and the stats (localStorage), and
// three ways on: the weekly letter, the home, the personal link. Spanish first, English on the toggle (the "casa-lang"
// key Tekoha Casa uses). Everything after the first load runs without the network.
import { capture, myCode, validEmail } from "./capture.js?v=17b3921875";

const CFG = JSON.parse(document.getElementById("cfg").textContent || "{}");
const TRIES = 5, WIN = 0.1, TZ = "America/Asuncion";
const $ = (s, el = document) => el.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"']/g, (c) => ESC[c]));

// --- Days: the game of a day is the days since the launch, plus one, by the calendar of Asunción.
const asuDate = (t = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
const dayMs = (d) => Date.parse(`${d}T00:00:00Z`);
const gameNo = (date) => Math.round((dayMs(date) - dayMs(CFG.launch)) / 864e5) + 1;
const gameDate = (n) => new Date(dayMs(CFG.launch) + (n - 1) * 864e5).toISOString().slice(0, 10);

// --- The answer, sealed by the build (pipeline/build-tasa.mjs seal): XOR with the game's keystream, base64.
function stream(n) {
  let s = (Math.imul(n, 2654435761) ^ 0x5bd1e995) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s & 255; };
}
function unseal(n, str) {
  const bin = atob(str), b = new Uint8Array(bin.length), k = stream(n);
  for (let i = 0; i < b.length; i++) b[i] = bin.charCodeAt(i) ^ k();
  return JSON.parse(new TextDecoder().decode(b));
}

// --- Words. Plain words, no hype, no exclamation marks (docs/brand-voice.md).
const KIND = { es: { casa: "Casa", departamento: "Departamento" }, en: { casa: "House", departamento: "Apartment" } };
const T = {
  es: {
    lang: "es", grp: ".", other: "EN", otherLabel: "Read in English", by: "de Tekoha", homes: "Casas",
    title: (n) => `Tasá ${n}`, docTitle: (n) => `Tasá ${n}: adiviná el precio de esta casa`,
    weekdays: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    dateLong: (wd, d, m) => `${wd} ${d} de ${m}`,
    intro: "Adiviná el precio que pide el aviso de esta casa. Tenés 5 intentos; ganás si quedás a menos del 10%.",
    loading: "Cargando la casa de hoy.", loadFail: "No se pudo cargar la casa de hoy. Probá de nuevo en un rato.", none: "Tasá arranca muy pronto.",
    older: (n) => `La casa de hoy todavía no está lista; mientras, jugá la Tasá ${n}.`,
    archiveNote: (n, d) => `Estás jugando una partida anterior: la Tasá ${n}, del ${d}. No cuenta para tu racha.`,
    forSale: (k, place) => `${k} en venta en ${place}`,
    beds: (n) => `${n} ${n === 1 ? "dormitorio" : "dormitorios"}`, baths: (n) => `${n} ${n === 1 ? "baño" : "baños"}`,
    m2: (x, b) => `${x} m2${b === "built" ? " construidos" : b === "land" ? " de terreno" : ""}`, land: (x) => `terreno de ${x} m2`,
    age: (days) => days == null ? "" : days < 7 ? "Publicada esta semana" : days < 60 ? `Publicada hace ${Math.max(1, Math.round(days / 7))} ${Math.round(days / 7) <= 1 ? "semana" : "semanas"}`
      : `Publicada hace ${Math.round(days / 30.4)} ${Math.round(days / 30.4) === 1 ? "mes" : "meses"}`,
    photo: (i, n) => `Foto ${i} de ${n}`, noPhoto: "Foto no disponible", prev: "Foto anterior", next: "Foto siguiente",
    guessLabel: "Tu precio, en dólares", guessBtn: "Tasar", gs: (x) => `Unos ${x}`, million: (x) => `${x} ${x === "1" ? "millón" : "millones"}`,
    needNumber: "Escribí un precio en dólares, por ejemplo 150.000.", tooLow: "Eso es muy poco para una casa: escribí el precio en dólares, por ejemplo 150.000.",
    higher: (p) => `Más alto: estás ${p} abajo.`, lower: (p) => `Más bajo: estás ${p} arriba.`, hit: (p) => `Le acertaste: quedaste a ${p}.`,
    pct: (x) => (x < 0.5 ? "menos de 1%" : `${Math.round(x)}%`),
    left: (n) => (n === 1 ? "Te queda 1 intento." : `Te quedan ${n} intentos.`),
    won: (k) => `Le acertaste en ${k} ${k === 1 ? "intento" : "intentos"}.`, lost: (p) => `Esta vez no. Tu intento más cerca quedó a ${p}.`,
    asks: (main, other) => `El aviso pide ${main}${other ? `, unos ${other}` : ""}.`,
    expect: (x, err) => `Nuestra estimación: se espera que cierre cerca de ${x}, más o menos ${err}%.`,
    noEst: "Para esta casa no damos una estimación: no tenemos su error medido.",
    shareH: "Compartí tu resultado", shareText: (n, k, p, link) => `Tasá ${n}: ${k}/5, a ${p} del precio. ¿Le ganás? ${link}`,
    shareWa: "Mandar por WhatsApp", copy: "Copiar", copied: "Copiado", shareBtn: "Compartir",
    stats: ["Jugadas", "Ganadas", "Racha", "Mejor racha"], dist: "Intentos para acertar",
    nextIn: (h, m) => `La próxima Tasá sale en ${h} h ${m} min.`,
    nlH: "Recibí Tasá y las mejores casas cada martes", nlP: "Tekoha Semanal: la casa de la semana, las bajas de precio y el juego. Gratis, un correo por semana.",
    nlLabel: "Tu email", nlPh: "tu@email.com", nlBtn: "Suscribirme", nlOk: "Listo. Te llega el martes.", nlNeed: "Escribí tu email.",
    nlBad: "No se pudo. Probá de nuevo.", nlSoon: "La suscripción abre muy pronto.", nlMail: "Enviar el correo para suscribirme",
    nlMailNote: "Se abre tu correo con todo escrito: envialo y quedás suscripto.",
    houseH: "Mirá esta casa", houseP: "Las fotos, el precio, si el aviso es confiable y qué ofrecer, en Tekoha Casa.", houseBtn: "Ver la casa",
    linkH: "Compartí tu link", linkP: "Cuando 3 personas se suscriban a Tekoha Semanal con tu link, te mandamos cada semana las bajas de precio de tu barrio. Gratis.",
    linkBtn: "Quiero mi link", archH: "Partidas anteriores", today: "Hoy",
    foot: "Tasá es de Tekoha, que cuenta los avisos públicos de casas de Paraguay. El precio es el que pide el aviso; no es lo que se pagó.",
    footCasa: "Buscar casa", footHow: "Cómo contamos",
  },
  en: {
    lang: "en", grp: ",", other: "ES", otherLabel: "Leer en español", by: "by Tekoha", homes: "Homes",
    title: (n) => `Tasá ${n}`, docTitle: (n) => `Tasá ${n}: guess the price of this home`,
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    dateLong: (wd, d, m) => `${wd}, ${m} ${d}`,
    intro: "Guess the asking price of this home. You get 5 tries; you win if you land within 10%.",
    loading: "Loading today's home.", loadFail: "Today's home did not load. Try again in a while.", none: "Tasá starts very soon.",
    older: (n) => `Today's home is not ready yet; meanwhile, play Tasá ${n}.`,
    archiveNote: (n, d) => `You are playing an earlier game: Tasá ${n}, from ${d}. It does not count for your streak.`,
    forSale: (k, place) => `${k} for sale in ${place}`,
    beds: (n) => `${n} ${n === 1 ? "bedroom" : "bedrooms"}`, baths: (n) => `${n} ${n === 1 ? "bathroom" : "bathrooms"}`,
    m2: (x, b) => `${x} m2${b === "built" ? " built" : b === "land" ? " of land" : ""}`, land: (x) => `${x} m2 lot`,
    age: (days) => days == null ? "" : days < 7 ? "Listed this week" : days < 60 ? `Listed ${Math.max(1, Math.round(days / 7))} ${Math.round(days / 7) <= 1 ? "week" : "weeks"} ago`
      : `Listed ${Math.round(days / 30.4)} ${Math.round(days / 30.4) === 1 ? "month" : "months"} ago`,
    photo: (i, n) => `Photo ${i} of ${n}`, noPhoto: "Photo not available", prev: "Previous photo", next: "Next photo",
    guessLabel: "Your price, in US dollars", guessBtn: "Guess", gs: (x) => `About ${x}`, million: (x) => `${x} million`,
    needNumber: "Write a price in dollars, for example 150,000.", tooLow: "That is very little for a home: write the price in dollars, for example 150,000.",
    higher: (p) => `Higher: you are ${p} under.`, lower: (p) => `Lower: you are ${p} over.`, hit: (p) => `Got it: you were ${p} off.`,
    pct: (x) => (x < 0.5 ? "under 1%" : `${Math.round(x)}%`),
    left: (n) => (n === 1 ? "1 try left." : `${n} tries left.`),
    won: (k) => `You got it in ${k} ${k === 1 ? "try" : "tries"}.`, lost: (p) => `Not this time. Your closest try was ${p} off.`,
    asks: (main, other) => `The advert asks ${main}${other ? `, about ${other}` : ""}.`,
    expect: (x, err) => `Our estimate: it closes near ${x}, give or take ${err}%.`,
    noEst: "We give no estimate for this home: we have no measured error for it.",
    shareH: "Share your result", shareText: (n, k, p, link) => `Tasá ${n}: ${k}/5, ${p} off the asking price. Can you beat that? ${link}`,
    shareWa: "Send on WhatsApp", copy: "Copy", copied: "Copied", shareBtn: "Share",
    stats: ["Played", "Won", "Streak", "Best streak"], dist: "Tries to get it",
    nextIn: (h, m) => `The next Tasá is out in ${h} h ${m} min.`,
    nlH: "Get Tasá and the best homes every Tuesday", nlP: "Tekoha Weekly: the home of the week, the price drops and the game. Free, one email a week.",
    nlLabel: "Your email", nlPh: "you@email.com", nlBtn: "Sign up", nlOk: "Done. It arrives on Tuesday.", nlNeed: "Write your email.",
    nlBad: "That did not go through. Try again.", nlSoon: "Sign-up opens very soon.", nlMail: "Send the email to sign up",
    nlMailNote: "Your email app opens with everything written: send it and you are signed up.",
    houseH: "See this home", houseP: "The photos, the price, whether the advert can be trusted and what to offer, on Tekoha Casa.", houseBtn: "See the home",
    linkH: "Share your link", linkP: "When 3 people join Tekoha Weekly with your link, we send you the price drops of your barrio every week. Free.",
    linkBtn: "Get my link", archH: "Earlier games", today: "Today",
    foot: "Tasá is by Tekoha, which counts the public home listings of Paraguay. The price is what the advert asks; it is not what was paid.",
    footCasa: "Find a home", footHow: "How we count",
  },
};
let S = store.get("casa-lang") === "en" ? T.en : T.es;

// --- Numbers: a price as the advert states it prints exactly; a conversion is rounded (docs/consumer-app-spec.md).
const grp = (x) => String(Math.round(Math.abs(x))).replace(/\B(?=(\d{3})+(?!\d))/g, S.grp);
const usdExact = (x) => `USD ${grp(x)}`;
const usdR = (x) => `USD ${grp(x < 100000 ? Math.round(x / 1000) * 1000 : Math.round(x / 5000) * 5000)}`;
const gsExact = (x) => `Gs ${grp(x)}`;
const gsR = (x) => `Gs ${S.million(grp(Math.max(1, Math.round(x / 1e6))))}`;
const dateLong = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return S.dateLong(S.weekdays[d.getUTCDay()], d.getUTCDate(), S.months[d.getUTCMonth()]); };
// InfoCasas serves a smaller rendition of any photo on cdn2 (app-src-casa/render.js photoSrc).
const photoSrc = (u) => { const m = /^https:\/\/cdn[12]\.infocasas\.com\.uy\/repo\/img\/(?!th\.)([^/?#]+)$/.exec(u || ""); return m ? `https://cdn2.infocasas.com.uy/repo/img/th.outside720x540.${m[1]}` : u; };

// --- What the player has done: per game the guesses (localStorage "tasa_play"), and the stats of daily games ("tasa_stats").
const readJSON = (k, d) => { try { return JSON.parse(store.get(k) || "null") ?? d; } catch { return d; } };
const plays = readJSON("tasa_play", {});
let stats = { p: 0, w: 0, s: 0, m: 0, last: 0, lw: false, d: [0, 0, 0, 0, 0, 0], ...readJSON("tasa_stats", {}) };
function savePlay(n, st) {
  plays[n] = st;
  const keep = Object.keys(plays).map(Number).sort((a, b) => b - a).slice(0, 60);
  for (const k of Object.keys(plays)) if (!keep.includes(+k)) delete plays[k];
  store.set("tasa_play", JSON.stringify(plays));
}

const G = { n: null, game: null, ans: null, today: null, daily: false };
const offOf = (g) => (g - G.ans.usd) / G.ans.usd;
const best = (st) => Math.min(...st.g.map((g) => Math.abs(offOf(g))));

function toast(t) {
  const el = document.createElement("div");
  el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// --- Screen -----------------------------------------------------------------------------------------------------------
function header() {
  document.documentElement.lang = S.lang;
  $("#by").textContent = S.by;
  $("#ncasa").textContent = S.homes;
  const lb = $("#lang");
  lb.textContent = S.other; lb.setAttribute("aria-label", S.otherLabel);
  $("#foot").innerHTML = `<p>${esc(S.foot)}</p><p><a href="../casa/">${esc(S.footCasa)}</a><a href="../metodo.html">${esc(S.footHow)}</a></p>`;
}

function gallery(photos) {
  const n = photos.length;
  const items = photos.map((u, i) => `<li><figure class="ph"><img src="${esc(photoSrc(u))}" data-orig="${esc(u)}" alt="${esc(S.photo(i + 1, n))}" width="720" height="540" ` +
    `loading="${i < 2 ? "eager" : "lazy"}"${i === 0 ? ' fetchpriority="high"' : ""} decoding="async" referrerpolicy="no-referrer" onerror="tasaImgErr(this)">` +
    `<span class="phx">${esc(S.noPhoto)}</span></figure></li>`).join("");
  return `<div class="gal"><ul id="gal">${items}</ul>${n > 1 ? `<div class="dots" aria-hidden="true">${photos.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div>` +
    `<button class="gnav l" type="button" data-g="-1" aria-label="${esc(S.prev)}">&lsaquo;</button><button class="gnav r" type="button" data-g="1" aria-label="${esc(S.next)}">&rsaquo;</button>` : ""}</div>`;
}

function facts(g) {
  const place = [g.barrio, g.city].filter(Boolean).join(", ");
  const parts = [g.beds ? S.beds(g.beds) : null, g.baths ? S.baths(g.baths) : null, g.m2 ? S.m2(grp(g.m2), g.basis) : null, g.land ? S.land(grp(g.land)) : null].filter(Boolean);
  return `<div class="facts"><p class="what">${esc(S.forSale(KIND[S.lang][g.kind] || g.kind, place))}</p><p class="fa">${esc(parts.join(" · "))}</p>` +
    `${g.days != null ? `<p class="age">${esc(S.age(g.days))}</p>` : ""}</div>`;
}

function feedback(g) {
  const off = offOf(g), p = S.pct(Math.abs(off) * 100);
  if (Math.abs(off) <= WIN) return { cls: "win", t: S.hit(p) };
  return off < 0 ? { cls: "lo", t: S.higher(p) } : { cls: "hi", t: S.lower(p) };
}

function render(note) {
  const g = G.game, st = plays[G.n] || { g: [], done: false, won: false };
  document.title = S.docTitle(G.n);
  const triesHtml = st.g.map((x, i) => { const f = feedback(x); return `<li><b>${i + 1}. ${esc(usdExact(x))}</b><span class="${f.cls}">${esc(f.t)}</span></li>`; }).join("");
  const play = st.done ? "" : `<form class="play" id="play" novalidate><label class="lab" for="guess">${esc(S.guessLabel)}</label>` +
    `<div class="row"><div class="inpw"><span aria-hidden="true">USD</span><input class="inp" id="guess" inputmode="numeric" autocomplete="off" enterkeyhint="go" aria-describedby="gs"></div>` +
    `<button class="btn pri" type="submit">${esc(S.guessBtn)}</button></div><p class="gs" id="gs" aria-live="polite"></p>` +
    `${st.g.length ? `<ul class="tries">${triesHtml}</ul><p class="left">${esc(S.left(TRIES - st.g.length))}</p>` : ""}<p class="msg" id="pmsg" role="alert"></p>` +
    `<p class="sr" id="say" role="status"></p></form>`;
  // #say reads the last answer out to a screen reader; the list shows every try on screen.
  $("#main").innerHTML = `<h1>${esc(S.title(G.n))}</h1><p class="when">${esc(dateLong(gameDate(G.n)))}</p>` +
    (note ? `<p class="note">${esc(note)}</p>` : "") + `<p class="intro">${esc(S.intro)}</p>` +
    gallery(g.photos) + facts(g) + play + (st.done ? endHtml(st, triesHtml) : "") + archiveHtml();
  wire(st);
}

function endHtml(st, triesHtml) {
  const a = G.ans, k = st.g.length, p = S.pct(best(st) * 100);
  const main = a.cur === "PYG" ? gsExact(a.p) : usdExact(a.p), other = a.cur === "PYG" ? usdR(a.usd) : null;
  const link = `${CFG.site}/tasa/?r=${myCode(true)}`;
  const text = S.shareText(G.n, st.won ? k : "X", p, link);
  // The bar of this game's result is marked only when the game counted in the stats (a daily game).
  const mine = st.daily ? (st.won ? k - 1 : 5) : -1;
  const dist = stats.d.map((c, i) => `<li${i === mine ? ' class="me"' : ""}><span>${i < 5 ? i + 1 : "X"}</span>` +
    `<i style="width:${Math.max(8, Math.round((c / Math.max(1, ...stats.d)) * 100))}%">${c}</i></li>`).join("");
  const streak = stats.last >= G.today - 1 ? stats.s : 0;
  return `<section class="end" id="end"><p class="big">${esc(st.won ? S.won(k) : S.lost(p))}</p>` +
    `<ul class="tries">${triesHtml}</ul>` +
    `<p>${esc(S.asks(main, other))}</p><p>${esc(a.e != null && a.err != null ? S.expect(usdR(a.e), Math.round(a.err)) : S.noEst)}</p>` +
    `<div class="share"><h2>${esc(S.shareH)}</h2><pre id="stext">${esc(text)}</pre><div class="acts">` +
    `<a class="btn pri" id="swa" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${esc(S.shareWa)}</a>` +
    `<button class="btn" type="button" id="scopy">${esc(S.copy)}</button>${navigator.share ? `<button class="btn" type="button" id="sshare">${esc(S.shareBtn)}</button>` : ""}</div></div>` +
    `<div class="stats"><div><b>${stats.p}</b><span>${esc(S.stats[0])}</span></div><div><b>${stats.p ? Math.round((stats.w / stats.p) * 100) : 0}%</b><span>${esc(S.stats[1])}</span></div>` +
    `<div><b>${streak}</b><span>${esc(S.stats[2])}</span></div><div><b>${stats.m}</b><span>${esc(S.stats[3])}</span></div></div>` +
    `<p class="lab">${esc(S.dist)}</p><ul class="dist">${dist}</ul><p class="next" id="next"></p>` +
    `<div class="calls"><div class="call"><h3>${esc(S.nlH)}</h3><p>${esc(S.nlP)}</p><form id="nl" class="nlr" novalidate>` +
    `<input class="inp" id="nle" type="email" autocomplete="email" placeholder="${esc(S.nlPh)}" aria-label="${esc(S.nlLabel)}">` +
    `<input class="hp" id="nlw" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn pri" type="submit">${esc(S.nlBtn)}</button></form><p class="msg" id="nlmsg" role="status"></p></div>` +
    `<div class="call"><h3>${esc(S.houseH)}</h3><p>${esc(S.houseP)}</p><a class="btn" href="../casa/#/casa/${a.id}">${esc(S.houseBtn)}</a></div>` +
    `<div class="call"><h3>${esc(S.linkH)}</h3><p>${esc(S.linkP)}</p><a class="btn" href="../compartir/">${esc(S.linkBtn)}</a></div></div></section>`;
}

function archiveHtml() {
  const older = (CFG.games || []).filter((n) => n <= G.today).sort((a, b) => b - a).slice(0, 30);
  if (older.length < 2) return "";
  const shortDate = (n) => { const d = new Date(`${gameDate(n)}T12:00:00Z`); return `${d.getUTCDate()} ${S.months[d.getUTCMonth()].slice(0, 3)}`; };
  return `<section class="arch"><h2>${esc(S.archH)}</h2><ul>${older.map((n) => `<li><a href="${n === G.today ? "./" : `?n=${n}`}"${n === G.n ? ' aria-current="page"' : ""}>` +
    `${esc(n === G.today ? `${S.today}: ${S.title(n)}` : `${S.title(n)}, ${shortDate(n)}`)}</a></li>`).join("")}</ul></section>`;
}

function countdown() {
  const el = $("#next");
  if (!el || !G.daily) return;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, +x.value]));
  const left = 86400 - (p.hour * 3600 + p.minute * 60 + p.second);
  el.textContent = S.nextIn(Math.floor(left / 3600), Math.floor((left % 3600) / 60));
}

function wire(st) {
  const gal = $("#gal");
  if (gal) {
    const dots = [...document.querySelectorAll(".dots i")];
    gal.addEventListener("scroll", () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); dots.forEach((d, j) => d.classList.toggle("on", i === j)); }, { passive: true });
    document.querySelectorAll(".gnav").forEach((b) => b.addEventListener("click", () => gal.scrollBy({ left: +b.dataset.g * gal.clientWidth, behavior: "smooth" })));
  }
  const f = $("#play");
  if (f) {
    const inp = $("#guess"), gs = $("#gs");
    inp.addEventListener("input", () => {
      const v = +inp.value.replace(/\D/g, "").slice(0, 10);
      inp.value = v ? grp(v) : "";
      gs.textContent = v && G.game.fx ? S.gs(gsR(v * G.game.fx)) : "";
    });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = +inp.value.replace(/\D/g, ""), m = $("#pmsg");
      if (!v) { m.className = "msg bad"; m.textContent = S.needNumber; inp.focus(); return; }
      if (v < 5000) { m.className = "msg bad"; m.textContent = S.tooLow; inp.focus(); return; }
      guess(v);
    });
    // Not on the first screen: a phone's keyboard would cover the photos before the player has seen them.
    if (st.g.length) inp.focus();
  }
  const end = $("#end");
  if (end) {
    const text = $("#stext").textContent;
    $("#scopy").addEventListener("click", () => copy(text));
    $("#sshare")?.addEventListener("click", () => navigator.share({ text }).catch(() => {}));
    $("#nl").addEventListener("submit", signup);
    countdown();
  }
}

function guess(v) {
  const st = plays[G.n] || { g: [], done: false, won: false, daily: G.daily };
  if (st.done) return;
  st.g.push(v);
  const won = Math.abs(offOf(v)) <= WIN;
  if (won || st.g.length >= TRIES) {
    st.done = true; st.won = won;
    if (st.daily ?? G.daily) {
      // A daily game counts once: a win extends the streak only when the last daily game was yesterday's and was won.
      stats.p += 1;
      if (won) { stats.w += 1; stats.s = stats.last === G.n - 1 && stats.lw ? stats.s + 1 : 1; stats.m = Math.max(stats.m, stats.s); stats.d[st.g.length - 1] += 1; }
      else { stats.s = 0; stats.d[5] += 1; }
      stats.last = G.n; stats.lw = won;
      store.set("tasa_stats", JSON.stringify(stats));
    }
  }
  savePlay(G.n, st);
  render(G.note);
  if (st.done) $("#end")?.scrollIntoView({ behavior: "smooth", block: "start" });
  else $("#say").textContent = feedback(v).t;
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

async function signup(e) {
  e.preventDefault();
  const m = $("#nlmsg"), email = $("#nle").value.trim(), btn = $("#nl button");
  if ($("#nlw").value) return;
  if (!validEmail(email)) { m.className = "msg bad"; m.textContent = S.nlNeed; $("#nle").focus(); return; }
  btn.disabled = true;
  const r = await capture(CFG, { kind: "newsletter", email, source: "tasa", payload: { lang: S.lang, code: myCode(true), from: `tasa-${G.n}` } });
  btn.disabled = false;
  if (r.via === "rest" && r.ok) { m.className = "msg okm"; m.textContent = S.nlOk; $("#nle").value = ""; return; }
  if (r.href) {
    m.className = "msg";
    m.innerHTML = `${r.via === "rest" ? `${esc(S.nlBad)} ` : `${esc(S.nlMailNote)} `}<a class="btn pri" href="${esc(r.href)}">${esc(S.nlMail)}</a>`;
    // The prefilled email opens at once; the button stays for a phone or browser that did not open it.
    if (r.via === "mail") location.href = r.href;
    return;
  }
  m.className = r.via === "soon" ? "msg" : "msg bad";
  m.textContent = r.via === "soon" ? S.nlSoon : S.nlBad;
}

// --- Start --------------------------------------------------------------------------------------------------------------
async function start() {
  header();
  G.today = gameNo(asuDate());
  const have = (CFG.games || []).filter((n) => n <= G.today);
  if (!have.length) { $("#main").innerHTML = `<p class="intro">${esc(S.none)}</p>`; return; }
  const asked = +(new URLSearchParams(location.search).get("n") || 0);
  const latest = Math.max(...have);
  G.n = asked && have.includes(asked) ? asked : latest;
  G.daily = G.n === G.today;
  G.note = G.daily ? null : asked && asked === G.n ? S.archiveNote(G.n, dateLong(gameDate(G.n))) : S.older(G.n);
  try {
    const r = await fetch(`data/${G.n}.json?v=${CFG.v}`);
    if (!r.ok) throw new Error(String(r.status));
    G.game = await r.json();
    G.ans = unseal(G.n, G.game.x);
  } catch {
    $("#main").innerHTML = `<p class="intro">${esc(S.loadFail)}</p>`;
    return;
  }
  render(G.note);
  setInterval(countdown, 30000);
}

$("#lang").addEventListener("click", () => {
  S = S.lang === "es" ? T.en : T.es;
  store.set("casa-lang", S.lang);
  header();
  if (G.game) {
    const typed = $("#guess")?.value || "";
    G.note = G.daily ? null : new URLSearchParams(location.search).get("n") ? S.archiveNote(G.n, dateLong(gameDate(G.n))) : S.older(G.n);
    render(G.note);
    if (typed && $("#guess")) { $("#guess").value = typed; $("#guess").dispatchEvent(new Event("input")); }
  }
});
start();
