// ============================================
// //dzian — client-first home page JS
// ============================================
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  // Email assembled at runtime (keeps scrapers off the plain string)
  function getEmail() {
    return "johnkentevangelista" + "@" + "gmail.com";
  }

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---- Announcement bar ----
  var ann = document.getElementById("annBar");
  var annClose = document.getElementById("annClose");
  if (ann && annClose) {
    try { if (localStorage.getItem("annDismissed") === "1") ann.remove(); } catch (e) {}
    annClose.addEventListener("click", function () {
      ann.remove();
      try { localStorage.setItem("annDismissed", "1"); } catch (e) {}
    });
  }

  // ---- Reveal on scroll ----
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // ---- Footer year ----
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---- Footer email (assembled at runtime, not scrapable from markup) ----
  var footEmail = document.getElementById("footEmail");
  if (footEmail) {
    footEmail.textContent = getEmail();
    footEmail.href = "mailto:" + getEmail();
  }

  // ---- CV download ----
  var cvBtn = document.getElementById("downloadCVButton");
  if (cvBtn) {
    cvBtn.addEventListener("click", function () {
      var a = document.createElement("a");
      a.href = "cv/John_Kent_Evangelista_CV.pdf";
      a.download = "John_Kent_Evangelista_CV.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  // ---- Contact form (FormSubmit AJAX with mailto fallback) ----
  var form = document.getElementById("contactForm");
  var sendBtn = document.getElementById("contactSend");
  var copyBtn = document.getElementById("contactCopyEmail");
  var resultEl = document.getElementById("contactResult");

  function setResult(cls, text) {
    if (!resultEl) return;
    resultEl.className = "form-result" + (cls ? " " + cls : "");
    resultEl.textContent = text;
  }

  function openMailFallback(name, email, message) {
    var subject = encodeURIComponent("Project inquiry from " + name);
    var body = encodeURIComponent("Name: " + name + "\nEmail: " + email + "\n\n" + message);
    window.location.href = "mailto:" + getEmail() + "?subject=" + subject + "&body=" + body;
  }


  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var nameEl = document.getElementById("contactName");
      var emailEl = document.getElementById("contactEmail");
      var msgEl = document.getElementById("contactMessage");
      var honeyEl = document.getElementById("contactHoney");

      var name = nameEl.value.trim();
      var email = emailEl.value.trim();
      var message = msgEl.value.trim();

      // Honeypot — bots fill it, humans never see it
      if (honeyEl && honeyEl.value) {
        setResult("ok", "Message sent — thanks! I'll get back to you.");
        return;
      }

      if (!name || !email || !message) {
        setResult("err", "Please fill in all three fields.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setResult("err", "That email doesn't look right — mind checking it?");
        return;
      }

      setResult("", "Sending…");
      if (sendBtn) sendBtn.disabled = true;

      fetch("https://formsubmit.co/ajax/" + getEmail(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
          _subject: "Project inquiry from " + name,
          _template: "table",
          _captcha: "false"
        })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        var ok = r.ok && (r.data.success === "true" || r.data.success === true);
        if (!ok) throw new Error("send failed");
        setResult("ok", "Message sent — I'll reply within a day or two. Thanks!");
        nameEl.value = ""; emailEl.value = ""; msgEl.value = "";
      }).catch(function () {
        // Always surface the address in plain text — on machines with no mail
        // client the mailto below does nothing visible, and the visitor would
        // otherwise think the message was sent.
        setResult("ok", "Couldn't send from the page. Opening your email app — or write me directly at " + getEmail());
        openMailFallback(name, email, message);
      }).then(function () {
        if (sendBtn) sendBtn.disabled = false;
      });
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(getEmail()).then(function () {
        setResult("ok", "Email copied: " + getEmail());
      }).catch(function () {
        setResult("ok", "My email: " + getEmail());
      });
    });
  }

  // ---- STAGE: one pinned scroll scene (hero title -> brand ground -> intro) ----
  var stage = document.getElementById("stage");
  if (stage && !reduceMotion) {
    var sBg = stage.querySelector(".stage-bg");
    var sTitle = document.getElementById("stageTitle");
    var sIntro = document.getElementById("stageIntro");
    var sTree = document.getElementById("stageTree");
    var sMv = stage.querySelector("model-viewer");
    var topBar = document.querySelector(".top");
    var stTicking = false, wasDark = false;

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
    function ease(t) { return t * t * (3 - 2 * t); } // smoothstep

    function updateStage() {
      stTicking = false;
      var r = stage.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      if (total <= 0) return;
      var p = clamp01(-r.top / total);

      // Act 1 — the brand ground floods in; the title dissolves ALL THE WAY out
      var a = ease(seg(p, 0.02, 0.30));
      sBg.style.opacity = a.toFixed(3);
      var titleFade = 1 - ease(seg(p, 0.02, 0.26));
      sTitle.style.opacity = titleFade.toFixed(3);
      sTitle.style.transform = "scale(" + (1 - a * 0.06).toFixed(3) + ")";
      sTitle.style.visibility = titleFade < 0.01 ? "hidden" : "visible";

      // Act 2 — the pine slides right and the intro arrives beside it
      var b = ease(seg(p, 0.28, 0.52));
      sIntro.style.opacity = b.toFixed(3);
      sIntro.style.transform = "translateY(" + ((1 - b) * 26).toFixed(1) + "px)";
      sIntro.style.pointerEvents = b > 0.6 ? "auto" : "none";

      // Act 3 — hold, then fly the camera into the pine until it fills the frame.
      // The wrapper only ever SLIDES. It is never CSS-scaled: scaling blows up
      // an already-rendered raster (soft edges) and pushes the model past the
      // element bounds, which is what put a hard vertical cut down the pine at
      // the end of the scroll. All growth comes from the camera dolly below.
      var c = ease(seg(p, 0.66, 1.0));
      var shiftX = b * 16 - c * 16;                 // settles right, returns to centre as it grows
      sTree.style.transform = "translateX(" + shiftX.toFixed(2) + "vw)";

      // Real 3D dolly — stays sharp at any size. The turn is a gentle quarter
      // rotation rather than the old ~full spin, so the approach reads as
      // walking up to the tree instead of the tree twirling.
      var radius = 118 - c * 92;                    // 118% -> 26%
      var theta = 15 + a * 18 + c * 52;             // ~85deg total, eased per act
      var phi = 82 - c * 10;                        // lifts slightly as we close in
      if (sMv) sMv.cameraOrbit = theta.toFixed(1) + "deg " + phi.toFixed(1) + "deg " + radius.toFixed(1) + "%";

      // Dissolve on the last stretch so the canopy hands off to the green
      // section instead of a full-frame tree being swept away when the pin
      // releases — that hard sweep is the "cut" at the end of the scroll.
      sTree.style.opacity = (1 - ease(seg(p, 0.90, 1.0)) * 0.9).toFixed(3);

      // Copy steps aside for the final push so the pine owns the last beat
      sIntro.style.opacity = (b * (1 - ease(seg(p, 0.86, 1.0)) * 0.85)).toFixed(3);

      // Chrome flips to light ONLY while the green ground is actually behind
      // the bar. p clamps at 1 past the stage, so without the r.bottom test the
      // nav would stay white over the cream sections below and vanish.
      var dark = a > 0.55 && r.bottom > 100;
      if (dark !== wasDark) {
        wasDark = dark;
        stage.classList.toggle("is-dark", dark);
        if (topBar) topBar.classList.toggle("on-dark", dark);
      }
    }

    window.addEventListener("scroll", function () {
      if (!stTicking) { stTicking = true; requestAnimationFrame(updateStage); }
    }, { passive: true });
    window.addEventListener("resize", updateStage);
    updateStage();
  }

  // ---- Triangle cursor (desktop only) ----
  var tri = document.getElementById("cursorTri");
  if (tri && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    var tx = 0, ty = 0, cx = 0, cy = 0, ang = 0, tAng = 0, sc = 1, tSc = 1, shown = false;
    document.addEventListener("mousemove", function (e) {
      var dx = e.clientX - tx, dy = e.clientY - ty;
      if (Math.abs(dx) + Math.abs(dy) > 2) tAng = Math.atan2(dy, dx) * 180 / Math.PI;
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; cx = tx; cy = ty; tri.style.opacity = "1"; }
    });
    document.addEventListener("mouseover", function (e) {
      var t = e.target;
      if (t.closest && t.closest("input, textarea")) { tri.style.opacity = "0"; return; }
      if (shown) tri.style.opacity = "1";
      var interactive = !!(t.closest && t.closest("a, button, summary, .linklike"));
      tSc = interactive ? 1.5 : 1;
      tri.classList.toggle("is-link", interactive);
    });
    document.addEventListener("mouseleave", function () { tri.style.opacity = "0"; });
    (function loop() {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      var d = ((tAng - ang + 540) % 360) - 180;
      ang += d * 0.18;
      sc += (tSc - sc) * 0.2;
      tri.style.transform = "translate3d(" + (cx - 11) + "px," + (cy - 11) + "px,0) rotate(" + ang + "deg) scale(" + sc + ")";
      requestAnimationFrame(loop);
    })();
  }

  // ---- Service worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
