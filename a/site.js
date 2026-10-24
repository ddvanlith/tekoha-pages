// Loaded by every property page as a/site.js (pipeline/property-pages.mjs fills in the five values): the one-line signup
// to Tekoha Semanal, the value report's buttons and, when the build has a token, the Cloudflare Web Analytics beacon. One
// shared file keeps the 39,000 pages small. The signup takes the shapes of the shared capture (pages-src/capture.js,
// docs/viral-loop.md), written here without modules: a newsletter row {email, source, kind, payload: {lang, code, ref}}
// into public.signups with the public anon key, under insert-only row security; without the key an email to the public
// address (TEKOHA_PUBLIC_EMAIL at build time), subject "[tekoha:newsletter] <code>" and key: value lines, which the inbox
// reader turns into the same row; with no public address either, a line saying the sign-up opens soon. code is the
// visitor's own link (made on the first sign-up), ref the link they came by (pages-src/ref.js).
(function () {
  var ANON = "", CF = "", API = "https://hlchvqlodqucqnvqcwvt.supabase.co/rest/v1/signups", TO = "holatekoha@gmail.com";
  var LINE = "Tekoha Semanal: casas, precios y alquileres de Paraguay, gratis cada martes en tu correo.";
  var box = document.getElementById("nl");
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function codes() {
    var c = ls("tekoha_mycode"), r = ls("tekoha_ref"), A = "abcdefghijklmnopqrstuvwxyz0123456789", out = "", b;
    if (!/^[a-z0-9]{7}$/.test(c || "") && window.crypto && crypto.getRandomValues) {
      // 252 is the largest multiple of 36 below 256: a byte at or above it is drawn again, so every character is as likely.
      while (out.length < 7) { b = crypto.getRandomValues(new Uint8Array(16)); for (var i = 0; i < b.length && out.length < 7; i++) if (b[i] < 252) out += A[b[i] % 36]; }
      ls("tekoha_mycode", out); c = out;
    }
    var p = { lang: "es" };
    if (/^[a-z0-9]{7}$/.test(c || "")) p.code = c;
    if (/^[a-z0-9]{7}$/.test(r || "") && r !== c) p.ref = r;
    return p;
  }
  if (box && !ANON && !TO) {
    box.innerHTML = '<p>' + LINE + ' La suscripción abre pronto.</p>';
  } else if (box && !ANON) {
    box.innerHTML = '<p>' + LINE + ' <a id="nlm" href="mailto:' + TO + '">Escribinos para suscribirte</a></p>';
    // The email is written when it is opened, so a visitor who never signs up gets no code.
    box.querySelector("#nlm").addEventListener("click", function () {
      var p = codes(), body = "source: weekly-es-pages\nlang: es" + (p.code ? "\ncode: " + p.code : "") + (p.ref ? "\nref: " + p.ref : "");
      this.href = "mailto:" + TO + "?subject=" + encodeURIComponent("[tekoha:newsletter] " + (p.ref || "-")) + "&body=" + encodeURIComponent(body);
    });
  } else if (box) {
    box.innerHTML = '<form novalidate><label for="nle">' + LINE + '</label><span class="nlr"><input id="nle" type="email" autocomplete="email" ' +
      'placeholder="tu@email.com" aria-label="Tu email"><button type="submit">Suscribirme</button></span><span class="nlm" role="status"></span></form>';
    var f = box.querySelector("form"), m = box.querySelector(".nlm");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = box.querySelector("input").value.trim(), b = box.querySelector("button");
      if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(v) || v.length >= 200) { m.textContent = "Escribí tu email."; m.className = "nlm bad"; return; }
      b.disabled = true;
      fetch(API, { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ email: v, source: "weekly-es-pages", kind: "newsletter", payload: codes() }) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); m.textContent = "Listo. Te llega el martes."; m.className = "nlm ok"; f.reset(); })
        .catch(function () { m.textContent = "No se pudo. Probá de nuevo."; m.className = "nlm bad"; })
        .then(function () { b.disabled = false; });
    });
  }
  // The value report (docs/report-product.md): a listing or property page carries <p class="buy" data-l="<listing id>">
  // after its offer block. The free report's button opens the Casa form for it (an email, and the report arrives within a
  // day); while the Stripe Payment Link exists (REPORT_PAYMENT_LINK at build time) a paid button beside it opens the link
  // with the reference the webhook reads back (pipeline/report/ref.mjs).
  var PAY = "";
  var buy = document.querySelector(".buy[data-l]"), lid = buy && buy.getAttribute("data-l");
  if (buy && /^\d{1,12}$/.test(lid)) {
    buy.innerHTML = '<a class="btn" href="../casa/#/informe?l=' + lid + '">Pedí el informe gratis</a>' +
      (PAY ? '<a class="btn alt" href="' + PAY + (PAY.indexOf("?") < 0 ? "?" : "&") + "client_reference_id=listing-" + lid + '-es&amp;locale=es-419">Pedí el informe completo (USD 19)</a>' : "") +
      "<span>Estimación con su error, ventas cerca, valor fiscal y qué ofrecer, en PDF a tu email.</span>";
  }
  if (CF) {
    var s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: CF }));
    document.body.appendChild(s);
  }
})();
