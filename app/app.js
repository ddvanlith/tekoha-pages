// Tekoha app prototype (docs/prototype-spec.md): Buscar, Oferta and Mercado over the files pipeline/build-app.mjs writes
// into app/data (markets.json and one index shard per department and operation) and app/l (one file per unit). No
// framework; Leaflet and Leaflet.markercluster come from cdnjs. Every figure wears its tag (PEDIDO, CIERRE, ESTIMACIÓN,
// OFICIAL) with its n and window; window.tekohaCheck() lists every digit on screen that is not in a block showing its
// tag (see the check at the end of this file for the few elements it lets pass).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------------------------------------------------------------------------------------------
// Wording: es-PY numbers (Gs 285.000.000; 24,6%), dates as "10 oct 2026", fixed labels.
// ---------------------------------------------------------------------------------------------
const grp = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const n0 = (x) => (x == null || !Number.isFinite(+x) ? "-" : `${Math.round(+x) < 0 ? "-" : ""}${grp(String(Math.abs(Math.round(+x))))}`);
const n1 = (x, d = 1) => {
  if (x == null || !Number.isFinite(+x)) return "-";
  const [i, f] = Math.abs(+x).toFixed(d).split(".");
  return `${+x < 0 && +Math.abs(+x).toFixed(d) ? "-" : ""}${grp(i)}${d ? `,${f}` : ""}`;
};
const pct = (x, d = 1) => `${n1(x, d)}%`;
const spct = (x, d = 1) => (x == null ? "-" : `${+(+x).toFixed(d) > 0 ? "+" : ""}${pct(x, d)}`);
const money = (x, cur) => (x == null || !Number.isFinite(+x) ? "-" : `${cur === "PYG" ? "Gs" : "USD"} ${n0(x)}`);
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = (iso) => { if (!iso) return "-"; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const fechaC = (iso) => { if (!iso) return "-"; const [, m, d] = String(iso).slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]}`; };
const mesAno = (ym) => (ym ? `${MES[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : "-");
const dias = (n) => `${n0(n)} ${Math.round(n) === 1 ? "día" : "días"}`;
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"']/g, (c) => ESC[c]));
// The four species keep their English keys in the code (the spec's ASKING, CLOSED, ESTIMATE, OFICIAL) and print in Spanish.
const TAG_ES = { ASKING: "PEDIDO", CLOSED: "CIERRE", ESTIMATE: "ESTIMACIÓN", OFICIAL: "OFICIAL" };
const tag = (t) => `<span class="tag t-${t.toLowerCase()}">${TAG_ES[t] || t}</span>`;
const nOf = (n, one, many) => `${n0(n)} ${Math.round(n) === 1 ? one : many}`;
const cierres = (n) => nOf(n, "cierre", "cierres");
// A close reported in guaraníes prints in millions unless it is a round figure; a converted dollar figure, to the hundred.
const moneyClose = (x, cur) => (cur === "PYG" && x >= 1e7 && x % 1e6 !== 0 ? `Gs ${n0(x / 1e6)}M` : money(x, cur));
const usdRounded = (x) => `USD ${n0(Math.round(x / 100) * 100)}`;
// The negotiation leads with the median close against the ask, then the share that closed at the ask; one decimal on
// every screen.
const medVsAsk = (p) => (+(+p).toFixed(1) === 0 ? "al precio pedido" : `${spct(p)} ${p < 0 ? "bajo" : "sobre"} el pedido`);
const atAsk = (neg) => `${pct((neg.at / neg.n) * 100)} cerró al precio pedido`;
const belowMed = (neg) => (neg.bp50 != null ? `los ${n0(neg.below)} que cerraron bajo el pedido, mediana ${spct(neg.bp50)}`
  : `${nOf(neg.below, "cerró", "cerraron")} bajo el pedido, pocos para una mediana`);
const EPOCH = Date.parse("2020-01-01T00:00:00Z");
const fromDay = (n) => new Date(EPOCH + n * 864e5).toISOString().slice(0, 10);

const KIND = { departamento: "Departamento", casa: "Casa", duplex: "Dúplex", terreno: "Terreno", local: "Local", oficina: "Oficina",
  deposito: "Depósito", quinta: "Quinta", edificio: "Edificio", rural: "Inmueble rural", estacionamiento: "Estacionamiento",
  habitacion: "Habitación", otro: "Inmueble", unknown: "Inmueble" };
const KIND_PL = { departamento: "departamentos", casa: "casas", duplex: "dúplex", terreno: "terrenos", local: "locales", oficina: "oficinas",
  deposito: "depósitos", quinta: "quintas", edificio: "edificios", rural: "inmuebles rurales", estacionamiento: "estacionamientos",
  habitacion: "habitaciones", otro: "inmuebles de otro tipo", unknown: "inmuebles de tipo no declarado", all: "inmuebles" };
const KIND_ONE = { all: "inmueble", otro: "inmueble de otro tipo", unknown: "inmueble", duplex: "dúplex", rural: "inmueble rural" };
const FEM = new Set(["casa", "oficina", "quinta", "habitacion"]);
const kindLabel = (k) => (k === "otro" ? "Otro tipo" : k === "unknown" ? "Sin tipo declarado" : KIND[k] || k);
const kindN = (n, k) => `${n0(n)} ${n === 1 ? KIND_ONE[k] || (KIND[k] || "Inmueble").toLowerCase() : KIND_PL[k] || "inmuebles"}`;
const kindArt = (k) => `${FEM.has(k) ? "las" : "los"} ${KIND_PL[k] || "inmuebles"}`;
const act = (k) => (FEM.has(k) ? "activas" : "activos");
const OPN = { sale: "en venta", rent: "en alquiler" };
const SRC = { remax: "RE/MAX", infocasas: "InfoCasas", uprop: "uProp", cb: "Coldwell Banker", psir: "Sotheby's", prestige: "Prestige", c21: "Century 21" };
const BASIS_W = { built: "construidos", land: "de terreno", total: "totales", private: "privados", unknown: "base no declarada" };
const BANDS = ["alta", "media", "baja", "sin datos"];
const SORTS = { conf: "confianza, luego más nuevos", precio: "precio pedido, menor primero", m2: "USD por m2, menor primero", dias: "días publicado, menos primero" };
const MAIN_KINDS = ["casa", "departamento", "terreno", "duplex"];
const DEFAULTS = { m: "d:central", o: "sale", k: "casa", t: "alta,media", s: "conf" };

const shortPrice = (p, cur) => (cur === "PYG" ? `Gs ${n0(p / 1e6)}M` : p >= 1e6 ? `$${n1(p / 1e6, 1)}M` : `$${n0(p / 1e3)}k`);
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------------------------------------------------------------------------------------------
// State.
// ---------------------------------------------------------------------------------------------
const ST = {
  data: null, mk: new Map(), shards: new Map(), F: null, map: null, cluster: null, areas: null, listed: [], shown: 0,
  listMode: null, view: null, lastSearch: null, hot: null, ofertaMap: null, compsMap: null, places: new Map(), sig: null, pickAt: -1,
  failed: new Set(), deptMk: new Map(), focus: null, recon: null, split: null, stripParts: null, unplacedShown: null, loadingNames: [],
};

async function getJSON(url, priority = "auto") {
  const r = await fetch(url, { priority });
  if (!r.ok) { const e = new Error(`${url} ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [p, qs] = h.split("?");
  const parts = (p || "").split("/").filter(Boolean);
  return { view: parts[0] || "buscar", id: parts[1] || null, q: new URLSearchParams(qs || "") };
}
const rng = (s) => {
  if (!s) return null;
  const [a, b] = s.split("-");
  const lo = a === "" || a == null ? null : +a, hi = b === "" || b == null ? null : +b;
  return lo == null && hi == null ? null : [Number.isFinite(lo) ? lo : null, Number.isFinite(hi) ? hi : null];
};
const rngStr = (r) => (r ? `${r[0] ?? ""}-${r[1] ?? ""}` : null);
function filtersFrom(q) {
  const m = ST.mk.has(q.get("m")) ? q.get("m") : DEFAULTS.m;
  const t = (q.get("t") ?? DEFAULTS.t).split(",").filter((x) => BANDS.includes(x.replace("_", " ")));
  const v = (q.get("v") || "").split(",").map(Number);
  return {
    m, o: q.get("o") === "rent" ? "rent" : "sale", k: q.get("k") || DEFAULTS.k,
    p: rng(q.get("p")), a: rng(q.get("a")), b: +q.get("b") > 0 ? +q.get("b") : null, d: rng(q.get("d")),
    t: t.length === 4 ? null : new Set(t.map((x) => BANDS.indexOf(x.replace("_", " ")))),
    s: SORTS[q.get("s")] ? q.get("s") : DEFAULTS.s, mv: q.get("mv") !== "0",
    v: v.length === 3 && v.every(Number.isFinite) ? v : null,
  };
}
function hashOf(F, withView = true) {
  const p = [`m=${F.m}`];
  if (F.o !== "sale") p.push(`o=${F.o}`);
  p.push(`k=${F.k}`);
  if (F.p) p.push(`p=${rngStr(F.p)}`);
  if (F.a) p.push(`a=${rngStr(F.a)}`);
  if (F.b) p.push(`b=${F.b}`);
  const t = F.t ? [...F.t].sort().map((i) => BANDS[i].replace(" ", "_")).join(",") : "alta,media,baja,sin_datos";
  if (t !== DEFAULTS.t) p.push(`t=${t}`);
  if (F.d) p.push(`d=${rngStr(F.d)}`);
  if (F.s !== DEFAULTS.s) p.push(`s=${F.s}`);
  if (!F.mv) p.push("mv=0");
  if (withView && F.v) p.push(`v=${F.v[0].toFixed(4)},${F.v[1].toFixed(4)},${F.v[2]}`);
  return `#/buscar?${p.join("&")}`;
}
const marketName = (id) => {
  const m = ST.mk.get(id);
  if (!m) return "Paraguay";
  return m.level === "city" ? `${m.name}, ${ST.mk.get(m.parent)?.name || ""}` : m.name;
};
const deptOf = (id) => ST.mk.get(id)?.dk || "central";

// ---------------------------------------------------------------------------------------------
// The index: one shard per department and operation, fetched when the map needs it, parsed once into typed columns.
// ---------------------------------------------------------------------------------------------
function decode(j) {
  const n = j.n, a = j.a, rate = ST.data.meta.fx.rate;
  const F64 = (k) => Float64Array.from(a[k], (v) => (v == null ? NaN : v));
  const I32 = (k) => Int32Array.from(a[k], (v) => (v == null ? -1 : v));
  const S = { n, dept: j.dept, op: j.op, dict: j.dict, pins: j.pins, segs: j.segs, cmk: j.dict.c.map((c) => c[1]),
    id: F64("id"), k: I32("k"), c: I32("c"), b: I32("b"), y: F64("y"), x: F64("x"), pr: I32("pr"), pn: I32("pn"), p: F64("p"), cu: I32("cu"),
    su: F64("su"), a: F64("a"), ab: I32("ab"), bd: F64("bd"), dl: F64("dl"), ct: I32("ct"), cl: F64("cl"), ad: I32("ad"), tb: I32("tb"),
    ts: F64("ts"), e: F64("e"), el: F64("el"), eh: F64("eh"), es: I32("es"), nw: F64("nw"), s: I32("s") };
  S.lat = S.y.map((v) => v / 1e5); S.lon = S.x.map((v) => v / 1e5);
  S.usd = new Float64Array(n);
  for (let i = 0; i < n; i++) S.usd[i] = !Number.isNaN(S.p[i]) ? (S.cu[i] === 1 ? S.p[i] / rate : S.p[i]) : S.su[i];
  S.lm = new Float64Array(n).fill(NaN); S.fv = new Float64Array(n).fill(NaN);
  for (const [row, lm, fv] of j.parcels || []) { S.lm[row] = lm ?? NaN; S.fv[row] = fv ?? NaN; }
  S.mask = new Uint8Array(n); S.miss = new Uint8Array(n); S.markers = new Array(n);
  return S;
}
function loadShard(key) {
  if (ST.shards.has(key)) return ST.shards.get(key);
  const info = ST.data.meta.shards[key];
  // Low priority: on a slow phone the map tiles (the largest paint) go first, the list fills a moment later.
  const pr = info ? getJSON(`data/${info.file}`, "low").then((j) => { const S = decode(j); S.key = key; return S; }) : Promise.resolve(null);
  // A failed fetch leaves the cache and is marked failed: the list says so, and Reintentar fetches it again.
  pr.then((S) => { pr.resolved = S; pr.done = true; }, () => { if (ST.shards.get(key) === pr) ST.shards.delete(key); ST.failed.add(key); });
  ST.shards.set(key, pr);
  return pr;
}
async function loadedShards(op) {
  const out = [];
  for (const [k, p] of [...ST.shards]) if (k.endsWith(`|${op}`)) { const S = await p.catch(() => null); if (S) out.push(S); }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Header: data stamp, stale line, market and barrio picker.
// ---------------------------------------------------------------------------------------------
function renderHeader() {
  const m = ST.data.meta;
  const at = m.data_at ? new Date(m.data_at) : null;
  const hhmm = at ? at.toISOString().slice(11, 16) : "";
  $("#hstamp").innerHTML = at ? `<span data-nofig>datos al ${fecha(m.data_at)}, ${hhmm} UTC</span>` +
    `<span class="fx dk" data-t="OFICIAL">${tag("OFICIAL")}SET Gs ${n0(m.fx.rate)} por USD, ${fechaC(m.fx.date)}</span>` : "";
  const old = at && Date.now() - at.getTime() > 36 * 3600e3;
  if (old || m.health === "RED") {
    $("#stale").hidden = false;
    $("#stale").textContent = `Datos del ${fechaC(m.data_at)}: la captura de hoy no corrió.`;
  }
}
const fold = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const inm = (n) => nOf(n, "inmueble", "inmuebles");
function renderPicker(qs = "") {
  const q = fold(qs.trim());
  const cur = currentMarket();
  const items = [];
  const depts = ST.data.markets.filter((m) => m.level === "dept");
  const li = (cls, data, label, count, on) => `<li class="${cls}${on ? " on" : ""}" ${data} role="option" tabindex="0" aria-selected="${!!on}">${label}<small>${count}</small></li>`;
  for (const d of depts) {
    const cities = ST.data.markets.filter((m) => m.parent === d.id);
    const dHit = !q || fold(d.name).includes(q);
    const cHits = cities.filter((c) => !q || fold(c.name).includes(q));
    // A department shown only as the heading of its matching cities stays clickable but is not a match for Enter.
    if (dHit || cHits.length) items.push(li(q && !dHit ? "dept grp" : "dept", `data-m="${d.id}"`, esc(d.name), `${inm(d.n.sale)} en venta`, cur === d.id));
    for (const c of q ? cHits : cities) items.push(li("city", `data-m="${c.id}"`, esc(c.name), `${inm(c.n.sale)} en venta`, cur === c.id));
  }
  if (q.length >= 2) {
    const bs = ST.data.places.filter((p) => fold(p[0]).includes(q)).slice(0, 25);
    for (const b of bs) items.push(li("barrio", `data-b="${esc(b[0])}|${b[1]}"`, `${esc(b[0])}, ${esc(b[5] || "")}`, `barrio, ${inm(b[4])}, venta y alquiler`, false));
  }
  $("#pick-list").innerHTML = items.join("") || `<li class="muted" role="option" aria-disabled="true">Ningún barrio ni ciudad con ese nombre en los avisos activos</li>`;
  ST.pickAt = q ? 0 : -1;
  markPick();
}
const PICKABLE = "#pick-list li[data-m]:not(.grp), #pick-list li[data-b]";
function markPick() {
  const lis = $$(PICKABLE);
  lis.forEach((x, i) => { x.id = `po-${i}`; x.classList.toggle("kb", i === ST.pickAt); });
  const on = lis[ST.pickAt];
  if (on) on.scrollIntoView({ block: "nearest" });
  $("#hq").setAttribute("aria-activedescendant", on ? on.id : "");
}
function currentMarket() {
  const r = parseHash();
  return ST.mk.has(r.q.get("m")) ? r.q.get("m") : ST.F?.m || DEFAULTS.m;
}
function choosePick(li) {
  if (!li) return;
  closePicker();
  const r = parseHash();
  $("#hq").value = "";
  if (li.dataset.m) {
    if (r.view === "mercado") location.hash = `#/mercado?m=${li.dataset.m}&k=${r.q.get("k") || DEFAULTS.k}${r.q.get("o") === "rent" ? "&o=rent" : ""}`;
    else location.hash = hashOf({ ...(ST.F || filtersFrom(new URLSearchParams())), m: li.dataset.m, v: null });
  } else if (li.dataset.b) {
    const [name, mk] = li.dataset.b.split("|");
    const p = ST.data.places.find((x) => x[0] === name && x[1] === mk);
    if (p) location.hash = hashOf({ ...(ST.F || filtersFrom(new URLSearchParams())), m: mk, v: [p[2], p[3], 15], mv: true });
  }
}
function closePicker() { $("#pick-pane").hidden = true; $("#pick-btn").setAttribute("aria-expanded", "false"); $("#hq").setAttribute("aria-expanded", "false"); }
function openPicker(qs) { renderPicker(qs); $("#pick-pane").hidden = false; $("#pick-btn").setAttribute("aria-expanded", "true"); $("#hq").setAttribute("aria-expanded", "true"); }
function wirePicker() {
  const btn = $("#pick-btn"), pane = $("#pick-pane"), inp = $("#hq");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (pane.hidden) openPicker(inp.value); else closePicker();
  });
  inp.addEventListener("click", (e) => e.stopPropagation());
  inp.addEventListener("focus", () => openPicker(inp.value));
  inp.addEventListener("input", () => openPicker(inp.value));
  // The search field drives the list: arrows move, Enter takes the marked option or the first match.
  inp.addEventListener("keydown", (e) => {
    const lis = $$(PICKABLE);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (pane.hidden) openPicker(inp.value);
      ST.pickAt = Math.max(0, Math.min(lis.length - 1, (ST.pickAt ?? -1) + (e.key === "ArrowDown" ? 1 : -1)));
      markPick();
    } else if (e.key === "Enter") {
      e.preventDefault();
      choosePick(lis[ST.pickAt >= 0 ? ST.pickAt : 0]);
    }
  });
  pane.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", closePicker);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePicker(); closePanel(); } });
  $("#pick-list").addEventListener("click", (e) => choosePick(e.target.closest("li[data-m], li[data-b]")));
  $("#pick-list").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choosePick(e.target.closest("li[data-m], li[data-b]")); }
  });
}
// The mark and Buscar keep the reader's search; without one (a shared link opened cold) they open the market on
// screen. ctx is the market, kind and operation of the Oferta or Mercado screen.
function updateNav(ctx = null) {
  const F = ST.F, here = ctx?.mk || F?.m || DEFAULTS.m;
  const k = ctx?.k || (F && F.k !== "all" ? F.k : DEFAULTS.k), rent = (ctx?.o || F?.o) === "rent" ? "&o=rent" : "";
  const search = F ? hashOf(F) : ST.lastSearch?.hash || `#/buscar?m=${here}${rent}&k=${k}`;
  for (const a of [$("#mark"), $("#nav-buscar")]) a?.setAttribute("href", search);
  $("#nav-mercado")?.setAttribute("href", `#/mercado?m=${here}&k=${k}${rent}`);
}

// ---------------------------------------------------------------------------------------------
// Router.
// ---------------------------------------------------------------------------------------------
function show(view) {
  for (const v of ["buscar", "oferta", "mercado"]) $(`#v-${v}`).hidden = v !== view;
  for (const a of $$(".nav a")) a.classList.toggle("on", a.dataset.nav === view || (view === "oferta" && a.dataset.nav === "buscar"));
  document.documentElement.dataset.view = view;
  ST.view = view;
}
async function route() {
  const r = parseHash(), from = ST.view;
  // Leaving Buscar keeps its place (cards shown, scroll) under the search's hash, so Back lands where the reader was.
  if (from === "buscar" && r.view !== "buscar") savePlace();
  closePanel();
  closePicker();
  if (r.view === "l" && r.id) { show("oferta"); updateNav(); await showOferta(r.id); return; }
  if (r.view === "mercado") { show("mercado"); showMercado(r.q); return; }
  show("buscar");
  await showBuscar(r.q);
  if (from && from !== "buscar") restorePlace();
}
function savePlace() {
  if (!ST.F) return;
  ST.places.set(hashOf(ST.F), { shown: ST.shown, y: window.scrollY, lp: $("#listpane").scrollTop });
}
function restorePlace() {
  const p = ST.F && ST.places.get(hashOf(ST.F));
  if (!p) return;
  window.scrollTo(0, p.y);
  $("#listpane").scrollTop = p.lp;
}

// ---------------------------------------------------------------------------------------------
// Buscar.
// ---------------------------------------------------------------------------------------------
// The Leaflet stylesheet loads without blocking the first paint; a map built before it lands lays its tiles out in the
// page flow and then jumps (layout shift), so maps wait for it, at most 4 seconds.
function leafletCss() {
  const ready = () => [...document.styleSheets].some((s) => (s.href || "").includes("leaflet.min.css"));
  if (ready() || !document.getElementById("lcss")) return Promise.resolve();
  return new Promise((res) => {
    const t0 = Date.now();
    const tick = () => (ready() || Date.now() - t0 > 4000 ? res() : setTimeout(tick, 40));
    tick();
  });
}
function ensureMap() {
  if (ST.map) return;
  // Whole zoom levels: a fractional zoom draws the next level's tiles scaled down, twice the tiles for the first paint.
  const map = L.map("map", { zoomSnap: 1, preferCanvas: false, worldCopyJump: false }).setView([-25.33, -57.5], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).once("load", addFonts).addTo(map);
  ST.cluster = L.markerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true, zoomToBoundsOnClick: true, chunkedLoading: true,
    animate: false, removeOutsideVisibleBounds: true, maxClusterRadius: (z) => (z >= 15 ? 26 : 56),
    iconCreateFunction: (c) => {
      const n = c.getChildCount(), s = n < 10 ? 30 : n < 100 ? 36 : n < 1000 ? 42 : 48;
      return L.divIcon({ html: `<span>${n0(n)}</span>`, className: "clu", iconSize: [s, s] });
    } });
  map.addLayer(ST.cluster);
  ST.areas = L.layerGroup().addTo(map);
  // Barrio pins (a dashed circle and its label) show from zoom 13: further out a dense capital piles dozens of them on
  // each other. The list counts them at every zoom.
  const z15 = () => {
    const z = map.getZoom();
    $("#map").classList.toggle("z15", z >= 15);
    if (z >= 13 && !map.hasLayer(ST.areas)) map.addLayer(ST.areas);
    else if (z < 13 && map.hasLayer(ST.areas)) map.removeLayer(ST.areas);
  };
  map.on("zoomend", z15);
  z15();
  let t = null;
  map.on("moveend", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (ST.view !== "buscar") return;
      const c = map.getCenter();
      ST.F.v = [c.lat, c.lng, map.getZoom()];
      history.replaceState(null, "", hashOf(ST.F));
      saveSearch();
      if (ST.F.mv) refreshView();
    }, 120);
  });
  ST.map = map;
}
function markerFor(S, i) {
  if (S.markers[i]) return S.markers[i];
  const label = !Number.isNaN(S.p[i]) ? shortPrice(S.p[i], S.cu[i] === 1 ? "PYG" : "USD") : !Number.isNaN(S.su[i]) ? shortPrice(S.su[i], "USD") : "sin precio";
  const m = L.marker([S.lat[i], S.lon[i]], { icon: L.divIcon({ className: "pin", html: `<span>${label}</span>`, iconSize: null }), keyboard: false });
  m.on("click", () => { location.hash = `#/l/${S.id[i]}`; });
  m._ref = [S, i];
  S.markers[i] = m;
  return m;
}
// Filter bits in S.mask: 1 Tipo, 2 Precio, 4 Tamaño, 8 Dormitorios, 16 Confianza, 64 Días (32 was a filter on the
// estimate's gap, removed: docs/ux-lessons.md).
const BIT_NAME = { 2: "Precio", 4: "Tamaño", 8: "Dormitorios", 16: "Confianza", 64: "Días publicado" };
function computeMasks(S) {
  const F = ST.F, kIdx = F.k === "all" ? -2 : S.dict.k.indexOf(F.k);
  for (let i = 0; i < S.n; i++) {
    let m = 0, miss = 0;
    if (kIdx !== -2 && S.k[i] !== kIdx) m |= 1;
    if (F.p) { const u = S.usd[i]; if (Number.isNaN(u)) miss |= 1; else if ((F.p[0] != null && u < F.p[0]) || (F.p[1] != null && u > F.p[1])) m |= 2; }
    if (F.a) { const a = S.a[i]; if (Number.isNaN(a)) miss |= 2; else if ((F.a[0] != null && a < F.a[0]) || (F.a[1] != null && a > F.a[1])) m |= 4; }
    if (F.b) { const b = S.bd[i]; if (Number.isNaN(b)) miss |= 4; else if (b < F.b) m |= 8; }
    if (F.t) { const tb = S.tb[i]; if (tb < 0) miss |= 8; else if (!F.t.has(tb)) m |= 16; }
    if (F.d) { const d = S.dl[i]; if (Number.isNaN(d)) miss |= 16; else if ((F.d[0] != null && d < F.d[0]) || (F.d[1] != null && d > F.d[1])) m |= 64; }
    S.mask[i] = m; S.miss[i] = miss;
  }
}
const inMarket = (S, i) => { const m = ST.mk.get(ST.F.m); return m?.level === "city" ? S.cmk[S.c[i]] === ST.F.m : S.dept === m?.dk; };
// The map's view is the query: every department whose box meets the view loads its shard and joins the list, so a view
// over Villa Morra shows Asunción beside Central. Cities are parts of their department, so departments are enough.
// With "Buscar al mover el mapa" off, the list is the anchor market (the hash's m) alone.
function neededKeys() {
  const F = ST.F;
  if (!F.mv || !ST.map) return ST.data.meta.shards[`${deptOf(F.m)}|${F.o}`] ? [`${deptOf(F.m)}|${F.o}`] : [];
  const b = ST.map.getBounds();
  return ST.data.markets.filter((m) => m.level === "dept" && m.bbox && ST.data.meta.shards[`${m.dk}|${F.o}`] && b.intersects(L.latLngBounds(m.bbox)))
    .map((m) => `${m.dk}|${F.o}`);
}
// Loads what the view needs, then redraws: the list shows the loading state until every needed shard is in.
async function refreshView(rebuild = false) {
  // Before the map exists (a filter set while its stylesheet loads) showBuscar runs this once the map is up.
  if (!ST.map) return;
  const F = ST.F;
  const waiting = neededKeys().map((k) => ST.shards.get(k) || (ST.failed.has(k) ? null : loadShard(k))).filter((p) => p && !p.done);
  if (waiting.length) {
    deriveView();
    await Promise.allSettled(waiting);
    if (ST.F !== F || ST.view !== "buscar") return;
    rebuild = true;
  }
  if (rebuild) await rebuildMap(); else deriveView();
}
async function rebuildMap() {
  const F = ST.F, shards = await loadedShards(F.o);
  for (const S of shards) computeMasks(S);
  const arr = [];
  ST.areas.clearLayers();
  for (const S of shards) {
    if (!F.mv && S.dept !== deptOf(F.m)) continue;
    const per = new Map();
    for (let i = 0; i < S.n; i++) {
      if (S.mask[i] !== 0 || (!F.mv && !inMarket(S, i))) continue;
      if (S.pr[i] <= 1 && !Number.isNaN(S.lat[i])) arr.push(markerFor(S, i));
      else if (S.pr[i] === 2 && S.pn[i] >= 0) per.set(S.pn[i], (per.get(S.pn[i]) || 0) + 1);
    }
    for (const [pn, n] of per) {
      const p = S.pins[pn], ll = [p[0] / 1e5, p[1] / 1e5];
      L.circle(ll, { radius: 650, color: "#a97e2f", weight: 1.5, dashArray: "5 6", fillColor: "#a97e2f", fillOpacity: 0.07, interactive: false }).addTo(ST.areas);
      L.marker(ll, { icon: L.divIcon({ className: "area", html: `<span>~${n0(n)}<small>, ubicación aproximada${p[2] ? `, ${esc(p[2])}` : ""}</small></span>`, iconSize: null }), keyboard: false })
        .on("click", () => { ST.listMode = { type: "pin", si: S.key, pn }; renderList(); }).addTo(ST.areas);
    }
  }
  ST.cluster.clearLayers();
  ST.cluster.addLayers(arr);
  deriveView();
}
function bounds() {
  const b = ST.map.getBounds();
  return { s: b.getSouth(), n: b.getNorth(), w: b.getWest(), e: b.getEast() };
}
const tallyNew = () => ({ total: 0, listed: 0, unplaced: 0, filtered: 0, outside: 0 });
function deriveView() {
  const F = ST.F, B = F.mv ? bounds() : null, keys = neededKeys();
  // Every shard the view needs decides the state: while one loads, or after one failed, the list says so and names it.
  const failed = keys.filter((k) => ST.failed.has(k)), pending = keys.filter((k) => !ST.failed.has(k) && !ST.shards.get(k)?.done);
  ST.loading = failed.length ? "failed" : pending.length ? "loading" : null;
  ST.loadingNames = (failed.length ? failed : pending).map((k) => ST.deptMk.get(k.split("|")[0])?.name || k.split("|")[0]);
  const anchor = ST.mk.get(F.m), city = anchor?.level === "city" ? anchor.id : null, anchorDk = deptOf(F.m);
  const listed = [], unplaced = [], hidden = {}, miss = { 1: 0, 2: 0, 4: 0, 8: 0, 16: 0 }, per = new Map(), cityT = tallyNew();
  let pinRows = 0;
  for (const p of ST.shards.values()) {
    const S = p.resolved;
    if (!S || S.op !== F.o || !keys.includes(S.key)) continue;
    if (!per.has(S.dept)) per.set(S.dept, tallyNew());
    const t = per.get(S.dept);
    for (let i = 0; i < S.n; i++) {
      const m = S.mask[i];
      if (m & 1 || (!F.mv && !inMarket(S, i))) continue;
      const pr = S.pr[i];
      // here: true in the view, false outside it, null without a point of its own.
      let here = null, cls;
      if (pr <= 1 && !Number.isNaN(S.lat[i])) here = !B || (S.lat[i] >= B.s && S.lat[i] <= B.n && S.lon[i] >= B.w && S.lon[i] <= B.e);
      else if (pr === 2 && S.pn[i] >= 0) {
        const pin = S.pins[S.pn[i]], la = pin[0] / 1e5, lo = pin[1] / 1e5;
        here = !B || (la >= B.s && la <= B.n && lo >= B.w && lo <= B.e);
      }
      if (m) {
        cls = "filtered";
        if (here !== false && (m & (m - 1)) === 0) hidden[m] = (hidden[m] || 0) + 1;
      } else if (here === null) { cls = "unplaced"; unplaced.push([S, i]); }
      else if (!here) cls = "outside";
      else {
        cls = "listed";
        listed.push([S, i]);
        if (pr === 2) pinRows += 1;
        const x = S.miss[i];
        if (x) for (const bit of [1, 2, 4, 8, 16]) if (x & bit) miss[bit] += 1;
      }
      t.total += 1; t[cls] += 1;
      if (city && S.cmk[S.c[i]] === city) { cityT.total += 1; cityT[cls] += 1; }
    }
  }
  // Accounted markets: the anchor city when the search opened on one, then each department with units in the list
  // (and the anchor's own), most units first. Each line adds up on its own: in the list, without a point, filtered, outside.
  const name = (dk) => ST.deptMk.get(dk)?.name || dk;
  const depts = [...per.entries()].filter(([dk, t]) => t.listed > 0 || dk === anchorDk)
    .sort((a, b) => b[1].listed - a[1].listed || (a[0] === anchorDk ? -1 : b[0] === anchorDk ? 1 : 0));
  ST.recon = F.mv ? [...(city ? [{ name: anchor.name, city: true, ...cityT }] : []), ...depts.map(([dk, t]) => ({ name: name(dk), ...t }))]
    : [{ name: marketName(F.m), ...(per.get(anchorDk) || tallyNew()) }];
  ST.split = F.mv ? depts.filter(([, t]) => t.listed > 0).map(([dk, t]) => [name(dk), t.listed]) : [];
  const stripDk = new Set(depts.filter(([, t]) => t.unplaced > 0).map(([dk]) => dk));
  ST.unplacedShown = unplaced.filter(([S]) => stripDk.has(S.dept));
  ST.stripParts = F.mv ? depts.filter(([dk]) => stripDk.has(dk)).map(([dk, t]) => [name(dk), t.unplaced]) : unplaced.length ? [[marketName(F.m), unplaced.length]] : [];
  // The department with the most units in the list is the screen's market (the Mercado link, the picker's label); the
  // anchor keeps that role inside its own department, so a search opened on Luque stays on Luque.
  const top = depts.find(([, t]) => t.listed > 0)?.[0];
  ST.focus = F.mv && top && top !== anchorDk ? ST.deptMk.get(top)?.id || F.m : F.m;
  ST.listed = listed; ST.unplaced = unplaced; ST.hidden = hidden; ST.miss = miss; ST.pinRows = pinRows;
  renderList();
}
const SORTERS = {
  conf: (A, B) => cmpDesc(A[0].ts[A[1]], B[0].ts[B[1]]) || cmpDesc(A[0].nw[A[1]], B[0].nw[B[1]]) || A[0].id[A[1]] - B[0].id[B[1]],
  precio: (A, B) => cmpAsc(A[0].usd[A[1]], B[0].usd[B[1]]) || A[0].id[A[1]] - B[0].id[B[1]],
  m2: (A, B) => cmpAsc(A[0].usd[A[1]] / A[0].a[A[1]], B[0].usd[B[1]] / B[0].a[B[1]]) || A[0].id[A[1]] - B[0].id[B[1]],
  dias: (A, B) => cmpAsc(A[0].dl[A[1]], B[0].dl[B[1]]) || cmpDesc(A[0].nw[A[1]], B[0].nw[B[1]]) || A[0].id[A[1]] - B[0].id[B[1]],
};
function cmpDesc(a, b) { const na = !Number.isFinite(a), nb = !Number.isFinite(b); return na && nb ? 0 : na ? 1 : nb ? -1 : b - a; }
function cmpAsc(a, b) { const na = !Number.isFinite(a), nb = !Number.isFinite(b); return na && nb ? 0 : na ? 1 : nb ? -1 : a - b; }

function priceHtml(S, i) {
  if (!Number.isNaN(S.p[i])) return `<b>${money(S.p[i], S.cu[i] === 1 ? "PYG" : "USD")}</b>`;
  if (!Number.isNaN(S.su[i])) return `<b>USD ${n0(S.su[i])}</b>`;
  return `<b class="muted">sin precio publicado</b>`;
}
function priceSub(S, i) {
  if (!Number.isNaN(S.p[i]) && S.cu[i] === 1) return `<div class="cu">USD ${n0(S.usd[i])} a la tasa SET del ${fechaC(ST.data.meta.fx.date)}</div>`;
  if (Number.isNaN(S.p[i]) && !Number.isNaN(S.su[i])) return `<div class="cu">según el portal: no leímos el precio en la moneda del aviso</div>`;
  return "";
}
function areaText(S, i) {
  if (Number.isNaN(S.a[i])) return null;
  const b = S.dict.ab[S.ab[i]];
  return `${n0(S.a[i])} m2${b === "land" ? " de terreno" : b === "total" ? " totales" : ""}`;
}
function card(S, i, idx) {
  const kind = S.dict.k[S.k[i]], band = S.tb[i] >= 0 ? BANDS[S.tb[i]] : null;
  const city = S.dict.c[S.c[i]][0], barrio = S.b[i] >= 0 ? S.dict.b[S.b[i]] : null;
  const facts = [KIND[kind] || "Inmueble", areaText(S, i), S.bd[i] > 0 && kind !== "terreno" ? `${n0(S.bd[i])} dorm.` : null].filter(Boolean).join(", ");
  const place = [barrio, city].filter(Boolean).join(", ");
  const approx = S.pr[i] === 2 ? " · ubicación aproximada" : S.pr[i] >= 3 ? " · sin punto propio" : "";
  const sub = [!Number.isNaN(S.dl[i]) ? `${dias(S.dl[i])} publicado` : "sin fecha de publicación confiable",
    S.ct[i] > 0 ? `${S.ct[i] === 1 ? "1 recorte" : `${S.ct[i]} recortes`}, el último el ${fechaC(fromDay(S.cl[i]))}` : null,
    S.ad[i] > 1 ? `${S.ad[i]} avisos` : null].filter(Boolean).join(" · ");
  let est = "";
  const sg = S.segs[S.es[i]] || [];
  // The spec's Range rule: no estimate without its range, measured error and n.
  if (!Number.isNaN(S.e[i]) && sg[2] != null) {
    est = `<div class="c4 est" data-t="ESTIMATE">${tag("ESTIMATE")}USD ${n0(S.e[i])}, rango USD ${n0(S.el[i])} a USD ${n0(S.eh[i])}, error ${pct(sg[2])}, n ${n0(sg[3])}</div>`;
  }
  return `<a class="card" href="#/l/${S.id[i]}" data-r="${idx}" data-t="ASKING"><div class="c1"><span>${tag("ASKING")}${priceHtml(S, i)}</span>` +
    `<span class="tb ${band ? band.replace(" ", "-") : ""}">${band ? `confianza ${band}` : "sin confianza calculada"}</span></div>${priceSub(S, i)}` +
    `<div class="c2">${esc(facts)}</div><div class="c3">${esc(place)}${approx}</div><div class="c3">${esc(sub)}</div>${est}</a>`;
}
function renderList() {
  const F = ST.F, kind = F.k, strip = $("#strip"), more = $("#more");
  const lead = (n) => `${tag("ASKING")}<b>${kindN(n, kind).replace(/^(\S+)/, "$1</b>")}`;
  // While a shard the view needs is on its way, or failed, the list says so and names it: never a false "0 casas", never
  // an empty area read as no data.
  if (ST.loading) {
    const failed = ST.loading === "failed", names = esc((ST.loadingNames?.length ? ST.loadingNames : [marketName(F.m)]).join(" y "));
    $("#count").innerHTML = `<div class="n">${failed ? `No se pudieron cargar los avisos de ${names}. <button class="btn retry" type="button" data-retry>Reintentar</button>`
      : `Cargando los avisos de ${names}`}</div>`;
    strip.hidden = true;
    more.hidden = true;
    $("#cards").innerHTML = failed ? "" : `<div class="sk"></div><div class="sk"></div><div class="sk"></div>`;
    ST.sig = null;
    updateChips();
    return;
  }
  const where = F.mv ? "en el mapa" : `en ${esc(marketName(F.m))}`;
  const stripNames = (ST.stripParts || []).map(([nm]) => esc(nm)).join(" y ");
  let rows = ST.listed || [], head = "";
  const mode = ST.listMode;
  if (mode?.type === "unplaced") {
    rows = ST.unplacedShown || [];
    head = `<div class="n">${lead(rows.length)} en ${stripNames} sin punto propio</div>` +
      `<div class="o">El portal no publica dónde están: punto genérico de la ciudad o sin coordenadas. <button type="button" data-back>Volver al mapa</button></div>`;
  } else if (mode?.type === "pin") {
    rows = (ST.listed || []).filter(([S, i]) => S.key === mode.si && S.pn[i] === mode.pn);
    const S0 = rows[0]?.[0], p = S0 ? S0.pins[mode.pn] : null;
    head = `<div class="n">${lead(rows.length)} en un punto genérico del portal${p?.[2] ? ` para ${esc(p[2])}` : " para el barrio"}</div>` +
      `<div class="o">Ubicación aproximada: el portal no publica la dirección. <button type="button" data-back>Volver al mapa</button></div>`;
  } else {
    const hidW = FEM.has(kind) ? "ocultas" : "ocultos", inList = F.mv ? "en el mapa" : "en la lista";
    const hid = Object.entries(ST.hidden || {}).filter(([, n]) => n > 0).map(([b, n]) => `${n0(n)} por ${BIT_NAME[b]}${+b === 16 ? " (confianza baja o sin datos)" : ""}`);
    const missTxt = [ST.miss?.[1] && `${n0(ST.miss[1])} sin precio leído`, ST.miss?.[2] && `${n0(ST.miss[2])} sin superficie`,
      ST.miss?.[4] && `${n0(ST.miss[4])} sin dormitorios declarados`, ST.miss?.[8] && `${n0(ST.miss[8])} sin confianza calculada`,
      ST.miss?.[16] && `${n0(ST.miss[16])} sin fecha de publicación confiable`].filter(Boolean);
    // One line per market in view, each adding up to its own total.
    const parts = (t, long) => [t.listed && `${n0(t.listed)} ${inList}`, t.unplaced && `${n0(t.unplaced)} sin punto propio`,
      t.filtered && `${n0(t.filtered)} ${hidW} por ${long ? "los filtros" : "filtros"}`, t.outside && `${n0(t.outside)} fuera ${long ? "de esta vista del mapa" : "del mapa"}`].filter(Boolean).join(", ");
    // The phone line leaves out what the count line already shows (each department in the list), the anchor city keeps it.
    const short = (t) => [t.city && t.listed && `${n0(t.listed)} ${inList}`, t.unplaced && `${n0(t.unplaced)} sin punto propio`,
      t.filtered && `${n0(t.filtered)} por filtros`, t.outside && `${n0(t.outside)} fuera del mapa`].filter(Boolean).join(", ");
    const R = (ST.recon || []).filter((t) => t.total), many = R.length > 1;
    const split = (ST.split || []).length > 1 ? `: ${ST.split.map(([nm, n]) => `${esc(nm)} ${n0(n)}`).join(", ")}` : "";
    const open = ST.countOpen ? " open" : "";
    head = `<div class="n">${lead(rows.length)} ${where}${split}` +
      `<button class="i" type="button" data-i aria-label="Detalle de la cuenta" aria-expanded="${!!ST.countOpen}">i</button></div>` +
      R.filter((t) => many || t.listed !== t.total).map((t) => `<div class="sum ph">De ${n0(t.total)} en ${esc(t.name)}: ${short(t)}.</div>`).join("") +
      `<div class="det${open}"><div class="o">Orden: ${SORTS[F.s]}. <button type="button" data-f="orden">Cambiar</button></div>` +
      (ST.pinRows ? `<div class="hid">Incluye ${n0(ST.pinRows)} con ubicación aproximada: el punto genérico del portal para su barrio, dibujado como un círculo.</div>` : "") +
      R.filter((t) => many || t.listed !== t.total).map((t) => `<div class="hid">De ${kindN(t.total, kind)} ${OPN[F.o]} ${act(kind)} en ${esc(t.name)}: ${parts(t, true)}.</div>`).join("") +
      (hid.length ? `<div class="hid">${cap(hidW)} por un solo filtro: ${hid.join("; ")}.</div>` : "") +
      (missTxt.length ? `<div class="hid">Incluye ${missTxt.join(", ")}: un dato que falta pasa el filtro y se cuenta.</div>` : "") + `</div>`;
  }
  $("#count").innerHTML = head;
  const sp = ST.stripParts || [];
  strip.hidden = mode != null || !sp.length;
  strip.innerHTML = sp.length ? `${sp.map(([nm, n]) => `+${n0(n)} en ${esc(nm)}`).join(" y ")} sin punto propio: <u>ver</u>` : "";
  rows.sort(SORTERS[F.s]);
  // An unchanged list keeps its cards (a map move that changes nothing, a return from an Oferta); a new one starts at
  // 20 cards, or at the number shown when the reader last left this search.
  let h = rows.length;
  for (const [S, i] of rows) h = (h * 31 + S.id[i]) % 2147483647;
  const sig = `${mode?.type || ""}|${mode?.pn ?? ""}|${F.s}|${h}`;
  ST.rows = rows;
  if (!rows.length || sig !== ST.sig || !$("#cards .card")) {
    ST.shown = Math.min(rows.length, Math.max(20, ST.places.get(hashOf(F))?.shown || 0));
    if (!rows.length) {
      const opts = Object.entries(ST.hidden || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      $("#cards").innerHTML = `<div class="empty" data-t="ASKING"><p>${tag("ASKING")}Ningún aviso activo cumple estos filtros aquí.</p>${opts.length
        ? `<button class="btn" type="button" data-undo="${opts[0][0]}">Quitar ${BIT_NAME[opts[0][0]]} (+${n0(opts[0][1])})</button>` : F.mv ? "<p class=\"muted\">Mové o alejá el mapa.</p>" : ""}</div>`;
    } else $("#cards").innerHTML = rows.slice(0, ST.shown).map(([S, i], k) => card(S, i, k)).join("");
    ST.sig = sig;
  }
  more.hidden = ST.shown >= rows.length;
  more.textContent = `Ver ${Math.min(20, rows.length - ST.shown)} más`;
  const m = ST.data.meta;
  // Optional: an index.html cached from before #lfoot existed can meet this script for a few minutes after a deploy.
  const foot = $("#lfoot");
  if (foot) foot.hidden = false;
  $("#lstamp").innerHTML = `${tag("ASKING")}Un inmueble por fila: los avisos de un mismo inmueble cuentan una vez. Activos: vistos desde el ${fecha(m.windows.full)} ` +
    `(InfoCasas: desde el ${fecha(m.windows.facet)}). Fuentes: RE/MAX, InfoCasas, uProp, Coldwell Banker, Sotheby's, Prestige. Ningún orden se compra ni sale ` +
    `de la distancia a la estimación. Datos al ${fecha(m.data_at)}; precios en la moneda del aviso, USD a la tasa SET del ${fecha(m.fx.date)}.`;
  // The picker shows, and Mercado opens, the market with the most units in view.
  $("#pick-btn").textContent = marketName(ST.focus || F.m);
  updateNav({ mk: ST.focus || F.m, k: F.k !== "all" ? F.k : DEFAULTS.k, o: F.o });
  saveSearch();
  updateChips();
}
function moreCards() {
  const add = ST.rows.slice(ST.shown, ST.shown + 20).map(([S, i], k) => card(S, i, ST.shown + k)).join("");
  $("#cards").insertAdjacentHTML("beforeend", add);
  ST.shown = Math.min(ST.rows.length, ST.shown + 20);
  $("#more").hidden = ST.shown >= ST.rows.length;
  $("#more").textContent = `Ver ${Math.min(20, ST.rows.length - ST.shown)} más`;
}
function saveSearch() {
  if (!ST.F) return;
  ST.lastSearch = { hash: hashOf(ST.F), label: `${KIND_PL[ST.F.k] || "inmuebles"}${ST.F.o === "rent" ? " en alquiler" : ""}, ${ST.mk.get(ST.focus || ST.F.m)?.name || ""}` };
  store.set("tekoha-search", ST.lastSearch);
}
function light(ref, on) {
  if (!ref || !ST.cluster) return;
  const [S, i] = ref;
  if (!S.markers[i]) return;
  const vis = ST.cluster.getVisibleParent(S.markers[i]);
  const el = vis?._icon;
  if (el) el.classList.toggle("hot", on);
}
async function showBuscar(q) {
  const F = filtersFrom(q);
  const prev = ST.F;
  ST.F = F;
  $("#pick-btn").textContent = marketName(F.m);
  $("#mv").checked = F.mv;
  updateNav();
  if (!prev || prev.m !== F.m || prev.o !== F.o) ST.listMode = null;
  const mk = ST.mk.get(F.m), first = `${deptOf(F.m)}|${F.o}`;
  // The anchor market's shard starts beside the map's stylesheet; the view adds the departments around it once the map
  // exists. The market is only where the map goes: the view decides what the list holds.
  if (ST.data.meta.shards[first] && !ST.failed.has(first)) loadShard(first);
  if (!ST.map) { ST.loading = "loading"; ST.loadingNames = [ST.deptMk.get(deptOf(F.m))?.name || marketName(F.m)]; renderList(); }
  await leafletCss();
  if (ST.F !== F) return;
  ensureMap();
  ST.map.invalidateSize();
  // A search without a map view frames its whole market, whatever view the map kept from an earlier search.
  if (F.v) ST.map.setView([F.v[0], F.v[1]], F.v[2], { animate: false });
  else if (mk?.bbox) ST.map.fitBounds(mk.bbox, { animate: false, padding: [10, 10] });
  await refreshView(true);
}

// The filter panel: one section on a desktop chip, every section on a phone.
function chipLabel(f) {
  const F = ST.F;
  if (f === "tipo") return `${F.k === "all" ? "Todos los tipos" : kindLabel(F.k)}${F.o === "rent" ? ", alquiler" : ""}`;
  if (f === "precio") return F.p ? `USD ${F.p[0] != null ? shortK(F.p[0]) : "0"}-${F.p[1] != null ? shortK(F.p[1]) : "más"}` : "Precio";
  if (f === "tam") return F.a || F.b ? [F.a && `${F.a[0] ?? 0}${F.a[1] != null ? `-${F.a[1]}` : "+"} m2`, F.b && `${F.b}+ dorm`].filter(Boolean).join(", ") : "Tamaño";
  if (f === "conf") return F.t ? `Confianza: ${[...F.t].sort().map((i) => BANDS[i]).join(", ")}` : "Confianza: todas";
  if (f === "dias") return F.d ? `${F.d[0] ?? 0}-${F.d[1] ?? "más"} días` : "Días";
  if (f === "orden") return "Orden";
  return f;
}
const shortK = (x) => (x >= 1e6 ? `${n1(x / 1e6, 1)}M` : x >= 1e3 ? `${n0(x / 1e3)}k` : n0(x));
function activeCount() {
  const F = ST.F;
  return [F.p, F.a, F.b, F.d, F.t && !(F.t.size === 2 && F.t.has(0) && F.t.has(1)), F.k !== DEFAULTS.k, F.o !== "sale"].filter(Boolean).length;
}
function updateChips() {
  const F = ST.F;
  for (const c of $$("#fbar .chip.dk")) {
    c.textContent = chipLabel(c.dataset.f);
    c.classList.toggle("on", (c.dataset.f === "precio" && !!F.p) || (c.dataset.f === "tam" && !!(F.a || F.b)) || (c.dataset.f === "dias" && !!F.d)
      || c.dataset.f === "tipo" || (c.dataset.f === "conf" && !!F.t));
  }
  const n = activeCount();
  $("#fbar .chip.ph[data-f=all]").textContent = n ? `Filtros (${n})` : "Filtros";
}
function closePanel() { const p = $("#fpanel"); if (p) { p.hidden = true; p.dataset.sec = ""; } }
function openPanel(sec, anchor) {
  const P = $("#fpanel");
  if (!P.hidden && P.dataset.sec === sec) { closePanel(); return; }
  P.dataset.sec = sec;
  renderPanel(sec);
  P.hidden = false;
  if (anchor && window.innerWidth >= 900) {
    const r = anchor.getBoundingClientRect();
    P.style.left = `${Math.min(r.left, window.innerWidth - P.offsetWidth - 16)}px`;
  } else P.style.left = "";
}
function kindCounts() {
  const m = ST.data.mercado[ST.focus || ST.F.m]?.[ST.F.o] || {};
  return Object.entries(m).map(([k, v]) => [k, v.act.n]).sort((a, b) => b[1] - a[1]);
}
const panelCount = () => `${tag("ASKING")}${kindN((ST.listed || []).length, ST.F.k)} con estos filtros${ST.F.mv ? " en el mapa" : ""}`;
function renderPanel(sec) {
  const F = ST.F, all = sec === "all", on = (s) => all || s === sec;
  const pair = (id, label, unit, vals) => `<div class="rng"><input id="${id}0" inputmode="numeric" placeholder="desde" aria-label="${label} desde${unit}" value="${vals?.[0] ?? ""}"><span>a</span>` +
    `<input id="${id}1" inputmode="numeric" placeholder="hasta" aria-label="${label} hasta${unit}" value="${vals?.[1] ?? ""}"></div>`;
  let h = "";
  if (on("tipo")) {
    const kinds = kindCounts();
    const opt = (k, label, n) => `<label class="${F.k === k ? "on" : ""}"><input type="radio" name="f-k" value="${k}"${F.k === k ? " checked" : ""}> ${esc(label)}${n != null ? ` <span class="muted">${n0(n)}</span>` : ""}</label>`;
    h += `<div class="fsec" data-t="ASKING"><h3>${tag("ASKING")}Tipo, inmuebles ${OPN[F.o]} activos en ${esc(marketName(ST.focus || F.m))}</h3><div class="opts">${kinds.map(([k, n]) => opt(k, kindLabel(k), n)).join("")}${opt("all", "Todos", kinds.reduce((a, x) => a + x[1], 0))}</div>` +
      `<h3 style="margin-top:12px">Operación</h3><div class="opts">${["sale", "rent"].map((o) => `<label class="${F.o === o ? "on" : ""}"><input type="radio" name="f-o" value="${o}"${F.o === o ? " checked" : ""}> ${o === "sale" ? "Venta" : "Alquiler"}</label>`).join("")}</div></div>`;
  }
  if (on("precio")) {
    h += `<div class="fsec"><h3>Precio pedido, USD${F.o === "rent" ? " por mes" : ""}</h3>${pair("f-p", "Precio pedido", ", en USD", F.p)}<p class="fnote" id="f-pgs" data-nofig></p>` +
      `<p class="fnote" data-nofig>Los pedidos en guaraníes se pasan a USD a la tasa SET del ${fecha(ST.data.meta.fx.date)}. Un aviso sin precio leído pasa y se cuenta.</p></div>`;
  }
  if (on("tam")) {
    const basis = F.k === "terreno" ? "de terreno" : "construidos (terreno si no hay)";
    h += `<div class="fsec"><h3>Superficie, m2 ${basis}</h3>${pair("f-a", "Superficie", ", en m2", F.a)}` +
      (F.k !== "terreno" ? `<h3 style="margin-top:12px">Dormitorios</h3><div class="opts" data-nofig>${[0, 1, 2, 3, 4].map((b) => `<label class="${(F.b || 0) === b ? "on" : ""}"><input type="radio" name="f-b" value="${b}"${(F.b || 0) === b ? " checked" : ""}> ${b ? `${b} o más` : "Cualquiera"}</label>`).join("")}</div>` : "") +
      `<p class="fnote">Un aviso sin el dato pasa y se cuenta.</p></div>`;
  }
  if (on("conf")) {
    const cut = ST.data.meta.trust?.cut || [70, 45];
    h += `<div class="fsec"><h3>Confianza en el aviso</h3><div class="opts">${BANDS.map((b, i) => {
      const c = !F.t || F.t.has(i);
      return `<label class="${c ? "on" : ""}"><input type="checkbox" name="f-t" value="${i}"${c ? " checked" : ""}> ${b}</label>`;
    }).join("")}</div><p class="fnote" data-nofig>Regla de puntos publicada: alta desde ${cut[0]}, media de ${cut[1]} a ${cut[0] - 1}, baja por debajo de ${cut[1]}. ` +
      `Sin datos: el inmueble ya tiene un cierre reportado, o la regla no vio el aviso activo; sigue entre los activos mientras el portal lo publica y la captura lo ve. Por defecto, alta y media.</p></div>`;
  }
  if (on("dias")) {
    h += `<div class="fsec"><h3>Días publicado</h3>${pair("f-d", "Días publicado", "", F.d)}<p class="fnote">Desde la fecha de publicación del portal, solo donde esa fecha es propia del aviso (no una carga en bloque). Un aviso sin fecha confiable pasa y se cuenta.</p></div>`;
  }
  if (sec === "orden") {
    h += `<div class="fsec"><h3>Orden</h3><div class="opts">${Object.entries(SORTS).map(([k, t]) => `<label class="${F.s === k ? "on" : ""}"><input type="radio" name="f-s" value="${k}"${F.s === k ? " checked" : ""}> ${t}</label>`).join("")}</div>` +
      `<p class="fnote">Nunca por pago ni por la distancia a la estimación.</p></div>`;
  }
  h += `<div class="fbtns"><p class="fcount" data-t="ASKING">${panelCount()}</p><button class="btn" type="button" data-clear>Limpiar</button><button class="btn gold" type="button" data-close>Ver la lista</button></div>`;
  const P = $("#fpanel");
  P.innerHTML = h;
  const gs = () => {
    const el = $("#f-pgs");
    if (!el) return;
    const r = ST.data.meta.fx.rate, a = +$("#f-p0").value || null, b = +$("#f-p1").value || null;
    el.textContent = a || b ? `En guaraníes: ${a ? money(a * r, "PYG") : "Gs 0"} a ${b ? money(b * r, "PYG") : "sin tope"}.` : "";
  };
  gs();
  P.oninput = (e) => { if (e.target.id?.startsWith("f-p")) gs(); };
  P.onchange = () => applyPanel();
  P.onclick = (e) => {
    if (e.target.closest("[data-close]")) closePanel();
    if (e.target.closest("[data-clear]")) { ST.F = { ...filtersFrom(new URLSearchParams(`m=${F.m}&k=${F.k}`)), v: F.v, o: F.o }; afterFilter(); closePanel(); }
  };
}
async function applyPanel() {
  const F = { ...ST.F }, P = $("#fpanel");
  const val = (id) => { const el = $(`#${id}`, P); if (!el) return undefined; const v = el.value.replace(/[^0-9]/g, ""); return v === "" ? null : +v; };
  const pair = (a, b, old) => { const x = val(a), y = val(b); if (x === undefined && y === undefined) return old; return x == null && y == null ? null : [x, y]; };
  const k = $("input[name=f-k]:checked", P);
  if (k) F.k = k.value;
  const o = $("input[name=f-o]:checked", P);
  if (o && o.value !== F.o) { F.o = o.value; F.v = ST.F.v; }
  F.p = pair("f-p0", "f-p1", F.p);
  F.a = pair("f-a0", "f-a1", F.a);
  F.d = pair("f-d0", "f-d1", F.d);
  const b = $("input[name=f-b]:checked", P);
  if (b) F.b = +b.value || null;
  const ts = $$("input[name=f-t]", P);
  if (ts.length) { const set = new Set(ts.filter((x) => x.checked).map((x) => +x.value)); F.t = set.size === 4 ? null : set; }
  const s = $("input[name=f-s]:checked", P);
  if (s) F.s = s.value;
  const opChanged = F.o !== ST.F.o;
  ST.F = F;
  if (opChanged) { location.hash = hashOf(F); return; }
  // The panel is not redrawn: a redraw would take the focus from the field the reader just moved to.
  for (const inp of $$("input[type=radio], input[type=checkbox]", P)) inp.closest("label")?.classList.toggle("on", inp.checked);
  await afterFilter();
  const fc = $(".fcount", P);
  if (fc) fc.innerHTML = panelCount();
}
async function afterFilter() {
  history.replaceState(null, "", hashOf(ST.F));
  ST.listMode = null;
  await refreshView(true);
}
function wireBuscar() {
  $("#fbar").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    e.stopPropagation();
    if (c.id === "listbtn") {
      document.body.classList.toggle("listmode");
      c.textContent = document.body.classList.contains("listmode") ? "Mapa" : "Lista";
      if (!document.body.classList.contains("listmode")) ST.map.invalidateSize();
      return;
    }
    openPanel(c.dataset.f, c);
  });
  $("#fpanel").addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => { if (!e.target.closest("#fpanel") && window.innerWidth >= 900) closePanel(); });
  $("#mv").addEventListener("change", (e) => { ST.F.mv = e.target.checked; afterFilter(); });
  $("#more").addEventListener("click", moreCards);
  $("#strip").addEventListener("click", () => { ST.listMode = { type: "unplaced" }; renderList(); if (window.innerWidth < 900) document.body.classList.add("listmode"); });
  $("#listpane").addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) { ST.failed.clear(); refreshView(true); return; }
    if (e.target.closest("[data-back]")) { ST.listMode = null; renderList(); }
    if (e.target.closest("[data-i]")) {
      ST.countOpen = !ST.countOpen;
      $("#count .det")?.classList.toggle("open", ST.countOpen);
      e.target.closest("[data-i]").setAttribute("aria-expanded", String(ST.countOpen));
    }
    const f = e.target.closest("[data-f]");
    if (f) { e.stopPropagation(); openPanel(f.dataset.f, f); }
    const u = e.target.closest("[data-undo]");
    if (u) {
      const bit = +u.dataset.undo, F = { ...ST.F };
      if (bit === 2) F.p = null; if (bit === 4) F.a = null; if (bit === 8) F.b = null; if (bit === 16) F.t = null; if (bit === 64) F.d = null;
      ST.F = F; afterFilter();
    }
  });
  $("#cards").addEventListener("mouseover", (e) => {
    const c = e.target.closest(".card");
    const ref = c ? ST.rows[+c.dataset.r] : null;
    if (ref === ST.hot) return;
    light(ST.hot, false); ST.hot = ref; light(ref, true);
  });
  $("#cards").addEventListener("mouseleave", () => { light(ST.hot, false); ST.hot = null; });
}

// ---------------------------------------------------------------------------------------------
// Oferta.
// ---------------------------------------------------------------------------------------------
// Version strings live here only, in the method footnote; the copy above it names the rule and the model in words.
const methodHtml = (meta) => `<p><b>Confianza en el aviso${meta.trust?.version ? ` (regla ${esc(meta.trust.version)})` : ""}.</b> Una regla de puntos publicada, no un modelo: parte de 50 y cada señal suma o resta a la vista (precio plausible, punto propio, otro corredor, recortes, antigüedad sin recortes, reaparición, texto que describe otra cosa, el historial del vendedor). Una respuesta del anunciante fija la banda: el aviso confirmado en los últimos 30 días, alta; ya no disponible, baja. Alta separa resultados en RE/MAX; baja es el juicio de la regla, no un resultado medido.</p>` +
  `<p><b>Estimación Tekoha${meta.est?.version ? ` (modelo ${esc(meta.est.version)})` : ""}.</b> Un modelo de precio de cierre entrenado con cierres reportados por la red RE/MAX, sin mirar el precio pedido. Su error se mide en los cierres del último año, cada uno estimado solo con cierres anteriores; el rango es la banda del 80% de esa prueba para su segmento y su tipo de ubicación. Donde el modelo no le gana a una regla simple por m2, o la superficie del aviso cae fuera del 5% al 95% de su tipo, no publica y dice por qué. La solidez de 0 a 100 resume el ancho de esa banda.</p>` +
  `<p><b>Rango de oferta, regla práctica.</b> El precio pedido menos la rebaja medida en cierres de su tipo en su departamento (misma moneda, mínimo 30), entre su percentil 25 y su mediana; el percentil 10 si lleva más días publicado que el 75% de su tipo o tiene dos recortes o más; acotado por el rango del 80% de la estimación cuando esta se compara con el pedido. Sin rango si la confianza es baja, el pedido o la superficie no son plausibles o hay menos de 30 cierres.</p>` +
  `<p><b>Cierres reportados.</b> Paraguay no tiene MLS ni registro público de precios de venta. Los cierres son los que informa la red RE/MAX: misma moneda que su pedido, uno por operación, dentro de 0,4 a 1,6 veces el pedido.</p>` +
  `<p><b>Catastro.</b> El lote del registro que contiene el punto del aviso. Si ese lote tiene más de diez veces el terreno del aviso, o es una casa sin edificación en el registro, es el lote que contiene el punto (un lote madre, por ejemplo), no la cuenta de este inmueble, y su valor fiscal no se pone al lado del pedido.</p>`;
function compsWhyText(d) {
  const w = d.comps.why, kp = KIND_PL[d.kind] || "inmuebles";
  if (w === "pin") return `El portal no publica dónde está este aviso: lo ubica en su punto genérico para ${d.point.prec === "barrio" ? "el barrio" : "la ciudad"}, así que "cerca" no significa nada: no mostramos cierres.`;
  if (w === "off") return "El punto del portal cae fuera del departamento que declara, y no sabemos cuál de los dos está mal: no mostramos cierres cercanos.";
  if (w === "none") return "Sin coordenadas para este aviso: no hay cierres cercanos que mostrar.";
  if (w === "kind") return "El portal no declara el tipo de inmueble: no hay cierres del mismo tipo que comparar.";
  if (w === "empty") return `Ningún cierre reportado de ${kp} ${OPN[d.op]} a menos de ${n0(ST.data.meta.comps.meters)} m en los últimos ${ST.data.meta.comps.months} meses.`;
  return "";
}
function account(c) {
  const rural = /^([A-Z])(\d{2})-P(\d+)$/.exec(c.key), urban = /^[A-Z]\d{2}(\d{2,})(\d{4})(\d{3})$/.exec(c.key);
  return c.src === "asuncion" ? `Cta. cte. ctral. ${c.key.slice(2)}` : rural ? `Padrón ${rural[3]}` : urban ? `Cta. cte. ctral. ${+urban[1]}-${urban[2]}-${String(+urban[3]).padStart(2, "0")}` : c.key;
}
const window2 = (first, last) => (first ? ` del ${fecha(first)} al ${fecha(last)}` : "");
function offerSentences(d) {
  const o = d.offer, cur = o.cur, meta = ST.data.meta;
  const s = [[null, `Regla práctica sobre cierres medidos, no un pronóstico.`]];
  s.push(["ASKING", `${tag("ASKING")}Precio pedido: ${money(d.ask.p, d.ask.cur)}.`]);
  s.push(["CLOSED", `${tag("CLOSED")}Rebaja medida en ${cierres(o.n)} de ${esc(o.scope)}${window2(o.first, o.last)}, en la misma moneda que su pedido: percentil ${o.pl}, ${spct(o.ql)}; mediana, ${spct(o.qh)}` +
    `${o.ql === 0 && o.qh === 0 ? ", los dos en cero porque más de la mitad de esos cierres fue al precio pedido" : ""}.`]);
  if (o.widen?.length) s.push(["ASKING", `${tag("ASKING")}Percentil ${o.pl} en lugar del 25 porque ${esc(o.widen.join(" y "))}.`]);
  const b = o.bound || {}, er = b.elo != null ? `USD ${n0(b.elo)} a USD ${n0(b.ehi)}` : "";
  if (b.k === "inside") s.push(["ESTIMATE", `${tag("ESTIMATE")}El rango queda dentro del rango del 80% de la Estimación Tekoha (${er}).`]);
  else if (b.k === "clip") s.push(["ESTIMATE", `${tag("ESTIMATE")}Acotado ${b.moved.join(" y ")} por el rango del 80% de la Estimación Tekoha (${er}${cur === "PYG" ? ", pasado a guaraníes a la tasa de su corrida" : ""}).`]);
  else if (b.k === "below") s.push(["ESTIMATE", `${tag("ESTIMATE")}Todo el rango queda por debajo del de la Estimación Tekoha (${er}), que no sube una oferta por encima de lo que da el pedido.`]);
  else if (b.k === "nocmp") s.push([null, "Sin acotar por la Estimación Tekoha: no se compara con este pedido (la sección de la estimación dice por qué)."]);
  else s.push([null, "Sin Estimación Tekoha que lo acote."]);
  s.push([cur === "PYG" ? "OFICIAL" : null, `${cur === "PYG" ? tag("OFICIAL") : ""}Redondeado a tres cifras${cur === "PYG" ? `; en USD a la tasa SET del ${fecha(meta.fx.date)} (Gs ${n0(meta.fx.rate)})` : ""}.`]);
  return s.map(([t, x]) => `<p${t ? ` data-t="${t}"` : ""}>${x}</p>`).join("");
}
// The abstention's reason in a few words for the phone's ¿Cierra? row; the full sentence is in the section below.
function shortWhy(t) {
  const s = String(t || "");
  const area = /^([\d.]+) m2 .*no es plausible/.exec(s);
  if (area) return `${area[1]} m2 no es plausible`;
  if (/no le gana|no supera/.test(s)) return `${/sin ubicación propia/.test(s) ? "sin punto propio, " : ""}no le gana a la regla por m2`;
  if (/para entrenar/.test(s)) return "pocos cierres para entrenar";
  if (/de prueba/.test(s)) return "pocos cierres de prueba";
  if (/no cubre/.test(s)) return "el modelo no cubre este tipo";
  if (/no hay cierres/.test(s)) return "sin cierres de su tipo aquí";
  if (/departamento que declara/.test(s)) return "punto fuera de su departamento";
  if (/superficie/.test(s)) return "sin superficie utilizable";
  return "la razón, abajo";
}
const negText = (neg) => `mediana ${medVsAsk(neg.p50)}; ${atAsk(neg)} (${n0(neg.at)} de ${n0(neg.n)}); ${belowMed(neg)}`;
function catSection(c, kind) {
  if (!c) return "";
  const place = `${account(c)}${c.district ? `, ${c.district}` : ""}`;
  if (c.mother) {
    const head = c.mother === "land" ? `Lote madre: la cuenta catastral cubre ${n0(c.land)} m2, no este inmueble`
      : `Lote del punto: la cuenta catastral no registra edificación, no es la de esta casa`;
    const why = c.mother === "land" ? `El punto del aviso cae en un lote del registro de ${n0(c.land)} m2, más de diez veces los ${n0(c.adland)} m2 de terreno del aviso: es el lote que contiene el punto, no la cuenta de este inmueble.`
      : "El punto del aviso cae en un lote sin edificación en el registro: es el lote que contiene el punto (un lote madre o una casa sin inscribir), no la cuenta de esta casa.";
    return `<section class="sec" id="o-cat" data-t="OFICIAL"><h2>${tag("OFICIAL")}Catastro</h2><p><b>${esc(head)}.</b></p><p>${esc(why)} Su valor fiscal no se compara con el precio pedido.</p>` +
      `<div class="tbl"><table><tbody><tr><th>Lote que contiene el punto</th><td style="white-space:normal">${esc(place)}</td></tr><tr><th>Lote (registro)</th><td>${n0(c.land)} m2</td></tr></tbody></table></div>` +
      `<p class="stamp">${tag("OFICIAL")}${c.src === "asuncion" ? "Municipalidad de Asunción, tabla de abril de 2025" : "SNC"}. Pedí la cuenta catastral del inmueble para ver su lote y su valor fiscal.</p></section>`;
  }
  const rows = [["Cuenta", place],
    ...(c.coprop ? [["Régimen", "copropiedad: una cuenta por unidad"]] : [["Lote (registro)", c.land ? `${n0(c.land)} m2` : null], ["Edificado (registro)", c.built ? `${n0(c.built)} m2` : c.lv != null ? "sin edificación" : null],
      ["Valor fiscal", c.lv != null ? `${money(c.lv, "PYG")} terreno${c.bv > 0 ? `, ${money(c.bv, "PYG")} edificación` : ""}` : "sin valor en el registro"]]),
    ["Zona", [c.zone ? `impositiva ${c.zone}` : null, c.use ? `Plan Regulador ${c.use}` : null].filter(Boolean).join(", ") || null]];
  return `<section class="sec" id="o-cat" data-t="OFICIAL"><h2>${tag("OFICIAL")}Catastro</h2><div class="tbl"><table><tbody>` +
    rows.filter(([, v]) => v).map(([k, v]) => `<tr><th>${esc(k)}</th><td style="white-space:normal">${esc(v)}</td></tr>`).join("") + `</tbody></table></div>` +
    (c.mism?.length ? `<p>No coinciden: ${esc(c.mism.join("; "))}.</p>` : "") +
    `<p class="stamp">${tag("OFICIAL")}${c.src === "asuncion" ? "Municipalidad de Asunción, tabla de abril de 2025" : c.year ? `SNC; valores del padrón fiscal ${c.year} de la DNIT` : "SNC"}. ` +
    `Base del impuesto inmobiliario, no un precio ni una tasación. El punto del aviso cae en este lote${["departamento", "oficina", "local", "duplex"].includes(kind) ? ", el del edificio, no la unidad" : ""}.</p></section>`;
}
async function showOferta(id) {
  const V = $("#v-oferta");
  window.scrollTo(0, 0);
  V.innerHTML = `<div class="wrap"><div class="otop"><span class="muted">Cargando el aviso</span></div><div class="sk"></div><div class="sk"></div></div>`;
  const back = ST.lastSearch || store.get("tekoha-search");
  const backLink = (fallback) => `<a href="${back?.hash || fallback}">&lsaquo; Buscar${back?.label ? ` (${esc(back.label)})` : ""}</a>`;
  let d;
  try { d = await getJSON(`l/${encodeURIComponent(id)}.json`); }
  catch (e) {
    if (parseHash().id !== id) return;
    const meta = ST.data.meta;
    // Only a 404 says the listing is not in today's index; any other failure is ours, and says so.
    V.innerHTML = e.status === 404
      ? `<div class="wrap"><div class="otop">${backLink("#/buscar")}</div><div class="sec"><h2>No encontramos ese aviso</h2>` +
        `<p data-nofig>No está entre los avisos activos de la captura del ${fecha(meta.data_at)} en Asunción, Central, Alto Paraná e Itapúa.</p></div></div>`
      : `<div class="wrap"><div class="otop">${backLink("#/buscar")}</div><div class="sec"><h2>No se pudo cargar el aviso</h2>` +
        `<p>Puede ser la conexión. <button class="btn" type="button" id="oretry">Reintentar</button></p></div></div>`;
    $("#oretry")?.addEventListener("click", () => showOferta(id));
    return;
  }
  if (parseHash().id !== id) return;
  $("#pick-btn").textContent = marketName(d.place.mk);
  updateNav({ mk: d.place.mk, k: d.kind, o: d.op });
  const backHtml = backLink(`#/buscar?m=${d.place.mk}${d.op === "rent" ? "&o=rent" : ""}&k=${d.kind}`);
  const meta = ST.data.meta, kind = d.kind;
  const title = `${KIND[kind] || "Inmueble"} ${OPN[d.op]}${d.place.barrio ? `, ${d.place.barrio}` : ""}, ${d.place.city || d.place.dept}`;
  const f = d.facts;
  const factLine = [f.m2 > 0 ? `${n0(f.m2)} m2 ${BASIS_W[f.basis] || BASIS_W.unknown}` : null, f.land > 0 && f.basis !== "land" ? `${n0(f.land)} m2 de terreno` : null,
    f.beds > 0 && kind !== "terreno" ? `${n0(f.beds)} dorm.` : null, f.baths > 0 && kind !== "terreno" ? `${n0(f.baths)} ${f.baths === 1 ? "baño" : "baños"}` : null].filter(Boolean).join(", ");
  // The phone keeps the facts on one line: area on its basis, land, bedrooms.
  const factShort = [f.m2 > 0 ? `${n0(f.m2)} m2${f.basis === "built" ? " constr." : f.basis === "land" ? " terreno" : f.basis === "total" ? " totales" : ""}` : null,
    f.land > 0 && f.basis !== "land" ? `${n0(f.land)} m2 terreno` : null, f.beds > 0 && kind !== "terreno" ? `${n0(f.beds)} dorm.` : null].filter(Boolean).join(", ");
  const a = d.ask;
  const priceBig = a.p != null ? money(a.p, a.cur) : a.site != null ? `USD ${n0(a.site)}` : "Sin precio publicado";
  const cutsW = (n) => nOf(n, "recorte", "recortes");
  const priceShort = [a.p != null && a.cur === "PYG" ? `USD ${n0(a.usd)}` : a.p == null && a.site != null ? "según el portal" : null,
    a.days != null ? `${dias(a.days)} publicado` : "sin fecha confiable", a.cuts.length ? cutsW(a.cuts.length) : "sin recortes",
    a.ads > 1 ? `${a.ads} avisos` : null].filter(Boolean);
  const priceSub = [a.p != null && a.cur === "PYG" ? `USD ${n0(a.usd)} a la tasa SET del ${fechaC(meta.fx.date)}` : a.p == null && a.site != null ? "según el portal: no leímos el precio en la moneda del aviso" : null,
    a.days != null ? `${dias(a.days)} publicado${a.pc ? `, más que el ${a.pc[0]}% de ${kindArt(kind)} en venta ${act(kind)} en ${esc(a.pc[2])} (n ${n0(a.pc[1])})` : ""}` : "sin fecha de publicación confiable",
    a.cuts.length ? `${cutsW(a.cuts.length)} desde el ${fechaC(meta.history_start)} (${spct(a.depth)}, el último el ${fechaC(a.cuts.at(-1)[0])})` : `sin recortes vistos desde el ${fechaC(meta.history_start)}`,
    a.relist ? "volvió a publicarse" : null, a.ads === 1 ? "1 aviso" : `${a.ads} avisos del mismo inmueble`].filter(Boolean);
  const o = d.offer;
  const gsM = (x) => `${n0(x / 1e6)}M`;
  const oScope = esc(String(o.scope || "").replace(" en venta", ""));
  // The range comes from closes: it wears CIERRE with its n and window on the hero itself.
  const offerHtml = o.lo != null
    ? `<div class="offer" data-t="CLOSED"><div class="lab">${tag("CLOSED")}Rango de oferta<span class="dk">, regla práctica</span></div>` +
      `<div class="fig${o.cur === "PYG" ? " dk" : ""}">${o.lo >= o.hi ? money(o.hi, o.cur) : `${money(o.lo, o.cur)} a ${money(o.hi, o.cur)}`}</div>` +
      (o.cur === "PYG" ? `<div class="fig ph">Gs ${o.lo >= o.hi ? gsM(o.hi) : `${gsM(o.lo)} a ${gsM(o.hi)}`}</div><div class="usd">USD ${n0(o.lo / meta.fx.rate)} a USD ${n0(o.hi / meta.fx.rate)}</div>` : "") +
      `<div class="rule">regla práctica sobre ${cierres(o.n)} de ${oScope}${window2(o.first, o.last)}; no un pronóstico</div></div>`
    : `<div class="offer none" data-t="CLOSED"><div class="lab">${tag("CLOSED")}Rango de oferta</div><div class="rule"><b>Sin rango de oferta:</b> ${esc(o.none)}</div></div>`;
  const own = d.ads.find((x) => x[2]) || null;
  const ownBtn = own ? `<a class="btn gold" href="${esc(own[2])}" target="_blank" rel="nofollow noopener">Ver el aviso en ${esc(SRC[own[0]] || own[0])}</a>` : `<span class="btn" aria-disabled="true">El portal no da un enlace al aviso</span>`;
  const t = d.trust;
  const e = d.est;
  const sk = (x) => (x >= 1e6 ? `${n1(x / 1e6, 1)}M` : `${n0(x / 1e3)}k`);
  // Each row prints its figure and, on one small line, what makes it readable: range, error and n; the rest of the triple.
  const estRow = e.e != null
    ? `${tag("ESTIMATE")}<b class="est">USD ${n0(e.e)}</b><small><span class="dk">rango del 80% USD ${n0(e.lo)} a USD ${n0(e.hi)}${e.err != null ? `, error ${pct(e.err)}, n ${n0(e.n)}` : ", sin error medido para su tipo de ubicación"}</span>` +
      `<span class="ph">(${sk(e.lo)} a ${sk(e.hi)}${e.err != null ? `, error ${pct(e.err)}, n ${n0(e.n)}` : ", sin error medido"})</span></small>`
    : `${tag("ESTIMATE")}<b><span class="dk">Sin Estimación Tekoha:</span><span class="ph">Sin estimación:</span></b><small><span class="dk">${esc(e.none)}</span><span class="ph">${esc(shortWhy(e.none))}</span></small>`;
  const ng = d.neg;
  const negRow = ng ? `${tag("CLOSED")}<b class="cl">mediana ${medVsAsk(ng.p50)}</b><small><span class="dk">${atAsk(ng)}; ${belowMed(ng)}; ${cierres(ng.n)} de ${esc(ng.scope)}</span>` +
      `<span class="ph">${atAsk(ng)}; n ${n0(ng.n)}</span></small>`
    : `${tag("CLOSED")}<b>Sin dato</b><small>menos de ${meta.min.spread} cierres en la misma moneda para su tipo, ni en Paraguay</small>`;
  // A seller's reply sets the band whatever the points add up to: the page says that first.
  const ov = t?.override ? [t.override.slice(0, t.override.indexOf(": ")), t.override.slice(t.override.indexOf(": ") + 2)] : null;
  const realRow = !t ? "<b>sin confianza calculada</b>"
    : ov ? `<b>${esc(t.band)}</b> por regla<small class="rule">${esc(ov[1])}</small>`
    : `<b>${esc(t.band)}</b>${t.score != null ? `, ${t.score} de 100` : ""}<small class="rule">confianza en el aviso, regla de puntos</small>`;
  const reasons = t ? `<ul>${t.reasons.map(([txt, pts]) => `<li>${esc(txt)}${pts ? `<span class="pts">(${pts > 0 ? "+" : ""}${pts})</span>` : ""}</li>`).join("")}</ul>` : "";
  const cut = meta.trust?.cut || [70, 45];
  const cal = meta.trust?.calib;
  const calTxt = cal ? `Medido en los avisos de RE/MAX activos al ${fecha(cal.as_of)} (la única fuente que informa cierres y bajas): en los ${cal.days} días siguientes tuvo un cierre, un recorte o una baja ` +
    `el ${pct(cal.alta?.[1])} de los de confianza alta (n ${n0(cal.alta?.[0])}), el ${pct(cal.media?.[1])} de media (n ${n0(cal.media?.[0])}) y el ${pct(cal.baja?.[1])} de baja (n ${n0(cal.baja?.[0])}). ` +
    `Alta separa resultados en RE/MAX; baja es el juicio de la regla, no un resultado medido.` : "";
  const ruleLine = `regla de puntos publicada: alta desde ${cut[0]}, media de ${cut[1]} a ${cut[0] - 1}, baja por debajo de ${cut[1]}`;
  const realSec = !t ? `<p class="rule">Sin confianza calculada: el aviso no está en la última corrida de la regla de puntos.</p>`
    : (ov ? `<p class="rule"><b>${esc(ov[0])}:</b> ${esc(ov[1])}.</p><p>Suma de puntos${t.score != null ? `: ${t.score} de 100` : ""}; ${ruleLine}, salvo una respuesta del anunciante.</p>`
      : `<p class="rule"><b>${esc(t.band)}</b>${t.score != null ? `, ${t.score} de 100` : ""}: ${ruleLine}.</p>`) + reasons;
  const cmp = d.cmp;
  const gap = e.e != null ? (cmp?.pct != null
    ? `<p data-t="ESTIMATE">${tag("ESTIMATE")}Precio pedido ${n1(Math.abs(cmp.pct), 0)}% ${cmp.pct >= 0 ? "sobre" : "bajo"} la Estimación Tekoha, ${cmp.inside ? "dentro" : "fuera"} de su rango del 80% (el pedido en USD a la tasa de la corrida: USD ${n0(cmp.usd)}).</p>`
    : `<p class="muted" data-t="ESTIMATE">${tag("ESTIMATE")}Sin comparación con el precio pedido: ${esc(cmp?.none || "")}.</p>`) : "";
  const modeTxt = { exact: "con el punto del aviso", city: "solo con la ciudad y el departamento", shared_point: "solo con la ciudad y el departamento, porque el punto lo comparten 10 o más avisos", none: "solo con la ciudad y el departamento, porque el aviso no tiene coordenadas", barrio: "con el barrio" };
  const estSec = e.e != null
    ? `<div data-t="ESTIMATE"><p>${tag("ESTIMATE")}Estimación Tekoha del ${d.op === "rent" ? "alquiler mensual de cierre" : "precio de cierre"}, sin mirar el precio pedido: <b class="est">USD ${n0(e.e)}</b>.</p>` +
      `<p>Rango del 80%: USD ${n0(e.lo)} a USD ${n0(e.hi)}. Error medido en ${esc(e.seg)} ${modeTxt[e.mode] ? `${modeTxt[e.mode]}` : ""}: ${e.err != null ? `${pct(e.err)} de error absoluto mediano en ${cierres(e.n)} de prueba` : "no está en la última corrida"}.</p>` +
      `<p class="stamp">${tag("ESTIMATE")}Corrida del ${fecha(e.run)}, en USD a la tasa SET de su corrida; entrenada con cierres reportados por la red RE/MAX; cada cierre de prueba estimado solo con cierres anteriores a él.${e.conf != null ? ` Solidez de la estimación: ${e.conf} de 100, según el ancho de esa banda.` : ""} No es un precio ni una tasación.</p></div>` + gap
    : `<div data-t="ESTIMATE"><p>${tag("ESTIMATE")}<b>Sin Estimación Tekoha:</b> ${esc(e.none)}.</p><p class="stamp">${tag("ESTIMATE")}La estimación es la única cifra modelada; solo se muestra con su rango y el error medido de su segmento.</p></div>`;
  const comps = d.comps.rows || [];
  const compsTbl = comps.length ? `<div class="cmap" id="cmap"></div><div class="tbl"><table><thead><tr><th>#</th><th>Fecha</th><th class="num">Cierre reportado</th><th class="num">vs. pedido</th><th>Superficie</th>${kind !== "terreno" ? "<th class=\"num\">Dorm.</th>" : ""}<th class="num">Distancia</th><th>MLS</th></tr></thead><tbody>` +
    comps.map((c, k) => {
      const cur = c[2] ? "PYG" : "USD", flags = c[5];
      const vs = flags & 2 ? "en otra moneda" : c[4] == null ? "-" : `${spct(c[4])}${flags & 1 ? "<small>al precio pedido</small>" : ""}`;
      return `<tr><td>${k + 1}</td><td>${fecha(c[0])}</td><td class="num">${moneyClose(c[1], cur)}${c[13] > 1 ? ` x${c[13]}` : ""}${cur === "PYG" ? `<small>${usdRounded(c[3])}</small>` : ""}</td><td class="num">${vs}${flags & 4 ? "<small>revisar</small>" : ""}</td>` +
        `<td>${c[6] ? `${n0(c[6])} m2 ${c[7] === 0 ? "constr." : "terreno"}` : "-"}</td>${kind !== "terreno" ? `<td class="num">${c[8] ?? "-"}</td>` : ""}<td class="num">${n0(c[9])} m</td><td>${esc(c[12] || "-")}</td></tr>`;
    }).join("") + `</tbody></table></div>` : `<p>${esc(compsWhyText(d))}</p>`;
  const m2 = d.comps.m2, unitW = d.comps.abasis === "built" ? "construido" : "de terreno", rentW = d.op === "rent" ? " al mes" : "";
  const perM2 = comps.length && d.comps.abasis ? (d.comps.askm2 != null ? `<p data-t="ASKING">${tag("ASKING")}Este aviso pide USD ${n0(d.comps.askm2)} por m2 ${unitW}${rentW}.</p>` : "") +
    `<p>${tag("CLOSED")}${m2?.med != null ? `Mediana de ${n0(m2.n)} cierres parecidos cerca: USD ${d.op === "rent" ? n1(m2.med, 1) : n0(m2.med)} por m2 ${unitW}${rentW}.` : `${m2?.n ? `Solo ${n0(m2.n)} ${m2.n === 1 ? "cierre parecido" : "cierres parecidos"}` : "Ningún cierre parecido"} cerca: sin mediana por m2 (mínimo ${meta.min.closes}).`}</p>` : "";
  const hist = d.hist.length ? `<div class="tbl"><table><thead><tr><th>Fecha</th><th>Evento</th><th class="num">Precio pedido</th><th class="num">Cambio</th><th>Fuente</th></tr></thead><tbody>` +
    d.hist.map((h) => `<tr><td>${fecha(h[0])}</td><td>${esc(h[1])}</td><td class="num">${h[2] != null ? money(h[2], h[3]) : "-"}</td><td class="num">${h[4] != null ? spct(h[4]) : ""}${h[5] ? `<small>${esc(h[5])}</small>` : ""}</td><td>${esc(h[6])}</td></tr>`).join("") +
    `</tbody></table></div>${d.more ? `<p class="muted">${n0(d.more)} filas más antiguas en la página del aviso.</p>` : ""}` : `<p>Sin eventos de precio capturados.</p>`;
  const c = d.cat, acct = c && !c.mother;
  const todo = [`Preguntá si el precio pedido sigue vigente y desde cuándo está publicado.`,
    acct ? `Pedí la cuenta catastral y compará lote y superficie con el registro.` : `Pedí la cuenta catastral y la dirección exacta para verificar el lote.`,
    t?.band === "baja" ? "Confirmá que el inmueble existe y que el precio es ese antes de visitarlo." : null,
    d.point.prec === "city" || d.point.prec === "barrio" || d.point.prec === "none" ? "Pedí la dirección: el portal no la publica." : null,
    a.cuts.length ? "Preguntá por qué bajó el precio pedido." : null,
    o.lo != null ? "Llevá el rango de oferta como referencia: es una regla sobre cierres pasados, no un precio." : null].filter(Boolean);
  const ads = `<div class="tbl"><table><thead><tr><th>Aviso</th><th class="num">Precio pedido</th><th>Estado</th><th>Visto</th><th>Superficie</th></tr></thead><tbody>` +
    d.ads.map((x) => `<tr><td>${x[2] ? `<a href="${esc(x[2])}" target="_blank" rel="nofollow noopener">${esc(x[1])}</a>` : esc(x[1])}${x[8] && !String(x[1]).includes(x[8]) ? `<small>MLS ${esc(x[8])}</small>` : ""}</td>` +
      `<td class="num">${x[3] != null ? money(x[3], x[4]) : x[5] != null ? `USD ${n0(x[5])}<small>según el portal</small>` : "sin precio"}</td><td>${esc(x[6])}</td><td>${fecha(x[7])}</td>` +
      `<td>${x[9] ? `${n0(x[9])} m2` : x[10] ? `${n0(x[10])} m2 de terreno` : "-"}</td></tr>`).join("") + `</tbody></table></div>` +
    (d.adsMore ? `<p class="muted">Y ${n0(d.adsMore)} ${d.adsMore === 1 ? "aviso más" : "avisos más"} del mismo inmueble o del mismo grupo en revisión.</p>` : "");
  const media = d.point.lat != null ? `<div class="omedia"><div id="omap" style="height:100%"></div></div>`
    : `<div class="omedia"><div class="pinnote">${d.point.prec === "barrio" ? "Ubicación aproximada: el portal ubica este aviso en su punto genérico para el barrio." : d.point.prec === "city" ? "Punto genérico del portal para la ciudad: el aviso no publica dónde está." : "El aviso no tiene coordenadas."}</div></div>`;
  V.innerHTML = `<div class="wrap"><div class="otop">${backHtml}<button class="btn" type="button" id="share">Compartir</button></div>` +
    `<div class="ogrid">${media}<div class="otitle"><h1 data-nofig>${esc(title)}</h1>${factLine ? `<p data-t="ASKING">${tag("ASKING")}<span class="dk">${esc(factLine)}</span><span class="ph">${esc(factShort)}</span></p>` : ""}</div>` +
    `<aside class="oside"><div class="oprice" data-t="ASKING"><div class="muted dk">Precio pedido</div><div class="big">${tag("ASKING")}${priceBig}</div>` +
    `<div class="sub dk">${priceSub.join(" · ")}</div><div class="sub ph">${priceShort.join(" · ")}</div></div>` +
    `${offerHtml}<div class="obtns">${ownBtn}</div></aside>` +
    `<div class="orows"><a class="orow" href="#o-real" data-t="RULE"><span class="q"><span class="dk">¿Es real?</span><span class="ph">¿Real?</span></span><span class="v">${realRow}</span></a>` +
    `<a class="orow" href="#o-cierra" data-t="ESTIMATE"><span class="q"><span class="dk">¿A cuánto cierra?</span><span class="ph">¿Cierra?</span></span><span class="v">${estRow}</span></a>` +
    `<a class="orow" href="#o-negocia" data-t="CLOSED"><span class="q"><span class="dk">¿Cuánto se negocia?</span><span class="ph">¿Negocian?</span></span><span class="v">${negRow}</span></a></div>` +
    `<div class="osecs">` +
    `<section class="sec" id="o-real" data-t="RULE"><h2>¿Es real? Confianza en el aviso</h2>${realSec}<p class="stamp">Corrida del ${fecha(meta.trust?.run)}. ${esc(calTxt)}</p></section>` +
    `<section class="sec" id="o-cierra"><h2>¿A cuánto cierra?</h2>${estSec}<div data-t="CLOSED"><h2 style="margin-top:16px">${tag("CLOSED")}Cierres reportados cerca</h2>${compsTbl}${perM2}` +
    `<p class="stamp">${tag("CLOSED")}Cierres reportados por la red RE/MAX del ${fecha(meta.comps.first)} al ${fecha(meta.comps.last)}, a menos de ${n0(meta.comps.meters)} m y de los últimos ${meta.comps.months} meses, del mismo tipo y operación; hasta ${meta.comps.max}, una fila por venta. Cada cierre en la moneda en que se informó; en guaraníes, redondeado a millones si no es una cifra redonda, con USD a la centena. vs. pedido: contra el último pedido en la misma moneda; un cierre en otra moneda no lleva porcentaje. RE/MAX baja la página del aviso al cerrarse: cada fila lleva su MLS.</p></div></section>` +
    `<section class="sec" id="o-negocia" data-t="CLOSED"><h2>¿Cuánto se negocia?</h2>${ng ? `<p>${tag("CLOSED")}En ${cierres(ng.n)} de ${esc(ng.scope)}: ${negText(ng)}.</p><p class="stamp">${tag("CLOSED")}Cierres reportados por la red RE/MAX${window2(ng.first, ng.last)}, en la misma moneda que su último pedido, uno por operación, dentro de 0,4 a 1,6 veces el pedido; mínimo ${meta.min.spread}. Un precio idéntico al pedido es una venta a precio lleno o un pedido que quedó en el campo de venta; el registro no dice cuál.</p>` : `<p>${tag("CLOSED")}Sin dato: menos de ${meta.min.spread} cierres en la misma moneda para su tipo, ni en Paraguay.</p>`}` +
    `<h2 style="margin-top:16px">Rango de oferta, regla práctica</h2>${o.lo != null ? offerSentences(d) : `<p><b>Sin rango de oferta:</b> ${esc(o.none)}</p>`}</section>` +
    `<section class="sec" id="o-hist" data-t="ASKING"><h2>${tag("ASKING")}Historial de precio</h2>${hist}<p class="stamp">${tag("ASKING")}Captura diaria desde el ${fecha(meta.history_start)}; antes, solo la fecha de publicación del portal. Un recorte de 90% o más, una suba de 900% o más o un paso que devuelve el precio a uno de los 7 días anteriores es una corrección de carga y no cuenta.</p></section>` +
    catSection(c, kind) +
    `<section class="sec" id="o-todo"><h2>Qué hacer</h2><ul>${todo.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` +
    `<section class="sec" id="o-ads" data-t="ASKING"><h2>${tag("ASKING")}${d.ads.length > 1 ? `Avisos (${d.ads.length})` : "Aviso"}</h2>${ads}<p class="stamp">${tag("ASKING")}Último precio pedido en la moneda de cada aviso y estado según el portal, de la captura al ${fecha(meta.data_at)}. El botón abre el aviso del corredor que lo publica, nunca el de quien paga.${d.page ? ` <a href="${esc(d.page)}">Página completa del aviso</a>.` : ""}</p></section>` +
    `<section class="sec"><details class="method" data-nofig><summary>Método</summary>${methodHtml(meta)}</details></section>` +
    `</div></div></div><div class="obar">${ownBtn}</div>`;
  $("#share")?.addEventListener("click", share);
  await leafletCss();
  if (parseHash().id !== id) return;
  if (d.point.lat != null) miniMap(d);
  if (comps.length) lazyComps(d);
}
async function share() {
  const url = location.href;
  try {
    if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    toast("Enlace copiado");
  } catch { toast("Copiá la dirección de la barra del navegador"); }
}
function toast(t) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = t;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function staticMap(el, center, zoom) {
  const m = L.map(el, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, tap: false })
    .setView(center, zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
    .once("load", addFonts).addTo(m);
  return m;
}
function miniMap(d) {
  if (ST.ofertaMap) { ST.ofertaMap.remove(); ST.ofertaMap = null; }
  const m = staticMap("omap", [d.point.lat, d.point.lon], 15);
  L.marker([d.point.lat, d.point.lon], { icon: L.divIcon({ className: "subj", html: "<span></span>", iconSize: null }), keyboard: false, interactive: false }).addTo(m);
  ST.ofertaMap = m;
  requestAnimationFrame(() => m.invalidateSize());
}
function lazyComps(d) {
  const el = $("#cmap");
  if (!el) return;
  const draw = () => {
    if (ST.compsMap) { ST.compsMap.remove(); ST.compsMap = null; }
    const m = staticMap(el, [d.point.lat, d.point.lon], 14);
    m.dragging.enable(); m.touchZoom.enable(); m.scrollWheelZoom.disable();
    L.control.zoom({ position: "topright" }).addTo(m);
    const pts = [[d.point.lat, d.point.lon]];
    L.marker([d.point.lat, d.point.lon], { icon: L.divIcon({ className: "subj", html: "<span></span>", iconSize: null }), interactive: false }).addTo(m);
    d.comps.rows.forEach((c, k) => {
      const ll = [c[10] / 1e5, c[11] / 1e5];
      pts.push(ll);
      L.marker(ll, { icon: L.divIcon({ className: "cnum", html: `<span>${k + 1}</span>`, iconSize: null }), keyboard: false })
        .bindTooltip(`${fecha(c[0])}: ${moneyClose(c[1], c[2] ? "PYG" : "USD")}`).addTo(m);
    });
    m.fitBounds(pts, { padding: [24, 24], maxZoom: 16, animate: false });
    ST.compsMap = m;
  };
  if (!("IntersectionObserver" in window)) { draw(); return; }
  const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); draw(); } }, { rootMargin: "200px" });
  io.observe(el);
}

// ---------------------------------------------------------------------------------------------
// Mercado.
// ---------------------------------------------------------------------------------------------
function showMercado(q) {
  addFonts();
  const V = $("#v-mercado"), meta = ST.data.meta;
  const m = ST.mk.has(q.get("m")) ? q.get("m") : ST.F?.m || DEFAULTS.m;
  const op = q.get("o") === "rent" ? "rent" : "sale";
  const M = ST.data.mercado[m] || {}, byKind = M[op] || {};
  let k = q.get("k") || DEFAULTS.k;
  if (!byKind[k]) k = MAIN_KINDS.find((x) => byKind[x]) || Object.keys(byKind)[0] || DEFAULTS.k;
  $("#pick-btn").textContent = marketName(m);
  updateNav({ mk: m, k, o: op });
  const mk = ST.mk.get(m), name = mk?.name || "Paraguay", X = byKind[k];
  const others = Object.keys(byKind).filter((x) => !MAIN_KINDS.includes(x));
  const link = (kk, oo = op) => `#/mercado?m=${m}&k=${kk}${oo === "rent" ? "&o=rent" : ""}`;
  const tabs = MAIN_KINDS.filter((x) => byKind[x]).map((x) => `<button type="button" aria-pressed="${x === k}" data-go="${link(x)}">${x === "departamento" ? "Depto" : KIND[x]}</button>`).join("") +
    (others.length ? `<select aria-label="Otros tipos" data-sel>${[`<option value="">Otros tipos</option>`, ...others.map((x) => `<option value="${x}"${x === k ? " selected" : ""}>${kindLabel(x)}</option>`)].join("")}</select>` : "");
  const opTabs = ["sale", "rent"].map((o) => `<button type="button" aria-pressed="${o === op}" data-go="${link(k, o)}">${o === "sale" ? "Venta" : "Alquiler"}</button>`).join("");
  let body = "";
  if (!X) body = `<p class="empty">Ningún inmueble ${OPN[op]} activo de este tipo en ${esc(name)}.</p>`;
  else {
    const kp = KIND_PL[k] || "inmuebles", w = meta.windows;
    const A = X.act, ask = X.ask, neg = X.neg, dd = X.days, cu = X.cuts;
    // Label, figure with its tag, one line of detail, then the stamp: on a phone each tile is one row (the spec's wireframe).
    const tile = (t, label, short, value, sub, stamp) => `<div class="tile" data-t="${t}"><h3><span class="dk">${label}</span><span class="ph">${short}</span></h3>` +
      `<div class="v">${value}${tag(t)}</div>${sub ? `<div class="s">${sub}</div>` : ""}<p class="stamp">${stamp}</p></div>`;
    const sup = (n, min) => [`<span class="sm">sin dato</span>`, `n ${n0(n)}, mínimo ${min}`];
    const tiles = [];
    tiles.push(tile("ASKING", "Activos", "Activos", n0(A.n), `${nOf(A.new30, "publicado", "publicados")} en 30 días; confianza: ${n0(A.bands[0])} alta, ${n0(A.bands[1])} media, ${n0(A.bands[2])} baja${A.bands[3] ? `, ${n0(A.bands[3])} sin datos` : ""}`,
      `Inmuebles ${OPN[op]}, uno por propiedad, vistos desde el ${fechaC(w.full)} (InfoCasas: ${fechaC(w.facet)}).`));
    const [askV, askS] = ask.p50 != null ? [`USD ${n0(ask.p50)}`, `la mitad central (P25 a P75): USD ${n0(ask.p25)} a USD ${n0(ask.p75)}${op === "rent" ? " por mes" : ""}; ` +
      `${ask.m2?.p50 != null ? `USD ${op === "rent" ? n1(ask.m2.p50, 1) : n0(ask.m2.p50)} por m2 ${ask.m2.basis === "land" ? "de terreno" : "construido"}${op === "rent" ? " al mes" : ""} (n ${n0(ask.m2.n)})` : `por m2: sin dato (n ${n0(ask.m2?.n || 0)}, mínimo ${meta.min.median})`}`] : sup(ask.n, meta.min.median);
    tiles.push(tile("ASKING", "Precio pedido mediano", "Pedido med.", askV, askS, `n ${n0(ask.n)}; fuentes con 90% o más de avisos con precio; USD a la tasa SET del ${fechaC(meta.fx.date)}.`));
    const fromName = neg.from ? (neg.from === "py" ? "Paraguay" : ST.mk.get(neg.from)?.name) : null;
    // Same wording and rounding as the Oferta: the median against the ask leads, then the share closed at the ask.
    const [negV, negS] = neg.p50 != null ? [`<span class="sm">mediana</span> ${spct(neg.p50)}`,
      `${neg.p50 < 0 ? "bajo el pedido" : neg.p50 > 0 ? "sobre el pedido" : "al precio pedido"}; ${atAsk(neg)}; ${belowMed(neg)}; n ${n0(neg.n)}` +
      `${fromName ? `; ${esc(fromName)} (${esc(name)}: ${cierres(neg.own)} de ${kp}, mínimo ${meta.min.spread})` : ""}`] : sup(neg.n, meta.min.spread);
    tiles.push(tile("CLOSED", "Negociación", "Negociación", negV, negS, `n ${n0(neg.n)}; cierres reportados por la red RE/MAX${neg.first ? ` del ${fecha(neg.first)} al ${fecha(neg.last)}` : ""}, misma moneda que el pedido, uno por operación, 0,4 a 1,6 del pedido.`));
    const [dV, dS] = op !== "sale" ? [`<span class="sm">se mide en ventas</span>`, ""] : dd?.p50 != null ? [n0(dd.p50), `mediana en días; el 75% lleva ${n0(dd.p75)} o menos (P75); n ${n0(dd.n)}`] : sup(dd?.n || 0, meta.min.median);
    tiles.push(tile("ASKING", "Días publicado", "Días publ.", dV, dS, `Desde la fecha del portal, fuentes con fecha propia: ${(meta.age_sources || []).map((s) => SRC[s] || s).join(", ")}; cada inmueble una vez.`));
    tiles.push(tile("ASKING", "Recortes, 30 días", "Recortes 30 d", `${n0(cu.n)} de ${n0(cu.of)}`, `${pct((cu.n / Math.max(1, cu.of)) * 100)} de los activos tuvo un recorte de precio pedido`,
      `Recortes de 1% a 90% vistos por la captura diaria; correcciones de carga fuera.`));
    const lines = [];
    const T = M.transfers;
    if (T && !T.none) {
      lines.push(`<div class="mline" data-t="OFICIAL"><p>${tag("OFICIAL")}Transferencias inscritas, ${esc(name)}, ${mesAno(T.month)}: <b>${n0(T.n)}</b>${T.year_ago != null ? `; ${mesAno(`${+T.month.slice(0, 4) - 1}${T.month.slice(4)}`)}: ${n0(T.year_ago)}` : ""}${T.last12 != null ? `; 12 meses a ${mesAno(T.month)}: ${n0(T.last12)}` : ""}.</p>` +
        `<p class="stamp">Registro Unificado Nacional (RUN), publicación de ${mesAno(T.release)}: conteos de transferencias inscritas por distrito, todos los tipos de inmueble, sin precios.</p></div>`);
    } else if (T) lines.push(`<div class="mline" data-t="OFICIAL"><p>${tag("OFICIAL")}Transferencias inscritas: el registro no publica este distrito por separado.</p></div>`);
    const Fi = M.fiscal, r = Fi && !Fi.none ? Fi[k] : null;
    if (r && op === "sale") {
      lines.push(`<div class="mline" data-t="OFICIAL"><p>${tag("ASKING")}${tag("OFICIAL")}Precio pedido / valor fiscal, ${kp} en ${esc(name)}: ` +
        `${r.ratio != null ? `mediana de ${n1(r.ratio, 1)} veces (n ${n0(r.n)})` : `sin dato (n ${n0(r.n)}, mínimo ${meta.min.median})`}, pedidos de ${mesAno(r.month?.slice(0, 7))}.</p>` +
        `<p class="stamp">Cada precio pedido por m2 ${r.basis === "land" ? "de terreno" : "construido"} contra el valor fiscal por m2 del lote que contiene su punto (registro catastral). El valor fiscal es la base del impuesto, no un precio; el cociente tampoco es un precio.</p></div>`);
    } else if (op === "sale") lines.push(`<div class="mline" data-t="OFICIAL"><p>${tag("OFICIAL")}Precio pedido / valor fiscal: sin lectura de ${kp} en ${esc(name)}; el índice une solo avisos con punto propio a un lote del registro.</p></div>`);
    const E = X.est;
    lines.push(`<div class="mline" data-t="ESTIMATE"><p>${tag("ESTIMATE")}${E.pub ? `Estimación Tekoha: publica en ${esc(E.seg)} (${E.modes.map((x) => `${x.mode === "exact" ? "con punto propio" : "sin punto propio"}: error ${pct(x.err)}, n ${n0(x.n)}`).join("; ")}). ` +
      `${n0(A.est)} de ${n0(A.n)} activos aquí tienen estimación.${E.why ? ` Sin punto propio no publica: ${esc(E.why)}.` : ""}` : `Sin Estimación Tekoha: ${esc(E.why)}.`}</p></div>`);
    body = `<div class="five">${tiles.join("")}</div><div class="mlines">${lines.join("")}</div>` +
      `<div class="mfoot" data-t="ASKING"><a class="btn gold" href="#/buscar?m=${m}${op === "rent" ? "&o=rent" : ""}&k=${k}">${tag("ASKING")}Ver los ${n0(A.n)} en Buscar</a>` +
      `<a class="btn" href="https://ddvanlith.github.io/tekoha-daily/dashboard/#m=${encodeURIComponent(m)}">Gráficos en el tablero</a></div>`;
  }
  V.innerHTML = `<div class="wrap"><div class="mtop"><h1>${esc(name)}</h1><div class="tabs">${tabs}</div><div class="tabs">${opTabs}</div></div>` +
    `<p class="stamp" data-nofig>${KIND_PL[k] ? `${cap(KIND_PL[k])} ${OPN[op]}` : ""}. Datos al ${fecha(meta.data_at)}; cada cifra con su etiqueta, su n y su ventana. Sin gráficos: el tablero los tiene.</p>${body}</div>`;
  V.onclick = (e) => { const b = e.target.closest("[data-go]"); if (b) location.hash = b.dataset.go; };
  V.onchange = (e) => { if (e.target.matches("[data-sel]") && e.target.value) location.hash = link(e.target.value); };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------------------------
// The bare-figure check (docs/prototype-build.md section 5). A digit on screen passes when the nearest block marked
// data-t shows a tag of that block's species (PEDIDO, CIERRE, ESTIMACIÓN, OFICIAL), or, for the trust rule's score,
// points and calibration (data-t="RULE"), the words of the rule itself (class "rule"). Let through without a tag: form
// controls (values the reader typed or chose), the map (pins and clusters), and single elements marked data-nofig,
// which hold a date, the page size, the reader's own filter values, a place name or a published rule's thresholds.
// ---------------------------------------------------------------------------------------------
const SPECIES = new Set(["ASKING", "CLOSED", "ESTIMATE", "OFICIAL"]);
const visible = (el) => el.getClientRects().length > 0;
window.tekohaCheck = () => {
  const out = [];
  for (const root of [$(".bar"), $("#stale"), $(`#v-${ST.view}`)]) {
    if (!root) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      // The unit m2 is not a figure; the number before it is.
      if (!/\d/.test(n.nodeValue.replace(/\bm2\b/g, ""))) continue;
      const el = n.parentElement;
      if (!visible(el) || el.closest(".leaflet-container, input, select, textarea, [data-nofig]")) continue;
      const blk = el.closest("[data-t]"), t = blk?.dataset.t;
      if (SPECIES.has(t) && $$(`.tag.t-${t.toLowerCase()}`, blk).some(visible)) continue;
      if (t === "RULE" && $$(".rule", blk).some(visible)) continue;
      out.push(`${t || "sin bloque"}: ${n.nodeValue.trim().slice(0, 80)}`);
    }
  }
  return out;
};

// ---------------------------------------------------------------------------------------------
// Boot.
// ---------------------------------------------------------------------------------------------
// The four font files load after the first map tiles (or 2.5 seconds): on a slow phone they would otherwise take the
// bandwidth the map's tiles, the largest paint, need. Text shows in the system font until they swap in.
let fontsAdded = false;
function addFonts() {
  if (fontsAdded) return;
  fontsAdded = true;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Instrument+Sans:wght@400;600&family=Martian+Mono:wght@400&display=swap";
  document.head.appendChild(l);
}
async function boot() {
  setTimeout(addFonts, 2500);
  try {
    ST.data = await getJSON("data/markets.json");
  } catch {
    $("#count").innerHTML = `<div class="n">No se pudieron cargar los datos. Probá de nuevo en unos minutos.</div>`;
    return;
  }
  for (const m of ST.data.markets) { ST.mk.set(m.id, m); if (m.level === "dept") ST.deptMk.set(m.dk, m); }
  ST.lastSearch = store.get("tekoha-search");
  renderHeader();
  wirePicker();
  wireBuscar();
  // On a phone a stamp shows one line; a tap opens the rest (the spec's Stamp component).
  document.addEventListener("click", (e) => { const s = e.target.closest(".stamp"); if (s && !e.target.closest("a")) s.classList.toggle("open"); });
  window.addEventListener("hashchange", route);
  // Back to Buscar restores its own place (route); the browser's restore would land before the list is drawn.
  try { history.scrollRestoration = "manual"; } catch {}
  // A cold open frames the Asunción metro side of Central at zoom 11: the whole department at zoom 9 is four clusters.
  if (!location.hash || location.hash === "#" || location.hash === "#/") history.replaceState(null, "", `#/buscar?m=${DEFAULTS.m}&k=${DEFAULTS.k}&v=-25.3200,-57.5200,11`);
  route();
}
boot();
