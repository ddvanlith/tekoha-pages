// Tekoha Casa, the consumer app (docs/consumer-app-spec.md; built by pipeline/build-casa.mjs). Five screens over the pro
// app's data: Buscar (#/buscar), La casa (#/casa/<id>), El barrio (#/barrio), Mi casa (#/vender) and Guardados
// (#/guardados), plus one lead form. It reads the detail files of /app/ and its own tables in app/data/: casa.json (the
// first screen and the file list), casa-zonas.json (places, El barrio, Mi casa) and one card file per city market
// (casa-<op>-<market>.json). No framework, no account, no advert. window.casaCheck() lists any jargon or banned word on
// screen outside "¿Cómo lo sabemos?", and any banned word inside it.
import ES from "./strings-es.js?v=e0881558d9";
import CFG from "./config.js?v=e0881558d9";
import { KINDS, BUDGETS, BEDS, MIN_M2, esc, fromDay, fmt, photoSrc, lineOf, factsOf, placeOf, cardHtml, skeletonHtml, countHtml, footHtml, buscarShell } from "./render.js?v=e0881558d9";
import { capture } from "./capture.js?v=e0881558d9";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const DATA = "../app/data/";
const SRC = { remax: "RE/MAX", infocasas: "InfoCasas", uprop: "uProp", cb: "Coldwell Banker", psir: "Sotheby's", prestige: "Prestige", c21: "Century 21" };
const SORT_KEYS = ["new", "price", "size"];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const slug = (k) => String(k).replace(/ /g, "-");
const fold = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

let S = ES, F = fmt(ES, null);
const ST = {
  casa: null, zonas: null, zonasP: null, shards: new Map(), Q: null, list: null, shown: 0, view: null, scroll: new Map(),
  saved: [], lastSearch: "#/buscar", map: null, mapLayer: null, mapKey: null, leafletP: null, sugg: [], suggAt: -1, typing: null,
  // Where "Volver" goes from El barrio: Mi casa or the home it was opened from, else the search.
  barrioBack: null,
};
try { ST.saved = JSON.parse(store.get("casa-saved") || "[]").filter((x) => x && x.id && x.r); } catch { ST.saved = []; }

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) { const e = new Error(`${url} ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}
function toast(t) {
  const el = document.createElement("div");
  el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
const fx = () => ST.casa?.fx?.rate || null;

// ---------------------------------------------------------------------------------------------
// Data: casa.json (first screen, card lines), casa-zonas.json (places, El barrio, Mi casa), shards (the index).
// ---------------------------------------------------------------------------------------------
const loadZonas = () => ST.zonasP || (ST.zonasP = getJSON(`${DATA}casa-zonas.json`)
  .then((z) => (ST.zonas = { zones: {}, negs: {}, transfers: {}, val: {}, places: [], markets: [], min: { median: 20 }, ...z }))
  .catch((e) => { ST.zonasP = null; throw e; }));
// A card file (pipeline/build-app.mjs section 8) holds one city market's homes that the lists can show (the four kinds,
// an ask that reads as a price, a trust band the rule saw active), as packed columns, and counts what it leaves out per
// kind and barrio (hid), so the foot of a list can say how many it left out. id is the difference from the previous row's
// id; p the ask, negative in guaraníes; t the trust band times 4 plus the card line (1 inside the estimate's range, 2
// above, 3 below, 0 not compared); nw the publish day less nw0, or -1 less it where the portal gives no publish date
// (days listed: td less the day); y and x offsets from y0 and x0, -1 where the home has no point of its own (as a and bd
// where the advert gives none); su lists only the rows that have one; ph drops the prefix of dict.pf its leading base-36
// index names ("-": none).
function decode(j) {
  const a = j.a, d = j.dict, rate = fx(), out = new Array(j.n);
  const v = (x) => (x < 0 ? null : x);
  const photo = (s) => (!s ? null : s[0] === "-" ? s.slice(1) : d.pf[parseInt(s[0], 36)] + s.slice(1));
  let id = 0;
  for (let i = 0; i < j.n; i++) {
    id += a.id[i];
    const pp = a.p[i], cu = pp != null && pp < 0 ? 1 : 0, p = pp == null ? null : Math.abs(pp), su = a.su[i] ?? null, own = a.y[i] >= 0;
    const w = a.nw[i], nw = (w >= 0 ? w : -1 - w) + j.nw0;
    out[i] = { id, k: d.k[a.k[i]], c: d.c[a.c ? a.c[i] : 0], mk: j.mk, b: a.b[i] >= 0 ? d.b[a.b[i]] : null,
      y: own ? a.y[i] + j.y0 : null, x: own ? a.x[i] + j.x0 : null, pr: own ? 0 : 2,
      p, cu, su, a: v(a.a[i]), ab: a.ab[i] >= 0 ? d.ab[a.ab[i]] : null, bd: v(a.bd[i]), dl: w >= 0 ? j.td - nw : null, ct: a.ct[i],
      tb: a.t[i] >> 2, cls: a.t[i] & 3, nw, ph: photo(a.ph[i]), dk: j.dept, op: j.op, usd: p != null ? (cu ? p / rate : p) : su };
  }
  const hid = (j.hid || []).map(([k, b, n]) => ({ k: d.k[k], b: b >= 0 ? d.b[b] : null, mk: j.mk, dk: j.dept, n }));
  return { rows: out, hid };
}
function loadMk(mk, op) {
  const key = `${mk}|${op}`;
  if (ST.shards.has(key)) return ST.shards.get(key);
  const info = ST.casa?.files?.[key];
  const p = info ? getJSON(`${DATA}${info.file}`).then(decode) : Promise.resolve({ rows: [], hid: [] });
  p.catch(() => ST.shards.delete(key));
  ST.shards.set(key, p);
  return p;
}
// The card files a place needs: its city market, or every market of its department.
const mksOfDept = (dk) => ST.casa?.depts?.[dk] || [];
const mksOf = (pl) => (!pl ? ST.casa.home.flatMap(mksOfDept) : pl.lvl === "d" ? mksOfDept(pl.dk) : [pl.mk]);
async function loadMks(mks, op) {
  const sets = await Promise.all(mks.map((mk) => loadMk(mk, op)));
  return { rows: sets.flatMap((s) => s.rows), hid: sets.flatMap((s) => s.hid) };
}

// ---------------------------------------------------------------------------------------------
// Places: "m:<market id>" (a department or a city) or "b:<market id>|<barrio>".
// ---------------------------------------------------------------------------------------------
function placeInfo(id) {
  if (!id || !ST.zonas) return null;
  const Z = ST.zonas;
  if (id.startsWith("m:")) {
    const m = Z.markets.find((x) => x.id === id.slice(2));
    if (!m) return null;
    const parent = m.parent ? Z.markets.find((x) => x.id === m.parent) : null;
    return { id, name: m.name, label: m.name, dk: m.dk, mk: m.id, lvl: m.level === "dept" ? "d" : "c", bbox: m.bbox, zone: m.id, parentName: parent?.name || null };
  }
  if (id.startsWith("b:")) {
    const [mk, name] = id.slice(2).split("|");
    const p = Z.places.find((x) => x[0] === name && x[1] === mk);
    const m = Z.markets.find((x) => x.id === mk);
    if (!m) return null;
    return { id, name, label: `${name}, ${p?.[5] || m.name}`, dk: m.dk, mk, barrio: name, lvl: "b", lat: p?.[2], lon: p?.[3], zone: `${mk}|${name}`, parentName: m.name, cityName: p?.[5] || m.name };
  }
  return null;
}
const inPlace = (r, pl) => (pl.lvl === "d" ? r.dk === pl.dk : pl.lvl === "c" ? r.mk === pl.mk : r.mk === pl.mk && r.b === pl.barrio);
const homeName = () => S.whereAll;

function suggest(q) {
  const Z = ST.zonas;
  if (!Z) return [];
  const f = fold(q.trim());
  const out = [];
  if (!f) out.push({ id: null, t: S.whereAll, s: "" });
  for (const m of Z.markets) {
    if (f && !fold(m.name).includes(f)) continue;
    out.push({ id: `m:${m.id}`, t: m.name, s: m.level === "dept" ? (S.lang === "en" ? "department" : "departamento") : Z.markets.find((x) => x.id === m.parent)?.name || "", n: m.n?.sale });
  }
  if (f.length >= 2) {
    for (const p of Z.places) {
      if (!fold(p[0]).includes(f)) continue;
      out.push({ id: `b:${p[1]}|${p[0]}`, t: p[0], s: p[5] || "" });
      if (out.length > 14) break;
    }
  }
  // Nothing matches: the nearest name within two letters ("San Lorenso"), offered as a question.
  if (!out.length && f.length >= 4) {
    let best = null;
    const near = (name, x) => { const d = lev(f, fold(name)); if (d <= 2 && (!best || d < best.d)) best = { ...x, d }; };
    for (const m of Z.markets) near(m.name, { id: `m:${m.id}`, t: m.name, s: m.level === "dept" ? (S.lang === "en" ? "department" : "departamento") : Z.markets.find((x) => x.id === m.parent)?.name || "" });
    for (const p of Z.places) near(p[0], { id: `b:${p[1]}|${p[0]}`, t: p[0], s: p[5] || "" });
    if (best) out.push({ ...best, dym: true });
  }
  return out.slice(0, 14);
}
// Edit distance (Levenshtein), stopped early past 2.
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      low = Math.min(low, cur[j]);
    }
    if (low > 2) return 3;
    prev = cur;
  }
  return prev[b.length];
}
const suggLabel = (x) => (x.dym ? S.didYouMean(x.t) : x.t);

// ---------------------------------------------------------------------------------------------
// The query: #/buscar?o=rent&q=<place>&p=<USD>&k=casa,terreno&b=3&s=price&map=1&v=<lat>,<lon>,<zoom>
// ---------------------------------------------------------------------------------------------
function parseQ(qs) {
  const u = new URLSearchParams(qs || "");
  const k = (u.get("k") || "").split(",").filter((x) => KINDS.includes(x));
  const p = +u.get("p"), b = +u.get("b");
  const v = (u.get("v") || "").split(",").map(Number);
  return { o: u.get("o") === "rent" ? "rent" : "sale", q: u.get("q") || null, p: p > 0 ? p : null, k: k.length === KINDS.length ? [] : k,
    b: BEDS.includes(b) ? b : null, s: SORT_KEYS.includes(u.get("s")) ? u.get("s") : "new", map: u.get("map") === "1", v: v.length === 3 && v.every(Number.isFinite) ? v : null };
}
function hashQ(Q) {
  const p = [];
  if (Q.o !== "sale") p.push("o=rent");
  if (Q.q) p.push(`q=${encodeURIComponent(Q.q)}`);
  if (Q.p) p.push(`p=${Q.p}`);
  if (Q.k.length) p.push(`k=${Q.k.join(",")}`);
  if (Q.b) p.push(`b=${Q.b}`);
  if (Q.s !== "new") p.push(`s=${Q.s}`);
  if (Q.map) { p.push("map=1"); if (Q.v) p.push(`v=${Q.v[0].toFixed(4)},${Q.v[1].toFixed(4)},${Q.v[2]}`); }
  return `#/buscar${p.length ? `?${p.join("&")}` : ""}`;
}
const firstOK = (Q) => !Q.q && !Q.p && !Q.k.length && !Q.b && Q.s === "new" && !Q.map;
// Newest first; a home with a photo before one without on the same day (pipeline/build-app.mjs orders the first screen
// the same way, so "Ver más" continues it).
const SORTS = {
  new: (a, b) => (b.nw ?? -1) - (a.nw ?? -1) || !!b.ph - !!a.ph || b.id - a.id,
  price: (a, b) => (a.usd == null) - (b.usd == null) || (a.usd ?? 0) - (b.usd ?? 0) || a.id - b.id,
  size: (a, b) => (a.a == null) - (b.a == null) || (b.a ?? 0) - (a.a ?? 0) || a.id - b.id,
};
// The lists show homes of the four kinds that the trust rule saw active and whose ask is a price; what they leave out for
// that is counted (hidden, from the card files' hid) and said at the foot. With a bedroom filter a terreno is not a
// candidate, and a home that does not give its bedrooms is counted apart.
function filterRows(set, Q, { place = null, ignorePlace = false } = {}) {
  const out = [];
  let noPrice = 0, noBeds = 0, hidden = 0;
  const kindOk = (k) => KINDS.includes(k) && (!Q.k.length || Q.k.includes(k)) && !(Q.b && k === "terreno");
  for (const r of set.rows) {
    if (!kindOk(r.k)) continue;
    if (place && !ignorePlace && !inPlace(r, place)) continue;
    if (r.tb < 0 || r.tb > 2) { hidden += 1; continue; }
    if (Q.b) { if (!(r.bd > 0)) { noBeds += 1; continue; } if (r.bd < Q.b) continue; }
    if (Q.p) { if (r.usd == null) { noPrice += 1; continue; } if (r.usd > Q.p) continue; }
    out.push(r);
  }
  for (const h of set.hid) if (kindOk(h.k) && (!place || ignorePlace || inPlace(h, place))) hidden += h.n;
  return { rows: out, noPrice, noBeds, hidden };
}
// Twins: two units with the same kind, ask, size and bedrooms in the same city market are almost surely one home under
// two ads that entity resolution has not joined (the rule Parecidas uses). The list shows the first in its order (on the
// same day, the one with a photo comes first), marked with the ads it stands for.
function collapse(list) {
  const at = new Map(), out = [];
  for (const r of list) {
    if (r.p == null || !(r.a >= MIN_M2)) { out.push(r); continue; }
    const key = `${r.k}|${r.p}|${r.cu}|${r.a}|${r.bd ?? ""}|${r.mk}`;
    const i = at.get(key);
    if (i == null) { at.set(key, out.length); out.push(r); continue; }
    out[i] = { ...out[i], tw: (out[i].tw || 1) + 1 };
  }
  return out;
}
// A list as the screen shows it: filtered, sorted, twins joined.
function listOf(set, Q, opts) {
  const f = filterRows(set, Q, opts);
  f.rows = collapse(f.rows.sort(SORTS[Q.s]));
  return f;
}
const rowsFor = (Q, pl) => loadMks(mksOf(pl), Q.o);

// ---------------------------------------------------------------------------------------------
// Buscar.
// ---------------------------------------------------------------------------------------------
const PAGE = 20;
const savedIds = () => new Set(ST.saved.map((x) => x.id));
function cardsHtml(rows, from, to) {
  const sv = savedIds();
  return rows.slice(from, to).map((r, i) => cardHtml(S, F, r, { op: ST.Q.o, eager: from + i < 2, high: from + i === 0, saved: sv.has(r.id) })).join("");
}
function whereName(pl) { return pl ? pl.name : homeName(); }
function renderShell(Q, pl) {
  const V = $("#v-buscar");
  // The map lives in the shell's #mapbox: a new shell needs a new map.
  if (ST.map) { ST.map.remove(); ST.map = null; ST.mapKey = null; }
  V.innerHTML = buscarShell(S, F, { Q: { ...Q, label: pl?.label || "" }, fx: fx(), count: esc(S.countLoading), cards: skeletonHtml(3), more: null,
    foot: footHtml(S, F, { date: ST.casa.data_at, hidden: firstHidden(Q) }), zone: zoneOf(pl, Q) });
  V.dataset.shell = `${S.lang}|${Q.o}`;
  document.documentElement.dataset.pre = "off";
  wireBuscar();
}
const firstHidden = (Q) => (!Q.q && !Q.k.length ? ST.casa.first?.[Q.o]?.hidden || 0 : 0);
const zoneOf = (pl, Q) => (pl && ST.zonas?.zones?.[pl.zone] ? { name: pl.name, href: `#/barrio?z=${encodeURIComponent(pl.zone)}&k=${Q.k.length === 1 ? Q.k[0] : "casa"}` } : null);
function syncShell(Q, pl) {
  for (const b of $$("[data-op]")) b.setAttribute("aria-pressed", String(b.dataset.op === Q.o));
  for (const b of $$("[data-k]")) b.setAttribute("aria-pressed", String(Q.k.includes(b.dataset.k)));
  for (const b of $$("[data-bud]")) b.setAttribute("aria-pressed", String(+b.dataset.bud === Q.p));
  for (const b of $$("[data-bd]")) b.setAttribute("aria-pressed", String(+b.dataset.bd === Q.b));
  const w = $("#where"), bu = $("#budget");
  if (w && document.activeElement !== w) w.value = pl?.label || "";
  $("#whereclr").hidden = !Q.q;
  if (bu && document.activeElement !== bu) bu.value = Q.p ? `USD ${F.n0(Q.p)}` : "";
  $("#budclr").hidden = !Q.p;
  $("#budgs").textContent = Q.p && fx() ? S.budgetGs(F.gsR(Q.p * fx())) : "";
  $("#sort").value = Q.s;
  const mb = $("#mapbtn");
  mb.textContent = Q.map ? S.listBtn : S.mapBtn;
  mb.setAttribute("aria-pressed", String(Q.map));
  const z = zoneOf(pl, Q), zl = $("#zlink");
  zl.hidden = !z || Q.map;
  if (z) { zl.href = z.href; zl.textContent = S.zoneLink(z.name); }
}
const setFoot = (hidden) => { $("#lfoot").innerHTML = footHtml(S, F, { date: ST.casa.data_at, hidden }); };
function setCount(n, Q, pl, noPrice = 0, noBeds = 0) {
  $("#count").innerHTML = countHtml(S, F, { n, kinds: Q.k, op: Q.o, where: Q.map ? S.inMap : whereName(pl), noPrice, noBeds });
}
function setMore() {
  const L = ST.list, more = $("#more");
  const left = (L.full ? L.rows.length : L.n) - ST.shown;
  more.hidden = left <= 0;
  more.textContent = S.more(F.n0(Math.min(PAGE, left)));
}
async function showBuscar(qs) {
  const Q = parseQ(qs);
  ST.Q = Q;
  ST.lastSearch = hashQ(Q);
  document.title = S.title;
  if (Q.q && !ST.zonas) await loadZonas().catch(() => null);
  const pl = Q.q ? placeInfo(Q.q) : null;
  // A place id that names no place (an old or mistyped link) says so and offers the whole list; it never widens by itself.
  const badPlace = !!Q.q && !pl;
  const V = $("#v-buscar");
  const hydrate = !V.dataset.shell && document.documentElement.dataset.pre === "on" && firstOK(Q) && Q.o === "sale" && S.lang === "es";
  if (hydrate) {
    V.dataset.shell = `es|sale`;
    wireBuscar();
    const first = ST.casa.first.sale;
    ST.list = { rows: first.rows, n: first.n, full: false };
    // The cards built into the page; the skeletons beside them (.skel) are not cards.
    ST.shown = $$("#cards .pre .card").length;
    const add = cardsHtml(first.rows, ST.shown, PAGE);
    $("#cards").insertAdjacentHTML("beforeend", add);
    ST.shown = Math.min(PAGE, first.rows.length);
    ST.rendered = ST.lastSearch;
    setMore();
    return;
  }
  // Back from a home to the same search: the cards, the "more" already shown and the scroll stay as they were.
  if (V.dataset.shell === `${S.lang}|${Q.o}` && ST.rendered === ST.lastSearch && !Q.map && $("#cards .card")) { closeSugg(); restoreScroll(); return; }
  if (V.dataset.shell !== `${S.lang}|${Q.o}`) renderShell(Q, pl);
  else syncShell(Q, pl);
  ST.rendered = Q.map || badPlace ? null : ST.lastSearch;
  closeSugg();
  if (badPlace) {
    const why = ST.zonas ? S.badPlace : S.loadFail;
    $("#mapbox").hidden = true;
    $("#more").hidden = true;
    $("#count").textContent = why;
    setFoot(0);
    $("#cards").innerHTML = `<div class="empty"><p><b>${esc(why)}</b></p><a class="btn" href="${esc(hashQ({ ...Q, q: null, map: false, v: null }))}">${esc(S.seeAllHome)}</a></div>`;
    return;
  }
  if (Q.map) { $("#mapbox").hidden = false; await showMap(Q, pl); return; }
  $("#mapbox").hidden = true;
  if (firstOK(Q) && ST.casa.first?.[Q.o]) {
    const first = ST.casa.first[Q.o];
    ST.list = { rows: first.rows, n: first.n, full: false };
    setCount(first.n, Q, null);
    setFoot(first.hidden);
    $("#cards").innerHTML = cardsHtml(first.rows, 0, PAGE);
    ST.shown = Math.min(PAGE, first.rows.length);
    setMore();
    restoreScroll();
    return;
  }
  $("#count").textContent = S.countLoading;
  if (!$("#cards .card")) $("#cards").innerHTML = skeletonHtml(3);
  let set;
  try { set = await rowsFor(Q, pl); }
  catch {
    if (ST.Q !== Q) return;
    $("#count").textContent = S.loadFail;
    $("#cards").innerHTML = `<div class="empty"><button class="btn" type="button" data-retry>${esc(S.retry)}</button></div>`;
    return;
  }
  if (ST.Q !== Q) return;
  const { rows: list, noPrice, noBeds, hidden } = listOf(set, Q, { place: pl });
  ST.list = { rows: list, n: list.length, full: true };
  setCount(list.length, Q, pl, noPrice, noBeds);
  setFoot(hidden);
  if (!list.length) { $("#cards").innerHTML = await emptyHtml(Q, pl); $("#more").hidden = true; return; }
  $("#cards").innerHTML = cardsHtml(list, 0, PAGE);
  ST.shown = Math.min(PAGE, list.length);
  setMore();
  restoreScroll();
}
function restoreScroll() {
  const y = ST.scroll.get(location.hash);
  if (y != null) requestAnimationFrame(() => window.scrollTo(0, y));
}
// The empty state offers one tap: a higher budget, the place around this one, any number of bedrooms, or every type.
async function emptyHtml(Q, pl) {
  const opts = [];
  const count = async (Q2, p2) => listOf(await rowsFor(Q2, p2), Q2, { place: p2 }).rows.length;
  if (Q.p) {
    for (const b of [...BUDGETS[Q.o], Q.p * 1.5, Q.p * 2].filter((x) => x > Q.p).sort((x, y) => x - y)) {
      const n = await count({ ...Q, p: Math.round(b) }, pl);
      if (n) { opts.push(`<a class="btn" href="${esc(hashQ({ ...Q, p: Math.round(b) }))}">${esc(S.emptyBudget(F.usdR(b), F.n0(n)))}</a>`); break; }
    }
  }
  if (pl) {
    const up = pl.lvl === "b" ? `m:${pl.mk}` : pl.lvl === "c" ? `m:d:${slug(pl.dk)}` : null;
    const near = up ? placeInfo(up) : null;
    if (near) {
      const n = await count(Q, near);
      if (n) opts.push(`<a class="btn" href="${esc(hashQ({ ...Q, q: near.id }))}">${esc(S.emptyPlace(near.name, F.n0(n)))}</a>`);
    }
  }
  if (Q.b) {
    const n = await count({ ...Q, b: null }, pl);
    if (n) opts.push(`<a class="btn" href="${esc(hashQ({ ...Q, b: null }))}">${esc(S.emptyBeds(F.n0(n)))}</a>`);
  }
  if (Q.k.length) {
    const n = await count({ ...Q, k: [] }, pl);
    if (n) opts.push(`<a class="btn" href="${esc(hashQ({ ...Q, k: [] }))}">${esc(S.emptyKinds(F.n0(n)))}</a>`);
  }
  return `<div class="empty"><p><b>${esc(S.emptyTitle)}</b></p>${opts.join("") || `<p>${esc(S.emptyNone)}</p>`}</div>`;
}
async function moreCards() {
  const L = ST.list;
  if (!L.full) {
    $("#more").disabled = true;
    try {
      const { rows: list } = listOf(await rowsFor(ST.Q, null), ST.Q);
      ST.list = { rows: list, n: list.length, full: true };
    } catch { toast(S.loadFail); return; } finally { $("#more").disabled = false; }
  }
  const to = ST.shown + PAGE;
  $("#cards").insertAdjacentHTML("beforeend", cardsHtml(ST.list.rows, ST.shown, to));
  ST.shown = Math.min(to, ST.list.rows.length);
  setMore();
}
function go(hash, replace = false) {
  if (replace) { history.replaceState(null, "", hash); route(); }
  else if (location.hash === hash) route();
  else location.hash = hash;
}

// The place box: suggestions from the places list, arrows and Enter.
function openSugg(q) {
  const ul = $("#sugg"), w = $("#where");
  if (!ul) return;
  if (!ST.zonas) { loadZonas().then(() => { if (document.activeElement === w) openSugg(w.value); }).catch(() => {}); return; }
  ST.sugg = suggest(q);
  ST.suggAt = q.trim() ? 0 : -1;
  ul.innerHTML = ST.sugg.length ? ST.sugg.map((x, i) => `<li role="option" id="sg-${i}" data-i="${i}" aria-selected="${i === ST.suggAt}" class="${i === ST.suggAt ? "on" : ""}">` +
    `<span>${esc(suggLabel(x))}</span><small>${esc(x.s || "")}</small></li>`).join("") : `<li aria-disabled="true">${esc(S.noPlace)}</li>`;
  ul.hidden = false;
  w.setAttribute("aria-expanded", "true");
  w.setAttribute("aria-activedescendant", ST.suggAt >= 0 ? `sg-${ST.suggAt}` : "");
}
function closeSugg() {
  const ul = $("#sugg");
  if (ul) ul.hidden = true;
  $("#where")?.setAttribute("aria-expanded", "false");
}
function pickSugg(i) {
  const x = ST.sugg[i];
  if (!x) return;
  closeSugg();
  $("#where").blur();
  go(hashQ({ ...ST.Q, q: x.id, map: ST.Q.map, v: null }));
}
function wireBuscar() {
  const V = $("#v-buscar");
  if (V.dataset.wired) return;
  V.dataset.wired = "1";
  V.addEventListener("click", (e) => {
    const t = e.target;
    const op = t.closest("[data-op]");
    if (op) { if (op.dataset.op !== ST.Q.o) go(hashQ({ ...ST.Q, o: op.dataset.op, p: null })); return; }
    const k = t.closest("[data-k]");
    if (k) { const set = new Set(ST.Q.k); if (set.has(k.dataset.k)) set.delete(k.dataset.k); else set.add(k.dataset.k); go(hashQ({ ...ST.Q, k: KINDS.filter((x) => set.has(x)) })); return; }
    const bud = t.closest("[data-bud]");
    if (bud) { const b = +bud.dataset.bud; go(hashQ({ ...ST.Q, p: ST.Q.p === b ? null : b })); return; }
    const bd = t.closest("[data-bd]");
    if (bd) { const b = +bd.dataset.bd; go(hashQ({ ...ST.Q, b: ST.Q.b === b ? null : b })); return; }
    if (t.closest("#whereclr")) { $("#where").value = ""; go(hashQ({ ...ST.Q, q: null })); return; }
    if (t.closest("#budclr")) { $("#budget").value = ""; go(hashQ({ ...ST.Q, p: null })); return; }
    const li = t.closest("#sugg li[data-i]");
    if (li) { pickSugg(+li.dataset.i); return; }
    if (t.closest("#mapbtn")) { ST.mapScroll = !ST.Q.map; go(hashQ({ ...ST.Q, map: !ST.Q.map, v: null })); return; }
    if (t.closest("#more")) { moreCards(); return; }
    if (t.closest("[data-retry]")) { ST.shards.clear(); route(); return; }
    const h = t.closest("[data-heart]");
    if (h) { e.preventDefault(); toggleSaved(+h.dataset.heart, h); }
  });
  V.addEventListener("focusin", (e) => { if (e.target.id === "where") openSugg(e.target.value); });
  V.addEventListener("input", (e) => {
    if (e.target.id === "where") openSugg(e.target.value);
    if (e.target.id === "budget") {
      const v = +e.target.value.replace(/[^0-9]/g, "") || null;
      $("#budgs").textContent = v && fx() ? S.budgetGs(F.gsR(v * fx())) : "";
      clearTimeout(ST.typing);
      ST.typing = setTimeout(() => go(hashQ({ ...ST.Q, p: v }), true), 700);
    }
  });
  V.addEventListener("change", (e) => { if (e.target.id === "sort") go(hashQ({ ...ST.Q, s: e.target.value })); });
  V.addEventListener("keydown", (e) => {
    if (e.target.id === "budget" && e.key === "Enter") { e.preventDefault(); clearTimeout(ST.typing); const v = +e.target.value.replace(/[^0-9]/g, "") || null; go(hashQ({ ...ST.Q, p: v }), true); return; }
    if (e.target.id !== "where") return;
    const n = ST.sugg.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if ($("#sugg").hidden) openSugg(e.target.value);
      ST.suggAt = Math.max(0, Math.min(n - 1, ST.suggAt + (e.key === "ArrowDown" ? 1 : -1)));
      $$("#sugg li").forEach((li, i) => { li.classList.toggle("on", i === ST.suggAt); li.setAttribute("aria-selected", String(i === ST.suggAt)); });
      e.target.setAttribute("aria-activedescendant", `sg-${ST.suggAt}`);
      $(`#sg-${ST.suggAt}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); if (n) pickSugg(Math.max(0, ST.suggAt)); }
    else if (e.key === "Escape") closeSugg();
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("#sugg, #where")) closeSugg(); });
}

// ---------------------------------------------------------------------------------------------
// The map: the view is the search while it is open (the pro app's behaviour), Leaflet from cdnjs, light tiles.
// ---------------------------------------------------------------------------------------------
const LEAFLET = {
  css: ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css", "sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw=="],
  js: ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js", "sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g=="],
  cluster: ["https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js", "sha512-OFs3W4DIZ5ZkrDhBFtsCP6JXtMEDGmhl0QPlmWYBJay40TT1n3gt2Xuw8Pf/iezgW9CdabjkNChRqozl/YADmg=="],
};
function addTag(tag, attrs) {
  return new Promise((res, rej) => {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    el.crossOrigin = "anonymous"; el.referrerPolicy = "no-referrer";
    el.onload = res; el.onerror = rej;
    document.head.appendChild(el);
  });
}
function leaflet() {
  if (window.L?.markerClusterGroup) return Promise.resolve();
  return ST.leafletP || (ST.leafletP = (async () => {
    const css = addTag("link", { rel: "stylesheet", href: LEAFLET.css[0], integrity: LEAFLET.css[1] });
    await addTag("script", { src: LEAFLET.js[0], integrity: LEAFLET.js[1] });
    await addTag("script", { src: LEAFLET.cluster[0], integrity: LEAFLET.cluster[1] });
    await css;
  })().catch((e) => { ST.leafletP = null; throw e; }));
}
const HOME_VIEW = [-25.3, -57.58, 12];
async function showMap(Q, pl) {
  $("#count").textContent = S.mapLoading;
  $("#cards").innerHTML = skeletonHtml(2);
  $("#more").hidden = true;
  if (!ST.zonas) await loadZonas().catch(() => null);
  try { await leaflet(); } catch { $("#count").textContent = S.mapFail; return; }
  if (ST.Q !== Q) return;
  if (!ST.map) {
    const m = L.map("mapbox", { zoomSnap: 1 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    ST.cluster = L.markerClusterGroup({ showCoverageOnHover: false, chunkedLoading: true, animate: false, maxClusterRadius: (z) => (z >= 15 ? 26 : 56),
      iconCreateFunction: (c) => { const n = c.getChildCount(), s = n < 10 ? 32 : n < 100 ? 38 : 46; return L.divIcon({ html: `<span>${F.n0(n)}</span>`, className: "mclu", iconSize: [s, s] }); } });
    m.addLayer(ST.cluster);
    m.on("zoomend", () => $("#mapbox").classList.toggle("z15", m.getZoom() >= 15));
    let t = null;
    m.on("moveend", () => { clearTimeout(t); t = setTimeout(() => mapMoved(), 150); });
    ST.map = m;
  }
  ST.map.invalidateSize();
  if (Q.v) ST.map.setView([Q.v[0], Q.v[1]], Q.v[2], { animate: false });
  else if (pl?.lat != null) ST.map.setView([pl.lat, pl.lon], 15, { animate: false });
  else if (pl?.bbox) ST.map.fitBounds(pl.bbox, { animate: false, padding: [8, 8] });
  else ST.map.setView([HOME_VIEW[0], HOME_VIEW[1]], HOME_VIEW[2], { animate: false });
  ST.mapKey = null;
  // Opened by the button on a phone, the map sits under the form: bring it into view.
  if (ST.mapScroll) { ST.mapScroll = false; $("#mapbox").scrollIntoView({ block: "start" }); }
  await mapMoved();
}
async function mapMoved() {
  const Q = ST.Q, m = ST.map;
  if (!Q?.map || !m || ST.view !== "buscar") return;
  const c = m.getCenter();
  Q.v = [c.lat, c.lng, m.getZoom()];
  history.replaceState(null, "", hashQ(Q));
  ST.lastSearch = hashQ(Q);
  const b = m.getBounds();
  // The card files of the city markets in view, and each department's file for the towns without a market of their own.
  const mkts = ST.zonas?.markets || [];
  const inView = (x) => !x?.bbox || b.intersects(L.latLngBounds(x.bbox));
  const depts = mkts.filter((x) => x.level === "dept" && x.bbox && inView(x)).map((x) => x.dk);
  const mks = depts.flatMap((dk) => mksOfDept(dk).filter((mk) => mk.startsWith("d:") || inView(mkts.find((x) => x.id === mk))));
  let set;
  try { set = await loadMks(mks, Q.o); } catch { $("#count").textContent = S.loadFail; return; }
  if (ST.Q !== Q) return;
  const { rows: pass, hidden } = filterRows(set, Q, { ignorePlace: true });
  setFoot(hidden);
  const placed = collapse(pass.filter((r) => r.pr <= 1 && r.y != null).sort(SORTS[Q.s]));
  const key = `${mks.join(",")}|${Q.o}|${Q.k.join(",")}|${Q.p}|${Q.b}`;
  if (key !== ST.mapKey) {
    ST.mapKey = key;
    ST.cluster.clearLayers();
    ST.cluster.addLayers(placed.map((r) => {
      const label = r.p != null ? (r.cu ? `Gs ${F.n0(r.p / 1e6)}M` : r.p >= 1e6 ? `USD ${F.n1(r.p / 1e6)}M` : `USD ${F.n0(r.p / 1e3)}k`) : "";
      const mk = L.marker([r.y / 1e5, r.x / 1e5], { icon: L.divIcon({ className: "mpin", html: `<span>${esc(label)}</span>`, iconSize: null }), keyboard: false, title: label });
      mk.on("click", () => go(`#/casa/${r.id}`));
      return mk;
    }));
  }
  const here = placed.filter((r) => b.contains([r.y / 1e5, r.x / 1e5]));
  const unplaced = pass.filter((r) => r.pr > 1).length;
  ST.list = { rows: here, n: here.length, full: true };
  $("#count").innerHTML = countHtml(S, F, { n: here.length, kinds: Q.k, op: Q.o, where: S.inMap }) + (unplaced ? `<small>${esc(S.mapNote(F.n0(unplaced)))}</small>` : "");
  $("#cards").innerHTML = here.length ? cardsHtml(here, 0, PAGE) : `<div class="empty"><p>${esc(S.emptyTitle)}</p></div>`;
  ST.shown = Math.min(PAGE, here.length);
  setMore();
}

// ---------------------------------------------------------------------------------------------
// Saved homes: localStorage only, with the card's own data so the list opens without the index.
// ---------------------------------------------------------------------------------------------
function cardData(r) {
  const { id, k, c, b, p, cu, su, a, ab, bd, tb, dl, ct, ph, cls, nw } = r;
  return { id, k, c, b, p, cu, su, a, ab, bd, tb, dl, ct, ph, cls, nw };
}
function findRow(id) {
  for (const src of [ST.list?.rows || [], ST.casa?.first?.sale?.rows || [], ST.casa?.first?.rent?.rows || [], ST.like || []]) {
    const r = src.find((x) => x.id === id);
    if (r) return r;
  }
  return null;
}
function toggleSaved(id, btn) {
  const i = ST.saved.findIndex((x) => x.id === id);
  if (i >= 0) ST.saved.splice(i, 1);
  else {
    const r = findRow(id) || (ST.detailCard?.id === id ? ST.detailCard : null);
    if (!r) return;
    ST.saved.unshift({ id, op: r.op || ST.Q?.o || "sale", r: cardData(r), at: new Date().toISOString().slice(0, 10) });
  }
  store.set("casa-saved", JSON.stringify(ST.saved.slice(0, 200)));
  const on = i < 0;
  for (const b of $$(`[data-heart="${id}"]`)) {
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? S.saved : S.save);
    const span = b.querySelector("span");
    if (span) span.textContent = on ? S.saved : S.save;
  }
  renderHeader();
  if (ST.view === "guardados" && !on) showGuardados();
}
function showGuardados() {
  const V = $("#v-guardados");
  document.title = `${S.savedH}: ${S.brand}`;
  const sv = ST.saved;
  V.innerHTML = `<h1>${esc(S.savedH)}</h1>` + (sv.length
    ? `<p class="muted">${esc(S.savedNote)}</p><div class="cards">${sv.map((x) => cardHtml(S, F, x.r, { op: x.op, saved: true })).join("")}</div>`
    : `<p>${esc(S.savedEmpty)}</p><p><a class="btn" href="${esc(ST.lastSearch)}">${esc(S.navSearch)}</a></p>`);
}

// ---------------------------------------------------------------------------------------------
// La casa.
// ---------------------------------------------------------------------------------------------
// The trust rule's reasons are pro sentences with figures; the consumer reads one plain reason. The portal's record comes
// first: its sentence also says "su propio punto en el mapa".
const WHY = [[/de sus avisos activos tiene precio/i, "portal"], [/propio punto en el mapa/i, "pointOwn"], [/está dentro del 1% al 99%/i, "priceOk"], [/cae fuera del 1% al 99%/i, "priceOff"],
  [/punto genérico/i, "noPoint"], [/no tiene coordenadas/i, "noCoords"], [/precio bajó/i, "cut"], [/Otro corredor publica el mismo/i, "otherBroker"],
  [/fotos con avisos de otro corredor/i, "samePhotos"], [/mismo corredor lo publica/i, "sameBroker"], [/fecha de entrega/i, "delivery"],
  [/cochera aparte/i, "garage"], [/menciona[^«]*«([^»]+)»/i, "text"], [/percentil 90/i, "old"], [/revisión humana/i, "pending"],
  [/Consulta enviada/i, "asked"], [/suelen durar más de/i, "sellerSlow"], [/retirad[oa]s? y vuelt[oa]s? a publicar/i, "relisted"],
  [/ya estuvo publicado en otro aviso/i, "republished"], [/volvió a aparecer/i, "reappeared"], [/edificio o loteo/i, "building"],
  [/hay menos de \d+ /i, "fewAsks"], [/no publica precio/i, "noPrice"], [/cierre reportado/i, "closed"]];
// pts < 0 on the portal's own record (the share of its ads with their own point) reads as a weakness, not a strength.
function plainWhy(text, pts = 0) {
  for (const [re, key] of WHY) {
    const m = re.exec(text || "");
    if (!m) continue;
    const k = key === "portal" && pts < 0 ? "portalWeak" : key;
    return typeof S.why[k] === "function" ? S.why[k](m[1]) : S.why[k];
  }
  return S.why.generic;
}
const BAND = { alta: 0, media: 1, baja: 2, "sin datos": 3 };
// One reason in plain words. For alta, the strongest point in its favour. For media and baja, the reason that costs the
// ad most among those that cost it points; with none, what the ad does not give (its own point on the map, a price, a
// size); with nothing missing either, that its points in favour fall short. Never a point in its favour as the reason
// for a doubt.
function trustOf(d) {
  const t = d.trust;
  if (!t) return { band: -1, why: null };
  const band = BAND[t.band] ?? -1;
  if (t.override) return { band, why: /ya no está disponible/.test(t.override) ? S.why.gone : S.why.confirmed };
  if (band === 3) return { band, why: S.why.closed };
  const rs = t.reasons || [];
  if (band === 0) {
    const top = [...rs].sort((a, b) => b[1] - a[1])[0];
    return { band, why: top ? plainWhy(top[0], top[1]) : S.why.generic };
  }
  const worst = rs.filter((x) => x[1] < 0).sort((a, b) => a[1] - b[1])[0];
  if (worst) return { band, why: plainWhy(worst[0], worst[1]) };
  const miss = [];
  if (!["exact", "street"].includes(d.point?.prec)) miss.push(S.why.missingPart.point);
  if (d.ask?.p == null) miss.push(S.why.missingPart.price);
  if (!(d.facts?.a >= MIN_M2)) miss.push(S.why.missingPart.area);
  return { band, why: miss.length ? S.why.missing(miss) : S.why.short };
}
// "¿Cómo lo sabemos?" lists the rule's own sentences in Spanish; in English, each reason in its plain words.
const cap1 = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
function trustHow(t) {
  if (S.lang !== "en") return (t.override ? `${t.override}. ` : "") + t.reasons.map((x) => x[0]).join(" ");
  const first = t.override ? [cap1(/ya no está disponible/.test(t.override) ? S.why.gone : S.why.confirmed)] : [];
  return [...new Set([...first, ...t.reasons.map((x) => cap1(plainWhy(x[0], x[1])))])].join(" ");
}
function noEstWhy(t) {
  const s = String(t || "");
  const a = /^([\d.]+) m2 /.exec(s);
  if (/no es plausible/.test(s)) return S.noEst.area(a ? `${a[1]} m2` : "m2");
  if (/no le gana/.test(s)) return S.noEst.beat;
  if (/para entrenar|de prueba|no hay cierres/.test(s)) return S.noEst.few;
  if (/no cubre/.test(s)) return S.noEst.kind;
  if (/departamento que declara/.test(s)) return S.noEst.off;
  if (/superficie/.test(s)) return S.noEst.noArea;
  return S.noEst.generic;
}
function noOfferWhy(t) {
  const s = String(t || "");
  if (/confianza en el aviso es baja/.test(s)) return S.noOffer.low;
  if (/cierre reportado/.test(s)) return S.noOffer.closed;
  if (/no publica un precio|no leímos el precio/.test(s)) return S.noOffer.noPrice;
  if (/no es plausible para/.test(s)) return S.noOffer.area;
  if (/plausibilidad/.test(s)) return S.noOffer.plaus;
  if (/menos de \d+ cierres/.test(s)) return S.noOffer.few;
  if (/por encima/.test(s)) return S.noOffer.above;
  return S.noOffer.generic;
}
// "casas en venta en Asunción" names its place after the last " en ".
const placeIn = (scope) => { const m = /.* en (.+)$/.exec(scope || ""); return m ? m[1] : scope; };
const moneyR = (x, cur) => (cur === "PYG" ? F.gsR(x) : F.usdR(x));
function cuota(price, downPct, ratePct, years) {
  const P = price * (1 - downPct / 100), n = Math.round(years * 12), r = ratePct / 1200;
  if (!(P > 0) || !(n > 0)) return null;
  return { loan: P, pay: r > 0 ? (P * r) / (1 - (1 + r) ** -n) : P / n };
}
const kmText = (m) => `${F.n1(m / 1000)} km`;
async function showCasa(id) {
  const V = $("#v-casa");
  window.scrollTo(0, 0);
  V.innerHTML = `<div class="otop"><a href="${esc(ST.lastSearch)}">&lsaquo; ${esc(S.back)}</a></div><div class="gal"><figure class="ph"></figure></div>${skeletonHtml(0)}<p class="muted">${esc(S.loading)}</p>`;
  let d;
  const pre = window.__casaDetail;
  window.__casaDetail = null;
  try { d = pre && pre.id === String(id) ? await pre.p : await getJSON(`../app/l/${encodeURIComponent(id)}.json`); }
  catch (e) {
    if (parseHash().id !== id) return;
    V.innerHTML = `<div class="otop"><a href="${esc(ST.lastSearch)}">&lsaquo; ${esc(S.back)}</a></div>` + (e.status === 404
      ? `<h1>${esc(S.notFound)}</h1><p>${esc(S.notFoundBody(F.date(ST.casa.data_at)))}</p>`
      : `<h1>${esc(S.loadHomeFail)}</h1><p><button class="btn" type="button" id="cretry">${esc(S.retry)}</button></p>`);
    $("#cretry")?.addEventListener("click", () => showCasa(id));
    return;
  }
  if (parseHash().id !== id) return;
  ST.detail = d;
  const kindW = S.kindChip[d.kind] || S.whatMix(true), where = d.place.barrio || d.place.city || d.place.dept;
  const op = d.op, per = op === "rent" ? (S.lang === "en" ? " a month" : " por mes") : "";
  const a = d.ask, cur = a.cur === "PYG" ? "PYG" : "USD";
  const r = { id: d.id, k: d.kind, c: d.place.city, b: d.place.barrio, p: a.p, cu: cur === "PYG" ? 1 : 0, su: a.site, a: d.facts.a, ab: d.facts.asrc, bd: d.facts.beds,
    tb: BAND[d.trust?.band] ?? -1, dl: a.days, ct: a.cuts.length, ph: d.photos?.[0] || null, nw: null, op };
  const e = d.est, cmp = d.cmp;
  r.cls = cmp?.pct != null ? (cmp.inside ? 1 : cmp.usd > e.hi ? 2 : 3) : 0;
  ST.detailCard = r;
  const portal = SRC[a.src] || a.src;
  document.title = `${kindW}, ${F.priceMain(r) || ""}, ${where}: ${S.brand}`;
  const saved = savedIds().has(r.id);
  // Gallery: up to four photos, swipe. The first is the screen's largest paint and loads alone, in the card's rendition
  // (in cache when the reader came from the list); the second, eager, starts the moment it is in; the third and fourth sit
  // inside the scroller, where lazy loading would fetch them at once, so they start then too.
  const photos = d.photos || [];
  const gal = photos.length
    ? `<div class="gal" id="gal"><ul>${photos.map((u, i) => `<li><figure class="ph"><img ${i === 0 ? "src" : "data-src"}="${esc(photoSrc(u, i === 0 ? "card" : "big"))}" data-orig="${esc(u)}" alt="${esc(S.gallery(i + 1, photos.length))}" width="${i === 0 ? 600 : 720}" height="${i === 0 ? 450 : 540}" loading="${i < 2 ? "eager" : "lazy"}"${i === 0 ? ' fetchpriority="high"' : ""} decoding="${i === 0 ? "auto" : "async"}" referrerpolicy="no-referrer" onerror="casaImgErr(this)"><span class="phx" aria-hidden="true"><i></i>${esc(S.photoMissing)}</span></figure></li>`).join("")}</ul>` +
      (photos.length > 1 ? `<div class="dots" aria-hidden="true">${photos.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : "") + `</div><p class="gcap">${esc(S.photoCredit(portal))}</p>`
    : `<div class="gal"><figure class="ph noimg"><span class="phx"><i></i>${esc(S.photoMissing)}</span></figure></div><p class="gcap">${esc(S.galleryNone)}</p>`;
  const main = F.priceMain(r), other = F.priceOther(r);
  const facts = [factsOf(S, F, r), where].filter(Boolean).join(", ");
  const tr = trustOf(d);
  const topTrust = tr.band === 0 ? `<span class="ok">${esc(S.trustHigh)}</span>` : tr.band === 2 ? `<span class="doubt">${esc(S.trustLow)}</span>` : tr.band === 1 ? `<span>${esc(S.trustMid)}</span>` : "";
  const line = lineOf(S, r.cls);
  // Each counted price cut of the advert, newest first, with its date and amounts from the history rows of the detail
  // file (the advert's own figures, exact); a cut whose row the file no longer carries keeps its date and size.
  const amt = (x, c) => `${c === "PYG" ? "Gs" : "USD"} ${F.n0(x)}`;
  const repName = d.ads?.[0]?.[1];
  const cutLines = [...(a.cuts || [])].reverse().map(([day, pct]) => {
    const hist = d.hist || [];
    const i = hist.findIndex((h) => h[0] === day && h[1] === "Recorte" && h[6] === repName && h[4] === pct);
    const to = i >= 0 && hist[i][2] != null ? amt(hist[i][2], hist[i][3] || cur) : null;
    const prev = i >= 0 ? hist.slice(i + 1).find((h) => h[6] === repName && h[2] != null) : null;
    return prev && to ? S.cutFromTo(F.date(day), amt(prev[2], prev[3] || cur), to) : to ? S.cutTo(F.date(day), F.pctR(pct), to) : S.cutPct(F.date(day), F.pctR(pct));
  });
  // Lo que importa: the estimate with its error, in the advert's currency (USD beside a guaraní figure, converted at the
  // estimate's own rate), the caveat of a price below the range, the zone's negotiation, the trust reason.
  // No estimate prints without its measured error (spec section 2): an estimate whose location mode has none abstains here.
  const estFx = ST.casa.est_fx || fx();
  const errS = e.err != null ? `${Math.round(e.err)}%` : null;
  const s1 = e.e != null && errS
    ? (cur === "PYG" && estFx ? S.expect(moneyR(e.e * estFx, "PYG"), F.usdR(e.e), errS) : S.expect(moneyR(e.e, "USD"), null, errS))
    : `${S.expectNone(d.kind)} ${e.e != null ? S.noEst.noErr : noEstWhy(e.none)}`;
  const below = r.cls === 3 ? S.belowNote : null;
  const ng = d.neg;
  const kp = S.kindPl[d.kind] || S.whatMix(false);
  const s2 = ng ? S.neg(placeIn(ng.scope), /^inmuebles/.test(ng.scope) ? S.whatMix(false) : kp, F.n0(Math.round((ng.at / ng.n) * 100)), ng.bp50 != null ? F.pctR(ng.bp50) : null) : S.negNone;
  const s3 = tr.band >= 0 ? S.trustSentence[tr.band](tr.why) : S.trustNone;
  // Qué ofrecer.
  const o = d.offer;
  let offer;
  if (o.lo != null) {
    const lo = moneyR(o.lo, o.cur) + per, hi = moneyR(o.hi, o.cur) + per;
    offer = `<p class="lead1">${esc(lo === hi ? S.offerOne(lo) : S.offer(lo, hi))}</p><p class="muted">${esc(S.offerRule)}</p>`;
  } else offer = `<p>${esc(S.offerNone(d.kind))} ${esc(noOfferWhy(o.none))}</p>`;
  // Tu cuota: plain arithmetic on the reader's own numbers.
  const usd = a.usd ?? a.site ?? null;
  const calc = op === "sale" ? `<section class="sec" id="cuota"><h2>${esc(S.cuotaH)}</h2><div class="calc">` +
    `<label><span>${esc(S.cuotaPrice)}</span><input class="inp" id="c-price" inputmode="numeric" value="${usd ? F.n0(Math.round(usd)) : ""}"></label>` +
    `<label><span>${esc(S.cuotaDown)}</span><input class="inp" id="c-down" inputmode="decimal" value="20"></label>` +
    `<label><span>${esc(S.cuotaRate)}<small>${esc(S.cuotaRateNote)}</small></span><input class="inp" id="c-rate" inputmode="decimal" value="10"></label>` +
    `<label><span>${esc(S.cuotaYears)}</span><input class="inp" id="c-years" inputmode="numeric" value="20"></label></div>` +
    `<p class="cuota" id="c-out" aria-live="polite"></p><p class="muted" id="c-loan"></p><p class="muted">${esc(S.cuotaNote)}</p>` +
    `<button class="btn" type="button" data-lead="mortgage">${esc(S.cuotaBtn)}</button></section>` : "";
  // Preguntale al vendedor.
  const qs = [S.askQ.still(portal), a.cuts.length ? S.askQ.cut : S.askQ.since, S.askQ.address, S.askQ.visit];
  const own = d.ads.find((x) => x[2]);
  const seeAd = own ? `<a class="btn pri" href="${esc(own[2])}" target="_blank" rel="nofollow noopener">${esc(S.seeAd(SRC[own[0]] || own[0]))}</a>` : `<span class="btn" aria-disabled="true">${esc(S.seeAdNone)}</span>`;
  // Ventas cerca.
  const comps = d.comps.rows || [], meta = ST.zonas?.comps || { meters: 2000, months: 18 };
  let near;
  if (comps.length) {
    near = `<p>${esc(S.near(F.n0(comps.length), meta.months))}</p><div class="tbl"><table><thead><tr>${S.nearCols.map((c, i) => `<th${i === 1 || i === 3 ? ' class="n"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
      comps.map((c) => `<tr><td>${esc(F.date(c[0]))}</td><td class="n">${esc(c[2] ? F.gsR(c[1]) : F.usdR(c[1]))}${c[5] & 1 ? `<br><small class="muted">${esc(S.nearAt)}</small>` : ""}</td>` +
        `<td>${c[6] ? esc(c[7] === 1 && d.kind !== "terreno" ? S.m2Land(F.n0(c[6])) : S.m2(F.n0(c[6]))) : "-"}</td><td class="n">${esc(kmText(c[9]))}</td></tr>`).join("") + `</tbody></table></div>`;
  } else near = `<p>${esc(["pin", "none", "off"].includes(d.comps.why) ? S.nearNoPoint : S.nearNone(kmText(meta.meters), meta.months))}</p>`;
  // ¿Cómo lo sabemos? (the pro labels translated in English: the segment, the band, the reasons in plain words)
  const how = [S.howAsk(portal, F.date(ST.casa.data_at))];
  if (e.e != null && e.err != null) how.push(S.howEst(`USD ${F.n0(e.e)}`, `USD ${F.n0(e.lo)}`, `USD ${F.n0(e.hi)}`, `${F.n1(e.err)}%`, F.n0(e.n ?? 0), S.seg(e.seg)));
  else how.push(S.howEstNone(e.e != null ? S.noEst.noErr : S.lang === "en" ? noEstWhy(e.none) : e.none || ""));
  if (r.cls) how.push(S.howLine(r.cls));
  if (ng) how.push(S.howNeg(F.n0(ng.n), S.seg(ng.scope), F.date(ng.first), F.date(ng.last), `${F.n1((ng.at / ng.n) * 100)}%`, ng.bp50 != null ? `${F.n1(ng.bp50)}%` : null));
  if (o.lo != null) how.push(S.howOffer(F.n0(o.n), S.seg(o.scope), o.pl));
  if (d.trust) how.push(S.howTrust(S.band[d.trust.band] || d.trust.band, d.trust.score, trustHow(d.trust)));
  how.push(S.howNear(`${F.n0(meta.meters)} m`, meta.months), S.howPhotos, S.howNotAgent);
  const zoneId = d.place.barrio ? `${d.place.mk}|${d.place.barrio}` : d.place.mk;
  const agoLine = [F.ago(a.days), a.cuts.length ? S.cuts(a.cuts.length) : null].filter(Boolean).join(" · ");
  // From 900 px La casa is two columns: the photos and the facts on the left, what matters and what to offer on the right.
  V.innerHTML = `<div class="otop"><a href="${esc(ST.lastSearch)}">&lsaquo; ${esc(S.back)}</a><span>` +
    `<button class="btn" type="button" data-heart="${r.id}" aria-pressed="${saved}" aria-label="${esc(saved ? S.saved : S.save)}"><span>${esc(saved ? S.saved : S.save)}</span></button> ` +
    `<button class="btn" type="button" id="share">${esc(S.share)}</button></span></div><div class="cgrid"><div class="cl1">` + gal +
    `<div class="head"><p class="pr">${main ? esc(main + per) : esc(S.noPrice)}</p>${other ? `<p class="po">${esc(other + per)}</p>` : ""}<p class="fa">${esc(facts)}</p>` +
    `<div class="lines">${line ? `<p>${esc(line)}</p>` : ""}${topTrust ? `<p>${topTrust}</p>` : ""}${agoLine ? `<p class="muted">${esc(agoLine)}</p>` : ""}` +
    `${cutLines.length ? `<ul class="cutl">${cutLines.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></div></div><div class="cl2">` +
    `<section class="sec"><h2>${esc(S.matters)}</h2><p class="lead1">${esc(s1)}</p>${below ? `<p>${esc(below)}</p>` : ""}<p>${esc(s2)}</p><p>${esc(s3)}</p></section>` +
    `<section class="sec"><h2>${esc(S.offerH)}</h2>${offer}</section>` + reportSec(S.reportIntro, listingRefOf(d.id)) + `</div></div>` + calc +
    `<section class="sec"><h2>${esc(S.askH)}</h2><p class="muted">${esc(S.askIntro)}</p><p class="qs" id="qs">${esc(qs.join("\n"))}</p>` +
    `<button class="btn" type="button" id="copyq">${esc(S.copy)}</button></section>` +
    `<div class="acts">${seeAd}<button class="btn" type="button" data-lead="visit">${esc(S.wantVisit)}</button><button class="btn" type="button" id="share2">${esc(S.share)}</button></div>` +
    `<section class="sec"><h2>${esc(S.nearH)}</h2>${near}</section>` +
    `<section class="sec like" id="like"><h2>${esc(S.likeH)}</h2><div class="cards" id="likes">${skeletonHtml(1)}</div></section>` +
    (ST.zonas?.zones?.[zoneId] || !ST.zonas ? `<p><a class="btn" href="#/barrio?z=${encodeURIComponent(zoneId)}&k=${esc(d.kind)}">${esc(S.zoneBtn(where))}</a></p>` : "") +
    `<details class="how"><summary>${esc(S.howH)}</summary><ul>${how.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` +
    `<p><a class="tap" href="../app/#/l/${esc(d.id)}">${esc(S.howPro)}</a></p></details>`;
  performance.mark("casa:home-drawn");
  wireCasa(d, r, qs);
  // Parecidas needs its department's whole index (up to 440 KB): it loads when the reader comes near it, not with the
  // photos.
  const box = $("#like");
  if (!("IntersectionObserver" in window)) likes(d, r);
  else {
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); likes(d, r); } }, { rootMargin: "400px" });
    io.observe(box);
  }
}
function wireCasa(d, r, qs) {
  const V = $("#v-casa");
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: document.title, url: location.href }); return; } await navigator.clipboard.writeText(location.href); toast(S.shared); }
    catch { /* the reader closed the share sheet */ }
  };
  $("#share", V)?.addEventListener("click", share);
  $("#share2", V)?.addEventListener("click", share);
  $("#copyq", V)?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(qs.join("\n")); toast(S.copied); }
    catch { const sel = getSelection(), rg = document.createRange(); rg.selectNodeContents($("#qs")); sel.removeAllRanges(); sel.addRange(rg); toast(S.copyFail); }
  });
  V.onclick = (e) => {
    const h = e.target.closest("[data-heart]");
    if (h) { toggleSaved(+h.dataset.heart, h); return; }
    const l = e.target.closest("[data-lead]");
    if (l) openLead(l.dataset.lead, leadCtx(d, r, l.dataset.lead));
  };
  const upd = () => {
    // The price is whole dollars in either language's grouping ("50.000", "50,000"); a rate may carry a decimal comma.
    const whole = (id) => +String($(id)?.value || "").replace(/[^0-9]/g, "");
    const dec = (id) => parseFloat(String($(id)?.value || "").replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
    const c = cuota(whole("#c-price"), dec("#c-down"), dec("#c-rate"), dec("#c-years"));
    const out = $("#c-out"), loan = $("#c-loan");
    if (!out) return;
    out.textContent = c && fx() ? S.cuotaOut(F.gsPay(c.pay * fx()), F.usdR(c.pay)) : "";
    loan.textContent = c ? S.cuotaLoan(F.usdR(c.loan)) : "";
    ST.cuota = c;
  };
  $("#cuota")?.addEventListener("input", upd);
  upd();
  const gal = $("#gal ul", V);
  const rest = () => $$("#gal img[data-src]", V).forEach((im) => { im.src = im.dataset.src; im.removeAttribute("data-src"); });
  const im0 = $("#gal img", V);
  if (im0 && !im0.complete) { im0.addEventListener("load", rest, { once: true }); im0.addEventListener("error", rest, { once: true }); setTimeout(rest, 6000); }
  else rest();
  if (gal) gal.addEventListener("scroll", () => {
    const i = Math.round(gal.scrollLeft / Math.max(1, gal.clientWidth));
    $$("#gal .dots i").forEach((x, k) => x.classList.toggle("on", k === i));
  }, { passive: true });
}
// Parecidas: three homes of the same kind in the same barrio (else the city), within a quarter of the price, a bedroom of
// the home's count and 30% of its size where it gives them, newest first.
async function likes(d, r) {
  const box = $("#likes");
  try {
    const { rows } = await loadMk(d.place.mk, d.op);
    if (ST.detail !== d) return;
    const usd = d.ask.usd ?? d.ask.site;
    const p = r.p != null ? Math.round(r.p) : null;
    // A unit with this home's own price, size and bedrooms is almost surely this home under another ad that entity
    // resolution has not joined yet: it is not a similar home.
    const twin = (x) => p != null && x.p === p && x.cu === r.cu && x.a === r.a && x.bd === r.bd;
    const bedsOk = (x) => d.kind === "terreno" || !(r.bd > 0) || (x.bd > 0 && Math.abs(x.bd - r.bd) <= 1);
    const sizeOk = (x) => !(r.a >= MIN_M2) || (x.a >= r.a * 0.7 && x.a <= r.a * 1.3);
    const ok = (x) => x.id !== d.id && !twin(x) && x.k === d.kind && x.tb >= 0 && x.tb <= 2 && x.usd != null && usd && x.usd >= usd * 0.75 && x.usd <= usd * 1.25 &&
      bedsOk(x) && sizeOk(x);
    const inB = rows.filter((x) => ok(x) && d.place.barrio && x.b === d.place.barrio).sort(SORTS.new);
    const rest = rows.filter((x) => ok(x) && !inB.includes(x)).sort(SORTS.new);
    const pick = collapse([...inB, ...rest]).slice(0, 3);
    ST.like = pick;
    const sv = savedIds();
    box.innerHTML = pick.length ? pick.map((x) => cardHtml(S, F, x, { op: d.op, saved: sv.has(x.id) })).join("") : `<p>${esc(S.likeNone)}</p>`;
  } catch { box.innerHTML = `<p>${esc(S.likeNone)}</p>`; }
}

// ---------------------------------------------------------------------------------------------
// El barrio: #/barrio?z=<zone>&k=<kind>
// ---------------------------------------------------------------------------------------------
const ZK = KINDS;
async function showBarrio(qs) {
  const V = $("#v-barrio");
  const u = new URLSearchParams(qs || "");
  V.innerHTML = `<p class="muted">${esc(S.loading)}</p>`;
  try { await loadZonas(); } catch { V.innerHTML = `<p>${esc(S.loadFail)}</p>`; return; }
  const Z = ST.zonas, zid = u.get("z") || "d:asuncion", z = Z.zones[zid];
  const backA = `<div class="otop"><a href="${esc(ST.barrioBack || ST.lastSearch)}">&lsaquo; ${esc(S.back)}</a></div>`;
  // A zone id that names no place: the cities and departments it can be.
  if (!z) {
    document.title = S.brand;
    const ms = Z.markets.filter((m) => Z.zones[m.id]);
    V.innerHTML = `${backA}<h1>${esc(S.zoneEmpty)}</h1><p>${esc(S.zonePick)}</p><ul class="mlist">` +
      ms.map((m) => `<li><a href="#/barrio?z=${encodeURIComponent(m.id)}">${esc(m.name)}</a></li>`).join("") + `</ul>`;
    return;
  }
  const kinds = ZK.filter((k) => z.k[k]);
  const k = kinds.includes(u.get("k")) ? u.get("k") : kinds[0];
  const X = z.k[k] || {};
  document.title = `${z.name}: ${S.brand}`;
  const placeId = z.lvl === "b" ? `b:${zid}` : `m:${zid}`;
  const parent = z.lvl === "b" ? z.mk : z.lvl === "c" ? `d:${slug(Z.markets.find((m) => m.id === zid)?.dk || "")}` : null;
  const parentName = parent ? Z.markets.find((m) => m.id === parent)?.name : null;
  const lines = [];
  const kOne = S.kindOneCap[k], kp = S.kindPl[k];
  if (X.s?.length === 4) lines.push(S.zoneAsk(kOne, z.name, F.usdR(X.s[2]), F.usdR(X.s[1]), F.usdR(X.s[3])));
  else lines.push(S.zoneAskThin(z.name, F.n0(X.s?.[0] || 0)));
  if (X.r?.length === 2) lines.push(S.zoneRent(S.kindOne[k], F.usdR(X.r[1])));
  if (X.d?.length === 2) lines.push(S.zoneDays(k, F.dur(X.d[1])));
  // The trust line, out of every 100 ads: trusted, doubtful, and what the rest (media) lack most, their own point on the
  // map. X.t: [ads, alta, baja, media, media without their own point].
  if (X.t?.length >= 5 && X.t[0] >= Z.min.median) {
    const per = (v) => Math.round((v / X.t[0]) * 100);
    const x = per(X.t[1]), y = per(X.t[2]), rest = Math.max(0, 100 - x - y);
    lines.push(S.zoneTrust(x, y, rest, Math.min(rest, per(X.t[4]))));
  }
  const negMk = z.lvl === "b" ? z.mk : zid;
  const ng = Z.negs[negMk]?.[k] || Z.negs[parent]?.[k];
  const negWhere = ng?.from === "py" ? "Paraguay" : ng?.from ? Z.markets.find((m) => m.id === ng.from)?.name : Z.markets.find((m) => m.id === (Z.negs[negMk]?.[k] ? negMk : parent))?.name;
  if (ng) lines.push(S.zoneNeg(negWhere, k, F.n0(Math.round((ng.at / ng.n) * 100))));
  const tr = Z.transfers[z.lvl === "b" ? z.mk : zid];
  if (tr) lines.push(S.zoneTransfers(Z.markets.find((m) => m.id === (z.lvl === "b" ? z.mk : zid))?.name || z.name, F.n0(tr.n), F.monthYear(tr.month)));
  const how = [S.zoneHow(F.n0(X.s?.[0] || 0), F.date(Z.today))];
  if (X.t?.length >= 5 && X.t[0] >= Z.min.median) how.push(S.zoneHowTrust(F.n0(X.t[0])));
  if (ng) how.push(S.zoneHowNeg(F.n0(ng.n), `${kp} ${S.lang === "en" ? "in" : "en"} ${negWhere}`));
  if (tr) how.push(S.zoneHowTr);
  V.innerHTML = `${backA}<h1>${esc(z.name)}</h1>` +
    `${z.lvl === "b" ? `<p class="muted">${esc(z.city || z.dept)}</p>` : z.lvl === "c" ? `<p class="muted">${esc(z.dept)}</p>` : ""}` +
    `<div class="ktabs" role="group">${kinds.map((x) => `<a class="chip" href="#/barrio?z=${encodeURIComponent(zid)}&k=${x}" aria-pressed="${x === k}" role="button">${esc(S.kindChip[x])}</a>`).join("")}</div>` +
    `<div class="zl">${lines.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` +
    `<p><a class="btn pri" href="${esc(hashQ({ ...parseQ(""), q: placeId, k: [k] }))}">${esc(S.zoneSee(z.name))}</a></p>` +
    (parent && parentName ? `<p><a class="btn" href="#/barrio?z=${encodeURIComponent(parent)}&k=${k}">${esc(S.zoneParent(parentName))}</a></p>` : "") +
    `<details class="how"><summary>${esc(S.howH)}</summary><ul>${how.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
}

// ---------------------------------------------------------------------------------------------
// Mi casa: #/vender?z=<zone>&k=<kind>&m2=<n>&b=<bedrooms>
// ---------------------------------------------------------------------------------------------
function valChain(zid) {
  const Z = ST.zonas, out = [zid];
  if (zid.includes("|")) out.push(zid.split("|")[0]);
  const mk = out.at(-1), m = Z.markets.find((x) => x.id === mk);
  if (m?.level === "city" && m.parent) out.push(m.parent);
  return [...new Set(out)];
}
const zoneName = (zid) => ST.zonas.zones[zid]?.name || ST.zonas.markets.find((m) => m.id === zid)?.name || zid.split("|").pop();
async function showVender(qs) {
  const V = $("#v-vender");
  const u = new URLSearchParams(qs || "");
  document.title = `${S.sellH}: ${S.brand}`;
  V.innerHTML = `<h1>${esc(S.sellH)}</h1><p class="muted">${esc(S.loading)}</p>`;
  try { await loadZonas(); } catch { V.innerHTML = `<h1>${esc(S.sellH)}</h1><p>${esc(S.loadFail)}</p>`; return; }
  const zid = u.get("z") || "", k = KINDS.includes(u.get("k")) ? u.get("k") : "casa", m2 = +u.get("m2") || null, beds = +u.get("b") || null;
  const zLabel = zid ? (zid.includes("|") ? `${zid.split("|")[1]}, ${ST.zonas.markets.find((m) => m.id === zid.split("|")[0])?.name || ""}` : zoneName(zid)) : "";
  V.innerHTML = `<h1>${esc(S.sellH)}</h1><p>${esc(S.sellIntro)}</p><form id="sellf" novalidate>` +
    `<div class="fld"><label class="lab" for="swhere">${esc(S.sellWhere)}</label><div class="inpw"><input class="inp" id="swhere" type="search" autocomplete="off" value="${esc(zLabel)}" data-z="${esc(zid)}" role="combobox" aria-expanded="false" aria-controls="ssugg" aria-autocomplete="list"></div><ul class="sugg" id="ssugg" role="listbox" hidden></ul></div>` +
    `<div class="fld"><span class="lab">${esc(S.sellKind)}</span><div class="chips" role="group">${KINDS.map((x) => `<button class="chip" type="button" data-sk="${x}" aria-pressed="${x === k}">${esc(S.kindChip[x])}</button>`).join("")}</div></div>` +
    `<div class="row2"><div class="fld"><label class="lab" for="sm2">${esc(k === "terreno" ? S.sellM2Land : S.sellM2)}</label><input class="inp" id="sm2" inputmode="numeric" value="${m2 || ""}"></div>` +
    `<div class="fld"${k === "terreno" ? " hidden" : ""}><label class="lab" for="sbeds">${esc(S.sellBeds)}</label><select class="inp" id="sbeds">${["", 1, 2, 3, 4, 5].map((b) => `<option value="${b}"${b === beds ? " selected" : ""}>${b === 5 ? "5+" : b}</option>`).join("")}</select></div></div>` +
    `<p class="msg bad" id="smsg" aria-live="polite"></p><button class="btn pri wide" type="submit">${esc(S.sellGo)}</button></form><div id="sres"></div>`;
  wireVender(k);
  if (zid && m2) renderVal(zid, k, m2, beds);
}
function wireVender(k0) {
  const V = $("#v-vender");
  let kind = k0, picks = [], at = -1;
  const w = $("#swhere"), ul = $("#ssugg");
  const open = () => {
    picks = suggest(w.value).filter((x) => x.id);
    at = w.value.trim() ? 0 : -1;
    ul.innerHTML = picks.map((x, i) => `<li role="option" data-i="${i}" class="${i === at ? "on" : ""}"><span>${esc(suggLabel(x))}</span><small>${esc(x.s || "")}</small></li>`).join("") || `<li aria-disabled="true">${esc(S.noPlace)}</li>`;
    ul.hidden = false; w.setAttribute("aria-expanded", "true");
  };
  // A place id ("m:<market>" or "b:<market>|<barrio>") less its prefix is its zone id in casa-zonas.json.
  const choose = (i) => { const x = picks[i]; if (!x) return; w.value = x.s ? `${x.t}, ${x.s}` : x.t; w.dataset.z = x.id.slice(2); ul.hidden = true; w.setAttribute("aria-expanded", "false"); };
  w.addEventListener("focus", open);
  w.addEventListener("input", () => { w.dataset.z = ""; open(); });
  w.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); at = Math.max(0, Math.min(picks.length - 1, at + (e.key === "ArrowDown" ? 1 : -1))); $$("#ssugg li").forEach((li, i) => li.classList.toggle("on", i === at)); }
    else if (e.key === "Enter" && !ul.hidden) { e.preventDefault(); choose(Math.max(0, at)); }
    else if (e.key === "Escape") ul.hidden = true;
  });
  ul.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) choose(+li.dataset.i); });
  V.onclick = (e) => {
    const c = e.target.closest("[data-sk]");
    if (c) {
      kind = c.dataset.sk;
      $$("[data-sk]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sk === kind)));
      $("label[for=sm2]").textContent = kind === "terreno" ? S.sellM2Land : S.sellM2;
      $("#sbeds").closest(".fld").hidden = kind === "terreno";
    }
    const l = e.target.closest("[data-lead]");
    if (l) {
      if (l.dataset.lead === "report") openLead("report", sellerReportCtx());
      else openLead("sell", ST.sellCtx || {});
    }
    if (!e.target.closest("#ssugg, #swhere")) ul.hidden = true;
  };
  $("#sellf").addEventListener("submit", (e) => {
    e.preventDefault();
    const z = w.dataset.z, m2 = +String($("#sm2").value).replace(/[^0-9]/g, "");
    if (!z) { $("#smsg").textContent = S.sellNeedWhere; w.focus(); return; }
    if (!(m2 > 0)) { $("#smsg").textContent = S.sellNeedM2; $("#sm2").focus(); return; }
    $("#smsg").textContent = "";
    const b = +$("#sbeds").value || null;
    history.replaceState(null, "", `#/vender?z=${encodeURIComponent(z)}&k=${kind}&m2=${m2}${b && kind !== "terreno" ? `&b=${b}` : ""}`);
    renderVal(z, kind, m2, kind === "terreno" ? null : b);
  });
}
// The number is what homes like it closed at (the per-m2 rule with its own measured error), never what is asked. A wider
// place's closes stand in for the reader's own only where what is asked per m2 in the two places differs by less than the
// rule's own error; otherwise its figure would say something El barrio contradicts, and the screen says what the reader's
// place asks instead, as an ask, and that there are not enough sales for a closing figure.
function renderVal(zid, k, m2, beds) {
  const Z = ST.zonas, box = $("#sres");
  const chain = valChain(zid);
  const at = (sid) => Z.val[sid]?.[k];
  const hasClose = (sid) => at(sid)?.c != null && at(sid).err != null;
  const from = zoneName(chain[0]), here = at(chain[0]);
  ST.sellCtx = { zone: zid, kind: k, m2, beds, where: from };
  const how = [];
  let used = hasClose(chain[0]) ? chain[0] : null, note = null;
  if (!used) {
    const alt = chain.slice(1).find(hasClose);
    if (alt && here?.a != null && at(alt).a != null) {
      const d = Math.abs(here.a / at(alt).a - 1) * 100, err = at(alt).err;
      const args = [from, zoneName(alt), `USD ${F.n0(here.a)}`, `USD ${F.n0(at(alt).a)}`, `${F.n1(d)}%`, `${F.n1(err)}%`];
      if (d <= err) { used = alt; note = S.sellFallback(from, zoneName(alt)); how.push(S.sellHowFallback(...args)); }
      else how.push(S.sellHowNoFallback(...args));
    }
  }
  const zoneOf = used || chain[0];
  const mk = zoneOf.includes("|") ? zoneOf.split("|")[0] : zoneOf;
  let body;
  if (used) {
    const v = at(used), to = zoneName(used), est = m2 * v.c, ask = v.a != null ? m2 * v.a : null;
    body = `${note ? `<p class="fb">${esc(note)}</p>` : ""}<p class="big">${esc(S.sellOut(k, F.usdR(est), `${Math.round(v.err)}%`))}</p>` +
      (ask != null ? `<p>${esc(S.sellAsks(to, k, F.usdR(ask)))}</p>` : "");
    how.unshift(S.sellHow(F.n0(v.n), k, to, F.date(v.first), F.date(v.last), `USD ${F.n0(v.c)}`, F.n0(v.ne), `${F.n1(v.err)}%`));
    if (v.a != null) how.push(S.sellHowAsk(F.n0(v.na), k, to, `USD ${F.n0(v.a)}`));
    ST.sellCtx = { ...ST.sellCtx, segment: used, est: Math.round(est), err: v.err, ask: ask != null ? Math.round(ask) : null };
  } else if (here?.a != null) {
    const ask = m2 * here.a;
    body = `<p class="big">${esc(S.sellAskOnly(from, k, F.usdR(ask)))}</p>`;
    how.push(S.sellHowAsk(F.n0(here.na), k, from, `USD ${F.n0(here.a)}`));
    ST.sellCtx = { ...ST.sellCtx, segment: chain[0], est: null, ask: Math.round(ask) };
  } else {
    // Nothing here: one tap to the wider place, when it has a figure of either kind.
    const wider = chain.slice(1).find((sid) => hasClose(sid) || at(sid)?.a != null);
    body = `<p class="big">${esc(S.sellNone(from))}</p>` + (wider ? `<p><a class="btn" href="#/vender?z=${encodeURIComponent(wider)}&k=${k}&m2=${m2}${beds ? `&b=${beds}` : ""}">${esc(S.sellTry(zoneName(wider)))}</a></p>` : "");
  }
  how.push(S.sellNotEst);
  // The full report for this home, where the rule or the asks give a figure (pipeline/report/build-report.mjs reads the
  // same zone, kind, m2 and bedrooms from the reference).
  const report = used || here?.a != null ? reportSec(S.reportIntroSell, sellerRefOf({ zone: zid, kind: k, m2, beds })) : "";
  box.innerHTML = `<div class="res">${body}` +
    `<div class="acts"><button class="btn pri" type="button" data-lead="sell">${esc(S.sellBtnAgent)}</button>` +
    (used ? `<a class="btn" href="../app/#/mercado?m=${encodeURIComponent(mk)}&k=${k}">${esc(S.sellBtnHow)}</a>` : "") + `</div>` +
    (ST.zonas.zones[zoneOf] ? `<p><a class="tap" href="#/barrio?z=${encodeURIComponent(zoneOf)}&k=${k}">${esc(S.sellZone(zoneName(zoneOf)))}</a></p>` : "") + `</div>` + report +
    `<details class="how"><summary>${esc(S.howH)}</summary><ul>${how.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
}

// ---------------------------------------------------------------------------------------------
// Leads: one form for a visit, financing or selling. It goes through the shared capture (pages-src/capture.js, copied
// here by pipeline/build-casa.mjs): with the anon key it inserts into public.signups (insert-only row security; nothing
// can be read back); without it, it opens an email to the public address ("[tekoha:<kind>] <code>" and key: value lines,
// which pipeline/inbox-check.mjs turns into the same row) and says the form is in test; with neither the key nor a public
// address (CFG.leadsEmail, TEKOHA_PUBLIC_EMAIL at build time), it says the form opens soon and shows no form. Every
// request carries the visitor's referral code (payload.ref) when there is one.
// ---------------------------------------------------------------------------------------------
// The value report (docs/report-product.md). Free for an email: the lead form stores a kind "report" request with the
// home's reference, and the daily report job (pipeline/report/free-reports.mjs) builds it and emails it. Only while
// CFG.reportLink (REPORT_PAYMENT_LINK at build time) is set, a second button opens the Stripe Payment Link with the same
// reference, which the webhook reads back (pipeline/report/ref.mjs: letters, digits, "-" and "_" only, or Stripe drops it).
const b64url = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const listingRefOf = (id) => `listing-${id}-${S.lang}`;
const sellerRefOf = (c) => `seller-${b64url(JSON.stringify({ z: c.zone, k: c.kind, m: Math.round(c.m2), ...(c.beds ? { b: c.beds } : {}), l: S.lang }))}`;
function reportUrl(ref) {
  const u = new URL(CFG.reportLink);
  u.searchParams.set("client_reference_id", ref);
  u.searchParams.set("locale", S.lang === "en" ? "en" : "es-419");
  return u.href;
}
const reportOn = (ref) => !!CFG.reportLink && ref.length <= 200;
// The free report's button, and the paid one beside it while the Payment Link exists.
const reportBtns = (ref) => `<button class="btn pri" type="button" data-lead="report">${esc(S.reportFree)}</button>` +
  (reportOn(ref) ? `<a class="btn" href="${esc(reportUrl(ref))}" rel="noopener">${esc(S.reportBtn)}</a>` : "");
const reportSec = (intro, ref) => `<section class="sec" id="informe"><h2>${esc(S.reportH)}</h2><p>${esc(intro)}</p><div class="acts">${reportBtns(ref)}</div>` +
  `${reportOn(ref) ? `<p class="muted">${esc(S.reportPay)}</p>` : ""}</section>`;
function sellerReportCtx() {
  const c = ST.sellCtx || {};
  const what = c.where ? `${S.kindOne[c.kind] || ""} ${S.lang === "en" ? "in" : "en"} ${c.where}${c.m2 ? `, ${c.m2} m2` : ""}` : S.whatMix(true);
  return { msg: S.leadMsgReport(what), payload: { ...c, report: c.zone && c.m2 ? sellerRefOf(c) : null } };
}
// #/informe?l=<listing id>: where the property pages' free button lands (pages-src/site.js). It opens the report's form at
// once; the page's paid button, when there is one, goes to Stripe directly.
function showInforme(qs) {
  const V = $("#v-informe");
  const u = new URLSearchParams(qs || "");
  const id = /^\d{1,12}$/.test(u.get("l") || "") ? u.get("l") : null;
  document.title = `${S.reportH}: ${S.brand}`;
  const page = id ? new URL(`../l/${id}.html`, location.href).href : null;
  const ref = id ? listingRefOf(id) : null;
  const ctx = { msg: S.leadMsgReport(page || S.whatMix(true)), payload: { listing_id: id, report: ref, ad: page } };
  window.scrollTo(0, 0);
  V.innerHTML = `<h1>${esc(S.reportH)}</h1><p>${esc(S.reportIntro)}</p>` +
    `<div class="acts">${ref ? reportBtns(ref) : `<button class="btn pri" type="button" data-lead="report">${esc(S.reportFree)}</button>`}` +
    (page ? `<a class="btn" href="${esc(page)}">${esc(S.reportPage)}</a>` : "") + `</div>` +
    `${ref && reportOn(ref) ? `<p class="muted">${esc(S.reportPay)}</p>` : ""}`;
  V.onclick = (e) => { if (e.target.closest("[data-lead]")) openLead("report", ctx); };
  openLead("report", ctx);
}
function leadCtx(d, r, kind) {
  const price = F.priceMain(r) || "";
  const what = `${(S.kindOne[d.kind] || S.whatMix(true))} ${S.lang === "en" ? "in" : "en"} ${d.place.barrio || d.place.city}`;
  const msg = kind === "report" ? S.leadMsgReport(what) : kind === "mortgage" ? S.leadMsgMortgage(price, ST.cuota && fx() ? F.gsPay(ST.cuota.pay * fx()) : null)
    : S.leadMsgVisit(what, price, location.href);
  // The place and the advert's own link travel with the lead: the daily digest (pipeline/leads-digest.mjs) routes by
  // department or city, and a unit id can point at another home after a later build.
  return { msg, payload: { listing_id: d.id, market: d.place.mk, kind: d.kind, op: d.op, ask: d.ask.p, cur: d.ask.cur, estimate: d.est?.e ?? null,
    offer: d.offer?.lo != null ? [d.offer.lo, d.offer.hi, d.offer.cur] : null, cuota: kind === "mortgage" && ST.cuota ? Math.round(ST.cuota.pay) : null,
    barrio: d.place.barrio || null, city: d.place.city || null, dept: d.place.dept || null, ad: d.ads?.find((x) => x[2])?.[2] || null,
    ...(kind === "report" ? { report: listingRefOf(d.id) } : {}) } };
}
function openLead(kind, ctx) {
  const D = $("#lead");
  const test = !CFG.anon;
  if (test && !CFG.leadsEmail) {
    D.innerHTML = `<button class="x" type="button" data-close aria-label="${esc(S.leadClose)}">&times;</button><h2 id="lead-h">${esc(S.leadH[kind])}</h2>` +
      `<p class="test">${esc(S.leadSoon)}</p>`;
    D.onclick = (e) => { if (e.target.closest("[data-close]") || e.target === D) D.close(); };
    D.showModal();
    return;
  }
  if (kind === "sell" && !ctx.msg) ctx = { msg: S.leadMsgSell(ctx.where ? `${S.kindOne[ctx.kind] || ""} ${S.lang === "en" ? "in" : "en"} ${ctx.where}${ctx.m2 ? `, ${ctx.m2} m2` : ""}${ctx.beds ? `, ${S.bedsLong(ctx.beds)}` : ""}` : S.whatMix(true)), payload: ctx };
  // The free report goes to an email, so the email is the one field it needs; name and WhatsApp are optional there.
  const rep = kind === "report";
  D.innerHTML = `<button class="x" type="button" data-close aria-label="${esc(S.leadClose)}">&times;</button><h2 id="lead-h">${esc(S.leadH[kind])}</h2>` +
    (test ? `<p class="test">${esc(S.leadTest)}</p>` : "") + `<p>${esc(S.leadIntro[kind])}</p><form id="leadf" novalidate>` +
    `<div class="fld"><label class="lab" for="ln">${esc(rep ? S.leadNameOpt : S.leadName)}</label><input class="inp" id="ln" autocomplete="name"${rep ? "" : " required"}></div>` +
    `<div class="fld"><label class="lab" for="lp">${esc(rep ? S.leadPhoneOpt : S.leadPhone)}</label><input class="inp" id="lp" type="tel" autocomplete="tel" inputmode="tel" placeholder="${esc(S.leadPhonePh)}"${rep ? "" : " required"}></div>` +
    `<div class="fld"><label class="lab" for="le">${esc(rep ? S.leadEmailReq : S.leadEmail)}</label><input class="inp" id="le" type="email" autocomplete="email"${rep ? " required" : ""}></div>` +
    `<div class="fld"><label class="lab" for="lm">${esc(S.leadMsg)}</label><textarea class="inp" id="lm" rows="4">${esc(ctx.msg || "")}</textarea></div>` +
    `<input class="hp" id="lw" tabindex="-1" autocomplete="off" aria-hidden="true">` +
    `<p class="muted">${esc(rep ? S.leadPrivacyReport : S.leadPrivacy)}</p><button class="btn pri wide" type="submit">${esc(S.leadSend)}</button><p class="msg" id="lmsg" aria-live="polite"></p></form>`;
  D.onclick = (e) => { if (e.target.closest("[data-close]") || e.target === D) D.close(); };
  $("#leadf").addEventListener("submit", (e) => { e.preventDefault(); sendLead(kind, ctx); });
  D.showModal();
  $("#ln").focus();
}
async function sendLead(kind, ctx) {
  const name = $("#ln").value.trim(), phone = $("#lp").value.trim(), email = $("#le").value.trim(), msg = $("#lm").value.trim(), m = $("#lmsg");
  if ($("#lw").value) return;
  if (kind === "report") {
    if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(email) || email.length >= 200 || (phone && !/^[0-9+ ()-]{6,25}$/.test(phone))) {
      m.className = "msg bad"; m.textContent = S.leadNeedEmail; return;
    }
  } else if (!name || !/^[0-9+ ()-]{6,25}$/.test(phone)) { m.className = "msg bad"; m.textContent = S.leadNeed; return; }
  const payload = { ...(ctx.payload || {}), name: name.slice(0, 120), message: msg.slice(0, 1500), page: location.href.slice(0, 300), lang: S.lang };
  // With no public address the form never opens (openLead); this line is only a guard.
  if (!CFG.anon && !CFG.leadsEmail) { m.className = "msg"; m.textContent = S.leadSoon; return; }
  const btn = $("#leadf button[type=submit]");
  btn.disabled = true; m.className = "msg"; m.textContent = CFG.anon ? S.leadSending : "";
  const r = await capture({ supabase: CFG.supabase, anon: CFG.anon, to: CFG.leadsEmail }, { kind, email: email || null, phone: phone || null, source: "casa", payload });
  btn.disabled = false;
  if (r.via === "rest" && r.ok) { m.className = "msg okm"; m.textContent = kind === "report" ? S.leadOkReport : S.leadOk; $("#leadf").reset(); return; }
  // In test (no anon key yet) the form hands over a ready email, its fields as plain lines.
  if (r.via === "mail") { m.className = "msg"; m.innerHTML = `${esc(S.leadTest)} <a class="btn pri" id="lmail" href="${esc(r.href)}">${esc(S.leadMail)}</a>`; return; }
  m.className = "msg bad";
  m.innerHTML = r.href ? `${esc(S.leadFail)} <a href="${esc(r.href)}">${esc(S.leadMail)}</a>` : esc(S.leadFailRetry);
}

// ---------------------------------------------------------------------------------------------
// Router, header, language.
// ---------------------------------------------------------------------------------------------
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [p, qs] = h.split("?");
  const parts = (p || "").split("/").filter(Boolean);
  const v = parts[0] || "buscar";
  return { view: ["casa", "barrio", "vender", "guardados", "informe"].includes(v) ? v : "buscar", id: parts[1] ? decodeURIComponent(parts[1]) : null, qs: qs || "" };
}
async function route(ev) {
  const r = parseHash();
  if (ST.view === "buscar") ST.scroll.set(ST.lastSearch, window.scrollY);
  // El barrio opened from Mi casa or a home goes back there (the hash as it was, with Mi casa's figures); its own tabs and
  // the parent link keep that target.
  if (r.view === "barrio" && ST.view !== "barrio") {
    const prev = ev?.oldURL ? new URL(ev.oldURL).hash : null;
    ST.barrioBack = prev && (ST.view === "vender" || ST.view === "casa") ? prev : null;
  }
  ST.view = r.view;
  document.documentElement.dataset.view = r.view;
  $$("[data-nav]").forEach((a) => (a.dataset.nav === r.view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  if ($("#lead").open) $("#lead").close();
  if (r.view === "casa" && r.id) return showCasa(r.id);
  if (r.view === "barrio") { window.scrollTo(0, 0); return showBarrio(r.qs); }
  if (r.view === "vender") { window.scrollTo(0, 0); return showVender(r.qs); }
  if (r.view === "guardados") { window.scrollTo(0, 0); return showGuardados(); }
  if (r.view === "informe") return showInforme(r.qs);
  return showBuscar(r.qs);
}
function renderHeader() {
  $("#brand span").textContent = S.brand;
  const nav = $("#nav");
  $("[data-nav=vender]", nav).textContent = S.navSell;
  const sv = $("[data-nav=guardados]", nav);
  sv.setAttribute("aria-label", `${S.navSaved}${ST.saved.length ? ` (${ST.saved.length})` : ""}`);
  $("#nsaved").textContent = ST.saved.length ? String(ST.saved.length) : "";
  const lb = $("#lang");
  lb.textContent = S.langOther;
  lb.setAttribute("aria-label", S.langOtherLabel);
  $(".skip").textContent = S.skip;
  document.documentElement.lang = S.lang;
}
async function setLang(l, rerender = true) {
  if (l === "en") S = (await import("./strings-en.js?v=e0881558d9")).default;
  else S = ES;
  F = fmt(S, fx());
  store.set("casa-lang", S.lang);
  document.documentElement.dataset.pre = "off";
  delete $("#v-buscar").dataset.shell;
  renderHeader();
  if (rerender) route();
}
function stale() {
  const at = ST.casa.data_at ? Date.parse(ST.casa.data_at) : null;
  const el = $("#stale");
  if (at && Date.now() - at > 36 * 3600e3) { el.hidden = false; el.textContent = S.stale(F.date(ST.casa.data_at)); }
}

// ---------------------------------------------------------------------------------------------
// The plain-language check (docs/consumer-app-build.md): jargon on screen outside "¿Cómo lo sabemos?", a banned word
// anywhere (inside it too, open or closed), an estimate without its error.
// ---------------------------------------------------------------------------------------------
const BANNED = /\b(oportunidad|ganga|barat[oa]s?|remates?|bargain|steal|cheap|opportunit(y|ies)|undervalued|hidden gem)\b/i;
// The pro app's tags are capitals ("PEDIDO"); in lower case the same words are plain Spanish ("el precio pedido").
const JARGON = /\b(percentil|mediana|P25|P50|P75|MLS|plausib\w*|segmento|rango del 80|percentile|median|80% range|segment)\b/i;
const TAGS = /\b(ESTIMACIÓN|PEDIDO|CIERRE|OFICIAL)\b|(?:^|[\s(,;])n \d/;
window.casaCheck = () => {
  const out = [];
  const root = $(`#v-${ST.view}`);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement, t = n.nodeValue.trim();
    if (!t || el.closest("select, textarea, .leaflet-container")) continue;
    const how = !!el.closest("details.how");
    // A word quoted from the advert («remate») is the advert's, not the app's claim.
    if (BANNED.test(t.replace(/«[^»]*»/g, ""))) out.push(`banned${how ? " (in how)" : ""}: ${t.slice(0, 90)}`);
    if (how || !el.getClientRects().length) continue;
    if (JARGON.test(t) || TAGS.test(t)) out.push(`jargon: ${t.slice(0, 90)}`);
    if (/(Se espera que cierre|closes near|se vende cerca de|sells for about)/.test(t) && !/(más o menos|give or take)/.test(t)) out.push(`estimate without its error: ${t.slice(0, 90)}`);
  }
  return out;
};

// ---------------------------------------------------------------------------------------------
// Boot.
// ---------------------------------------------------------------------------------------------
async function boot() {
  performance.mark("casa:boot");
  try { ST.casa = await getJSON(`${DATA}casa.json`); }
  catch {
    $("#v-buscar").insertAdjacentHTML("afterbegin", `<p class="empty">${esc(S.loadFail)}</p>`);
    return;
  }
  F = fmt(S, fx());
  if (store.get("casa-lang") === "en") await setLang("en", false);
  renderHeader();
  stale();
  $("#lang").addEventListener("click", () => setLang(S.lang === "es" ? "en" : "es"));
  document.addEventListener("click", (e) => { const h = e.target.closest("#v-guardados [data-heart]"); if (h) { e.preventDefault(); toggleSaved(+h.dataset.heart, h); } });
  window.addEventListener("hashchange", route);
  try { history.scrollRestoration = "manual"; } catch {}
  await route();
  // The places for the search box, once the page has loaded, and only where the search box is.
  const later = () => setTimeout(() => { if (ST.view === "buscar") loadZonas().catch(() => {}); }, 1500);
  if (document.readyState === "complete") later(); else window.addEventListener("load", later, { once: true });
}
boot();
