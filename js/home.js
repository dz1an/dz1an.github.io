// ============================================
// //kent.dev — client-first home page JS
// ============================================
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  // Email assembled at runtime (keeps scrapers off the plain string)
  function getEmail() {
    return "dzian2k17" + "@" + "gmail.com";
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

  // ---- Mobile nav ----
  var burger = document.getElementById("navBurger");
  var links = document.getElementById("navLinks");
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      }
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
        setResult("ok", "Opening your email app so you can send directly…");
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

  // ---- Service worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
