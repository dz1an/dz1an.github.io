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

  // ---- 3D pine: scroll-driven — scrolling spins it and drifts it sideways ----
  var mv = document.querySelector(".hero-tree model-viewer");
  var heroEl = document.querySelector(".hero");
  if (mv && !reduceMotion) {
    mv.removeAttribute("auto-rotate"); // scroll owns the rotation now
    var treeTicking = false;
    function updateTree() {
      treeTicking = false;
      var y = window.scrollY || 0;
      var h = heroEl ? Math.max(heroEl.offsetHeight, 1) : 600;
      var p = Math.min(y / h, 1.4);
      // spin: ~0.4deg per px scrolled; scrubs back up when you scroll up
      mv.cameraOrbit = (15 + y * 0.4) + "deg 76deg 108%";
      // side drift + gentle fade as the hero scrolls away
      mv.style.transform = "translateX(" + (-p * 170).toFixed(1) + "px)";
      mv.style.opacity = String(Math.max(0, 1 - p * 0.75).toFixed(2));
    }
    window.addEventListener("scroll", function () {
      if (!treeTicking) { treeTicking = true; requestAnimationFrame(updateTree); }
    }, { passive: true });
    updateTree();
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
