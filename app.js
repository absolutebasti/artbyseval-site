// Nur Bedienung. Ohne JavaScript bleibt jede Seite vollständig lesbar und bedienbar.
(() => {
  const html = document.documentElement;
  html.classList.add("js");
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- Kopfleiste: beim Runterscrollen weg, beim Hochscrollen wieder da ----------
  const kopf = $("[data-kopf]");
  const hero = $("[data-hero]");
  if (kopf) {
    let letzte = scrollY, wartet = false;
    const lauf = () => {
      wartet = false;
      const y = Math.max(0, scrollY);
      const grenze = hero ? hero.offsetHeight - kopf.offsetHeight : 0;
      kopf.classList.toggle("fest", y > grenze);
      if (y > grenze + 120 && y > letzte + 4) kopf.classList.add("weg");
      else if (y < letzte - 4 || y <= grenze) kopf.classList.remove("weg");
      letzte = y;
    };
    addEventListener("scroll", () => { if (!wartet) { wartet = true; requestAnimationFrame(lauf); } }, { passive: true });
    lauf();
  }

  // ---------- Einstieg: Bilder wechseln ruhig, weitere erst nach dem Laden holen ----------
  if (hero && !ruhig) {
    const folien = [...hero.querySelectorAll(".hero-folie")];
    const titel = $("[data-hero-titel]", hero);
    let i = 0, takt = null, imBild = true;
    const lade = (f) => {
      f.querySelectorAll("[data-srcset]").forEach((e) => { e.srcset = e.dataset.srcset; e.removeAttribute("data-srcset"); });
      const img = $("img", f);
      if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    };
    const weiter = async () => {
      const n = (i + 1) % folien.length;
      await lade(folien[n]);
      folien[i].classList.remove("aktiv");
      folien[n].classList.add("aktiv");
      if (titel) {
        titel.textContent = folien[n].dataset.titel;
        titel.closest("a").href = folien[n].dataset.url;
      }
      i = n;
      lade(folien[(n + 1) % folien.length]);
    };
    const start = () => { if (!takt && imBild && !document.hidden) takt = setInterval(weiter, 6500); };
    const stopp = () => { clearInterval(takt); takt = null; };
    if (folien.length > 1) {
      new IntersectionObserver(([e]) => { imBild = e.isIntersecting; imBild ? start() : stopp(); }).observe(hero);
      document.addEventListener("visibilitychange", () => (document.hidden ? stopp() : start()));
      const los = () => setTimeout(() => lade(folien[1]), 1200);
      document.readyState === "complete" ? los() : addEventListener("load", los, { once: true });
    }
  }

  // ---------- Einblenden beim Scrollen (erst hier aktiv, damit nie etwas unsichtbar bleibt) ----------
  const teile = document.querySelectorAll(".einblenden");
  if ("IntersectionObserver" in window && !ruhig) {
    if (teile.length) {
      const io = new IntersectionObserver(
        (es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add("sichtbar"); io.unobserve(e.target); } },
        { rootMargin: "0px 0px -6% 0px" }
      );
      for (const el of teile) {
        if (el.getBoundingClientRect().top < innerHeight) el.classList.add("sichtbar");
        else io.observe(el);
      }
    }
    html.classList.add("anim");
  }

  // ---------- Werkseite: alle Bilder zum Wischen, Angaben wechseln mit ----------
  const seite = $("[data-werk]");
  if (!seite) return;
  const buehne = $(".buehne", seite);
  const info = $("[data-info]", seite);
  const nr = $("[data-nr]", seite);
  const vor = $('a[rel="prev"]', seite);
  const nach = $('a[rel="next"]', seite);
  const zurueck = $(".zurueck", seite);
  const daten = JSON.parse($("#werke-daten").textContent);
  const n = daten.length;
  let i = Number(seite.dataset.index);

  const erste = $(".folie", buehne);
  const folien = daten.map((w, k) => {
    if (k === i) return erste;
    const f = document.createElement("figure");
    f.className = "folie";
    f.innerHTML = w.bild;
    return f;
  });
  folien.forEach((f, k) => { if (k < i) buehne.insertBefore(f, erste); else if (k > i) buehne.appendChild(f); });
  const breite = () => buehne.clientWidth;
  const stelle = (k, weich) => buehne.scrollTo({ left: k * breite(), behavior: weich && !ruhig ? "smooth" : "instant" });
  stelle(i, false);

  const vorladen = () => [i - 1, i + 1].forEach((k) => { const img = folien[k] && $("img", folien[k]); if (img) img.loading = "eager"; });
  const zeige = (k) => {
    if (k === i || !daten[k]) return;
    i = k;
    const w = daten[k];
    info.innerHTML = w.info;
    nr.textContent = String(k + 1).padStart(2, "0");
    vor.href = daten[(k - 1 + n) % n].url;
    nach.href = daten[(k + 1) % n].url;
    zurueck.href = "/#w-" + w.id;
    document.title = w.seitentitel;
    history.replaceState(history.state, "", w.url);
    vorladen();
  };
  let rollt = false;
  buehne.addEventListener("scroll", () => {
    if (rollt) return;
    rollt = true;
    requestAnimationFrame(() => { rollt = false; zeige(Math.round(buehne.scrollLeft / breite())); });
  }, { passive: true });
  // Am Ende geht es ohne langes Zurückrollen wieder von vorn los.
  const blaettere = (d) => { const k = (i + d + n) % n; stelle(k, Math.abs(k - i) === 1); };
  vor.addEventListener("click", (e) => { e.preventDefault(); blaettere(-1); });
  nach.addEventListener("click", (e) => { e.preventDefault(); blaettere(1); });
  // Nur bei neuer Breite neu ausrichten (am Handy feuert "resize" auch, wenn die Adressleiste einklappt).
  let b0 = breite();
  addEventListener("resize", () => { if (breite() !== b0) { b0 = breite(); stelle(i, false); } });
  vorladen();

  // ---------- Lupe ----------
  const lupe = $("#lupe");
  const rolle = $(".lupe-rolle", lupe);
  const gross = $("img", lupe);
  const passend = () => { lupe.classList.remove("nah"); gross.style.width = ""; };
  const oeffne = () => {
    if (lupe.open || !lupe.showModal) return;
    passend();
    gross.src = daten[i].gross;
    gross.alt = daten[i].alt;
    lupe.showModal();
    history.pushState({ lupe: true }, "");
  };
  lupe.addEventListener("close", () => { if (history.state && history.state.lupe) history.back(); });
  addEventListener("popstate", () => { if (lupe.open) lupe.close(); });
  $(".lupe-zu", lupe).addEventListener("click", () => lupe.close());
  rolle.addEventListener("click", (e) => { if (e.target === rolle) lupe.close(); });
  gross.addEventListener("click", (e) => {
    if (lupe.classList.contains("nah")) return passend();
    const r = gross.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const z = Math.min(3, Math.max(1.8, gross.naturalWidth / (r.width * Math.min(devicePixelRatio || 1, 2))));
    lupe.classList.add("nah");
    gross.style.width = r.width * z + "px";
    rolle.scrollLeft = px * r.width * z - e.clientX;
    rolle.scrollTop = py * r.height * z - e.clientY;
  });
  if (lupe.showModal) {
    buehne.addEventListener("click", (e) => { if (e.target.closest(".zoom")) { e.preventDefault(); oeffne(); } });
    const knopf = $("[data-gross]", seite);
    knopf.hidden = false;
    knopf.addEventListener("click", oeffne);
  }

  // ---------- Tasten ----------
  addEventListener("keydown", (e) => {
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || lupe.open) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); blaettere(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); blaettere(1); }
  });

  // ---------- Teilen ----------
  const teilen = $("[data-teilen]", seite);
  if (navigator.share || (navigator.clipboard && navigator.clipboard.writeText)) {
    teilen.hidden = false;
    teilen.addEventListener("click", async () => {
      const paket = { title: document.title, url: location.href };
      try {
        if (navigator.share) await navigator.share(paket);
        else {
          await navigator.clipboard.writeText(paket.url);
          teilen.setAttribute("aria-label", "Link kopiert");
          teilen.classList.add("erledigt");
          setTimeout(() => { teilen.setAttribute("aria-label", "Bild teilen"); teilen.classList.remove("erledigt"); }, 1800);
        }
      } catch (_) { /* abgebrochen */ }
    });
  }
})();
