(function () {
  const site = window.SITE || {};
  const root = document.documentElement;

  document.querySelectorAll("[data-app]").forEach((el) => { el.textContent = site.appName; });

  document.querySelectorAll("[data-cta]").forEach((el) => {
    if (site.testflightUrl) {
      el.href = site.testflightUrl;
    } else {
      el.removeAttribute("href");
      el.classList.add("is-pending");
      el.querySelectorAll("[data-l=vi]").forEach((s) => { s.textContent = "Bản thử TestFlight sắp mở"; });
      el.querySelectorAll("[data-l=en]").forEach((s) => { s.textContent = "TestFlight beta opening soon"; });
    }
  });

  document.querySelectorAll("[data-contact]").forEach((el) => {
    if (site.contactEmail) {
      el.textContent = site.contactEmail;
      el.href = "mailto:" + site.contactEmail;
    } else {
      el.closest("[data-contact-row]")?.setAttribute("hidden", "");
    }
  });

  function read() { try { return localStorage.getItem("lang"); } catch { return null; } }
  function write(value) { try { localStorage.setItem("lang", value); } catch { /* per-visit only */ } }

  let lang = read() || ((navigator.language || "").toLowerCase().startsWith("vi") ? "vi" : "en");
  const listeners = [];

  function apply() {
    root.dataset.lang = lang;
    root.lang = lang;
    document.querySelectorAll("[data-lang-btn]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.langBtn === lang));
    });
    listeners.forEach((fn) => fn(lang));
  }

  document.querySelectorAll("[data-lang-btn]").forEach((b) => {
    b.addEventListener("click", () => { lang = b.dataset.langBtn; write(lang); apply(); });
  });

  window.onLangChange = (fn) => { listeners.push(fn); fn(lang); };
  apply();
})();

// The same exposure maths as the app, see docs/CONG-THUC.md.
(function () {
  const form = document.getElementById("calc");
  if (!form) return;

  const speeds = ["1/8000","1/6400","1/5000","1/4000","1/3200","1/2500","1/2000","1/1600","1/1250","1/1000","1/800","1/640","1/500","1/400","1/320","1/250","1/200","1/160","1/125","1/100","1/80","1/60","1/50","1/40","1/30","1/25","1/20","1/15","1/13","1/10","1/8","1/6","1/5","1/4","1/3","1/2.5","1/2","1/1.6","1/1.3","1s","1.3s","1.6s","2s","2.5s","3s","4s","5s","6s","8s","10s","13s","15s","20s","25s","30s","40s","50s","60s"];

  const scenes = [
    [14, "Nắng gắt", "Bright sun"],
    [12, "Trời râm", "Overcast"],
    [9, "Hoàng hôn", "Sunset"],
    [6, "Trong nhà", "Indoors"],
    [3, "Phố đêm", "Night street"],
    [-99, "Rất tối", "Very dark"],
  ];

  function duration(s) {
    if (s < 60) return s < 10 ? s.toFixed(1) + "s" : Math.round(s) + "s";
    const t = Math.round(s);
    if (t < 3600) return Math.floor(t / 60) + "m " + String(t % 60).padStart(2, "0") + "s";
    return Math.floor(t / 3600) + "h " + String(Math.floor((t % 3600) / 60)).padStart(2, "0") + "m";
  }

  function solve({ lv, iso, av, nd, hp5 }) {
    const target = lv + Math.log2(iso / 100) - Math.log2(nd);
    const exact = Math.pow(2, av) / Math.pow(2, target);
    const tv = -Math.log2(exact);
    let metered, label, over = 0;
    if (tv < -6) {
      metered = exact;
      label = duration(exact);
    } else {
      const index = Math.min(speeds.length - 1, Math.max(0, Math.round((13 - tv) * 3)));
      metered = Math.pow(2, -(13 - index / 3));
      label = speeds[index];
      over = Math.log2(metered / exact);
    }
    const corrected = hp5 && metered >= 1;
    const actual = corrected ? Math.pow(metered, 1.31) : metered;
    return { target, label, metered, actual, corrected, over };
  }
  window.lightmeterSolve = solve;

  const out = {
    shutter: document.getElementById("out-shutter"),
    aperture: document.getElementById("out-aperture"),
    note: document.getElementById("out-note"),
    formula: document.getElementById("out-formula"),
    lv: document.getElementById("out-lv"),
    scene: document.getElementById("out-scene"),
    window: document.getElementById("scene-window"),
  };
  let lang = "vi";

  function render() {
    const lv = Number(form.lv.value);
    const iso = Number(form.iso.value);
    const av = Number(form.aperture.value);
    const nd = Number(form.nd.value);
    const hp5 = form.hp5.checked;
    const r = solve({ lv, iso, av, nd, hp5 });

    out.lv.textContent = "LV " + lv;
    const scene = scenes.find((s) => lv >= s[0]);
    out.scene.textContent = lang === "vi" ? scene[1] : scene[2];
    out.shutter.textContent = r.corrected ? duration(r.actual) : r.label;
    out.aperture.textContent = form.aperture.selectedOptions[0].textContent;
    out.window.style.setProperty("--lit", String(Math.min(1, Math.max(0.04, (lv + 2) / 18))));

    const metered = duration(r.metered);
    let note = "";
    if (r.corrected) {
      note = lang === "vi"
        ? `Đo được ${metered}, phơi ${duration(r.actual)} để bù reciprocity của HP5 Plus.`
        : `Metered ${metered}, expose ${duration(r.actual)} to correct HP5 Plus reciprocity.`;
    } else if (r.over > 0.2) {
      note = lang === "vi"
        ? `Quá sáng ${r.over.toFixed(1)} stop kể cả ở 1/8000. Hãy khép khẩu hoặc thêm ND.`
        : `${r.over.toFixed(1)} stops too bright even at 1/8000. Stop down or add ND.`;
    }
    out.note.textContent = note;
    out.note.hidden = !note;

    const ndPart = nd > 1 ? ` − log₂(${nd})` : "";
    out.formula.textContent = `t = N² / 2^(${lv} + log₂(${iso}/100)${ndPart}) = ${r.metered < 1 ? "1/" + Math.round(1 / r.metered) : duration(r.metered)}`;
  }

  form.addEventListener("input", render);
  form.addEventListener("submit", (e) => e.preventDefault());
  window.onLangChange((value) => { lang = value; render(); });
})();
