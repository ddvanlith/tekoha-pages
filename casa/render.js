// Tekoha Casa: wording, rounding and the card, with no DOM. app.js renders with it in the browser, and
// pipeline/build-casa.mjs renders the first screen's cards into index.html with it at build time, so the first photo is
// requested as soon as the page is read (docs/consumer-app-build.md, performance).
//
// Rounding (docs/consumer-app-spec.md section 3): USD to the nearest 1.000 under 100.000 and the nearest 5.000 above,
// guaraníes to the nearest million. A price as the advert states it is printed as it is; a conversion or an estimate is
// rounded.
export const KINDS = ["casa", "departamento", "terreno", "duplex"];
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"']/g, (c) => ESC[c]));
const EPOCH = Date.parse("2020-01-01T00:00:00Z");
export const fromDay = (n) => new Date(EPOCH + n * 864e5).toISOString().slice(0, 10);

export function fmt(S, fxRate) {
  const grp = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, S.grp);
  const n0 = (x) => (x == null || !Number.isFinite(+x) ? "-" : `${Math.round(+x) < 0 ? "-" : ""}${grp(String(Math.abs(Math.round(+x))))}`);
  const n1 = (x) => { const [i, f] = Math.abs(+x).toFixed(1).split("."); return `${+x < 0 ? "-" : ""}${grp(i)}${f === "0" ? "" : `${S.dec}${f}`}`; };
  const roundUsd = (x) => (x < 100000 ? Math.round(x / 1000) * 1000 : Math.round(x / 5000) * 5000);
  // Small dollar figures (a rent, a monthly payment) keep tens; a home's price rounds to thousands.
  const usdR = (x) => `USD ${n0(x >= 10000 ? roundUsd(x) : x >= 1000 ? Math.round(x / 10) * 10 : Math.round(x))}`;
  const gsM = (x) => S.million(n0(Math.max(1, Math.round(x / 1e6))));
  const gsR = (x) => (x >= 1e6 ? `Gs ${gsM(x)}` : `Gs ${n0(Math.round(x / 1000) * 1000)}`);
  // A monthly payment in guaraníes: to the nearest million it would move by up to 2.5% under Gs 20 millones, so there it
  // rounds to the nearest 10.000.
  const gsPay = (x) => (x < 20e6 ? `Gs ${n0(Math.round(x / 1e4) * 1e4)}` : gsR(x));
  const pctR = (x) => `${Math.round(Math.abs(x))}%`;
  const date = (iso) => { if (!iso) return "-"; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${+d} ${S.months[+m - 1]} ${y}`; };
  const monthYear = (ym) => (ym ? `${S.monthsLong[+ym.slice(5, 7) - 1]} ${S.lang === "en" ? "" : "de "}${ym.slice(0, 4)}` : "-");
  // The advert's own price, exact; and the other currency, rounded, at the day's SET rate.
  const priceMain = (r) => (r.p != null ? (r.cu ? `Gs ${n0(r.p)}` : `USD ${n0(r.p)}`) : r.su != null ? `USD ${n0(r.su)}` : null);
  const priceOther = (r) => (r.p == null || !fxRate ? null : r.cu ? usdR(r.p / fxRate) : gsR(r.p * fxRate));
  const usdOf = (r) => (r.p != null ? (r.cu ? r.p / fxRate : r.p) : r.su ?? null);
  const ago = (dl) => (dl == null ? null : dl < 7 ? S.agoDays : dl < 60 ? S.agoWeeks(Math.max(1, Math.round(dl / 7))) : S.agoMonths(Math.round(dl / 30.4)));
  const dur = (days) => (days < 60 ? S.weeks_(Math.max(1, Math.round(days / 7))) : S.months_(Math.round(days / 30.4)));
  return { n0, n1, usdR, gsR, gsM, gsPay, pctR, roundUsd, date, monthYear, priceMain, priceOther, usdOf, ago, dur };
}

// InfoCasas' cdn2 serves any size of a photo on its path, as WebP or AVIF, for files cdn1 holds too (checked 2026-10-11:
// a 296 KB cdn1 JPEG is 51 KB at 600x450, 78 KB at 720x540): a card and the gallery's first photo ask for 600x450 (so
// a home opened from its card shows a photo already in cache), the rest of the gallery for 720x540. The other portals'
// links are their smallest rendition already. A rendition that fails falls back to the link as stored (casaImgErr).
export function photoSrc(url, size = "card") {
  if (!url) return null;
  const m = /^https:\/\/cdn[12]\.infocasas\.com\.uy\/repo\/img\/(?!th\.)([^/?#]+)$/.exec(url);
  return m ? `https://cdn2.infocasas.com.uy/repo/img/th.outside${size === "card" ? "600x450" : "720x540"}.${m[1]}` : url;
}

export const lineOf = (S, cls) => (cls === 1 ? S.lineInside : cls === 2 ? S.lineAbove : cls === 3 ? S.lineBelow : null);

// An area under 15 m2 is a slip in the advert (a "1 m2" casa), not a size: it is not printed.
export const MIN_M2 = 15;
export function factsOf(S, F, r) {
  const k = S.kindChip[r.k] || S.whatMix(true);
  const area = r.a >= MIN_M2 ? (r.ab === "land" && r.k !== "terreno" ? S.m2Land(F.n0(r.a)) : S.m2(F.n0(r.a))) : null;
  return [k, r.bd > 0 && r.k !== "terreno" ? S.bedsShort(F.n0(r.bd)) : null, area].filter(Boolean).join(", ");
}
export const placeOf = (r) => [r.b, r.c].filter(Boolean).join(", ");

const HEART = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

// One card. r: { id, k, c, b, p, cu, su, a, ab, bd, tb, dl, ct, ph, cls, tw }; op: sale or rent. tw: the ads the card
// stands for when the list joined twins (app.js, collapse).
export function cardHtml(S, F, r, { op = "sale", eager = false, high = false, saved = false } = {}) {
  const main = F.priceMain(r), other = F.priceOther(r);
  const line = lineOf(S, r.cls);
  const trust = r.tb === 0 ? `<span class="ok">${S.trustHigh}</span>` : r.tb === 2 ? `<span class="doubt">${S.trustLow}</span>` : "";
  const l5 = [trust, line ? esc(line) : ""].filter(Boolean).join(" · ");
  const l6 = [F.ago(r.dl), r.ct > 0 ? S.cuts(r.ct) : null, r.tw > 1 ? S.twins(r.tw) : null].filter(Boolean).join(" · ");
  const src = photoSrc(r.ph, "card");
  const img = src ? `<img src="${esc(src)}" data-orig="${esc(r.ph)}" alt="" width="600" height="450" loading="${eager ? "eager" : "lazy"}"${high ? ' fetchpriority="high"' : ""} decoding="async" referrerpolicy="no-referrer" onerror="casaImgErr(this)">` : "";
  const per = op === "rent" ? (S.lang === "en" ? " a month" : " por mes") : "";
  return `<article class="card" data-id="${r.id}"><a class="cl" href="#/casa/${r.id}" aria-label="${esc(S.cardAria(factsOf(S, F, r), main || S.noPrice, placeOf(r)))}">` +
    `<figure class="ph${src ? "" : " noimg"}">${img}<span class="phx" aria-hidden="true"><i></i>${S.photoMissing}</span></figure>` +
    `<div class="cb"><p class="pr">${main ? `${esc(main)}${per}` : `<span class="muted">${S.noPrice}</span>`}</p>` +
    `<p class="po">${other ? `${esc(other)}${per}` : "&nbsp;"}</p><p class="fa">${esc(factsOf(S, F, r))}</p><p class="pl">${esc(placeOf(r))}</p>` +
    `<p class="l5">${l5 || "&nbsp;"}</p><p class="l6">${esc(l6) || "&nbsp;"}</p></div></a>` +
    `<button class="heart" type="button" data-heart="${r.id}" aria-pressed="${saved}" aria-label="${saved ? S.saved : S.save}">${HEART}</button></article>`;
}
export const skeletonHtml = (n = 3) => Array.from({ length: n }, () => `<article class="card sk" aria-hidden="true"><figure class="ph"></figure><div class="cb"><p></p><p></p><p></p></div></article>`).join("");

export const BUDGETS = { sale: [50000, 100000, 150000, 250000], rent: [300, 500, 800, 1200] };
export const BEDS = [2, 3, 4];

// The count line: "1.234 inmuebles con fotos en venta en Asunción y Central". photos: the list shows only homes with a
// photo, as every list does until the reader asks for the rest (Dennis, 2026-10-24); noPhoto: how many that leaves out.
export function countHtml(S, F, { n, kinds, op, where, noPrice = 0, noBeds = 0, photos = false, noPhoto = 0 }) {
  const one = n === 1;
  const what = kinds.length === 1 ? S.whatKind[kinds[0]][one ? 0 : 1] : S.whatMix(one);
  return `${esc(S.countLine(F.n0(n), what, op, where, photos))}${photos && noPhoto ? `<small>${esc(S.noPhotoHidden(F.n0(noPhoto)))}</small>` : ""}` +
    `${noPrice ? `<small>${esc(S.noPriceHidden(F.n0(noPrice)))}</small>` : ""}${noBeds ? `<small>${esc(S.noBedsHidden(F.n0(noBeds)))}</small>` : ""}`;
}
// The privacy policy's one line, under every form (pipeline/privacy.mjs writes the page beside /casa/).
export const privacyHtml = (S) => `<p class="muted pv">${esc(S.privacyPre)} <a href="../privacidad/">${esc(S.privacyLink)}</a>.</p>`;
export function footHtml(S, F, { date, hidden }) {
  return `<p>${esc(S.foot(F.date(date)))}</p>${hidden ? `<p>${esc(S.footHidden(F.n0(hidden)))}</p>` : ""}` +
    `<p><a href="#/vender">${esc(S.footSell)}</a><a href="../app/">${esc(S.footPro)}</a></p>`;
}

// The Buscar screen: the form, the count, the cards. Q: { o, q, label, p, k, b, s, map, sf }; fx: today's SET rate.
// sf: the switch under the count that adds the homes without a photo to the list.
// The chips read "50k" (the spec's words); their names say the whole figure.
const kShort = (F, b) => (b >= 1000 && b % 1000 === 0 ? `${F.n0(b / 1000)}k` : F.n0(b));

export function buscarShell(S, F, { Q, fx, count, cards, more, foot, zone }) {
  const kinds = KINDS.map((k) => `<button class="chip" type="button" data-k="${k}" aria-pressed="${Q.k.includes(k)}">${esc(S.kindChip[k])}</button>`).join("");
  const beds = BEDS.map((b) => `<button class="chip" type="button" data-bd="${b}" aria-pressed="${Q.b === b}" aria-label="${esc(S.bedsChipAria(b))}">${esc(S.bedsChip(b))}</button>`).join("");
  const budLab = Q.o === "rent" ? S.budgetLabelRent : S.budgetLabel;
  const buds = BUDGETS[Q.o].map((b) => `<button class="chip" type="button" data-bud="${b}" aria-pressed="${Q.p === b}" aria-label="${esc(budLab)} USD ${F.n0(b)}">${kShort(F, b)}</button>`).join("");
  const sorts = Object.entries(S.sorts).map(([k, t]) => `<option value="${k}"${Q.s === k ? " selected" : ""}>${esc(t)}</option>`).join("");
  // The two questions are the fields' own placeholders, so the first card sits on a phone's first screen; the labels stay
  // for screen readers.
  return `<div class="btop"><div class="bhead"><h1 id="h-buscar">${esc(S.h1)}</h1><p class="sub">${esc(S.sub)}</p></div>` +
    `<div class="seg" role="group" aria-label="${esc(S.buy)}, ${esc(S.rent)}"><button type="button" data-op="sale" aria-pressed="${Q.o === "sale"}">${esc(S.buy)}</button>` +
    `<button type="button" data-op="rent" aria-pressed="${Q.o === "rent"}">${esc(S.rent)}</button></div></div>` +
    `<div class="formrow"><div class="fld"><label class="sr" for="where">${esc(S.whereLabel)}</label><div class="inpw">` +
    `<input class="inp" id="where" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(S.whereLabel)}" value="${esc(Q.label || "")}" role="combobox" aria-expanded="false" aria-controls="sugg" aria-autocomplete="list">` +
    `<button class="clr" type="button" id="whereclr" aria-label="${esc(S.whereClear)}"${Q.q ? "" : " hidden"}>&times;</button></div>` +
    `<ul class="sugg" id="sugg" role="listbox" aria-label="${esc(S.whereLabel)}" hidden></ul></div>` +
    `<div class="fld"><label class="sr" for="budget">${esc(budLab)} (USD)</label>` +
    `<div class="inpw bud"><input class="inp" id="budget" inputmode="numeric" autocomplete="off" placeholder="${esc(budLab)}" value="${Q.p ? `USD ${F.n0(Q.p)}` : ""}">` +
    `<span class="gs" id="budgs" aria-live="polite">${Q.p && fx ? esc(S.budgetGs(F.gsR(Q.p * fx))) : ""}</span>` +
    `<button class="clr" type="button" id="budclr" aria-label="${esc(S.budgetClear)}"${Q.p ? "" : " hidden"}>&times;</button></div>` +
    `<div class="chips" role="group" aria-label="${esc(budLab)}" id="buds">${buds}</div></div></div>` +
    `<div class="frow2"><div class="chips" role="group" aria-label="${esc(S.kindsLabel)}" id="kinds">${kinds}</div>` +
    `<div class="chips beds" role="group" aria-labelledby="bedslab" id="beds"><span class="clab" id="bedslab">${esc(S.bedsLabel)}</span>${beds}</div></div>` +
    (S.kindsNote ? `<p class="note">${esc(S.kindsNote)}</p>` : "") +
    `<div class="rhead"><p id="count" aria-live="polite">${count}</p>` +
    `<button class="chip" type="button" id="sf" aria-pressed="${!!Q.sf}">${esc(S.photosAll)}</button><div class="rctl">` +
    `<select id="sort" aria-label="${esc(S.sortLabel)}">${sorts}</select>` +
    `<button class="btn" type="button" id="mapbtn" aria-pressed="${!!Q.map}">${esc(Q.map ? S.listBtn : S.mapBtn)}</button></div></div>` +
    `<a class="zlink" id="zlink" href="${zone ? esc(zone.href) : "#"}"${zone ? "" : " hidden"}>${zone ? esc(S.zoneLink(zone.name)) : ""}</a>` +
    `<div id="mapbox"${Q.map ? "" : " hidden"}></div>` +
    `<div class="cards" id="cards">${cards}</div>` +
    `<button class="btn more" type="button" id="more"${more ? "" : " hidden"}>${more ? esc(more) : ""}</button>` +
    `<footer class="lfoot" id="lfoot">${foot}</footer>`;
}
