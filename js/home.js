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

  // ============================================================
  // STAGE SCENE — a real stand of pines the scroll flies into.
  //
  // Replaces the old <model-viewer> pine. The whole hero is one continuous
  // camera move: the stand sits centred under the title, slides aside as the
  // intro copy arrives, then the camera dollies through the outer trees and
  // into the hero pine. Everything is a real camera move, never a CSS scale,
  // so it stays sharp at any size.
  //
  // Geometry is the same baked Kenney set the playground uses (models/forest.js
  // — sage vertex colours, no textures). Three.js and that data load lazily
  // AFTER first paint so the landing page is never blocked by them.
  // ============================================================
  var stage3d = (function () {
    var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
    var renderer, scene, camera, island, heroPine, fog, groundMat, raf = null;
    // The page floods from cream to brand green behind the canvas; the fog and
    // floor follow it so the wood is part of the page, not pasted on top.
    var CREAM = { r: 0.949, g: 0.949, b: 0.918 };
    var GREEN = { r: 0.184, g: 0.286, b: 0.231 };
    var ready = false, progress = 0, mx = 0, my = 0, cmx = 0, cmy = 0, t0 = 0;
    var canvas = document.getElementById("stageCanvas");
    var wrap = document.getElementById("stageTree");
    var isSmall = window.innerWidth < 720;

    function loadScript(src, done) {
      var s = document.createElement("script");
      // NOTE: onload must NOT be wired straight to done — the browser passes a
      // load Event as the first argument, and done() treats a truthy first
      // argument as an error. That silently failed every boot and left the
      // static fallback mark on screen with no scene and no scroll transition.
      s.onload = function () { done(); };
      s.onerror = function () { done(new Error("load failed: " + src)); };
      s.src = src;
      document.body.appendChild(s);
    }

    // (The radial ground-fade texture that used to live here is gone: the
    //  floor now dissolves with scene fog instead of an alpha disc, which is
    //  what removed the visible "island on a page" edge.)

    function geom(def) {
      function bytes(s) {
        var bin = atob(s), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u.buffer;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bytes(def.p)), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(bytes(def.n)), 3));
      var cu = new Uint8Array(bytes(def.c)), cf = new Float32Array(cu.length);
      for (var i2 = 0; i2 < cu.length; i2++) cf[i2] = cu[i2] / 255;
      g.setAttribute("color", new THREE.BufferAttribute(cf, 3));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(def.i)), 1));
      return g;
    }

    // One InstancedMesh per model. t lifts the baked (night-tuned) colours into
    // daylight — this page is cream and sage, not a dark wood.
    var propMat = null;
    function instance(def, list) {
      if (!def || !list.length) return null;
      if (!propMat) propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
      var im = new THREE.InstancedMesh(geom(def), propMat, list.length);
      var d = new THREE.Object3D(), col = new THREE.Color();
      for (var k = 0; k < list.length; k++) {
        var it = list[k];
        d.position.set(it.x, it.y || 0, it.z);
        d.rotation.set(0, it.ry || 0, 0);
        d.scale.setScalar(it.s || 1);
        d.updateMatrix();
        im.setMatrixAt(k, d.matrix);
        col.setScalar(it.t === undefined ? 1 : it.t);
        im.setColorAt(k, col);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      island.add(im);
      return im;
    }

    function build() {
      var F = window.DZ_FOREST;
      if (!F || !canvas) return false;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !isSmall });
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;

      // Deliberately restrained light. Cranked up, the baked (night-tuned)
      // foliage blows out to a flat mint green and the whole thing reads as a
      // generic asset-pack field — this keeps it in the brand's sage range.
      scene.add(new THREE.AmbientLight(0xDDE4D2, 1.0));
      scene.add(new THREE.HemisphereLight(0xF4F6EC, 0x5A6B4E, 0.75));
      var key = new THREE.DirectionalLight(0xFFF6E2, 1.45);
      key.position.set(-9, 13, 7);
      scene.add(key);

      // Depth fog is what makes this a wood rather than a field of models:
      // distance dissolves into the page itself. Its colour is re-tinted every
      // frame to match whatever the page is doing (cream -> brand green).
      fog = new THREE.Fog(0xF2F2EA, 12, 46);
      scene.fog = fog;

      island = new THREE.Group();
      scene.add(island);

      // The forest floor. Same colour family as the fog so it never reads as a
      // separate slab — it just gives the trunks something to stand on.
      groundMat = new THREE.MeshStandardMaterial({ color: 0x8C9C7A, roughness: 1 });
      var ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.01;
      island.add(ground);

      // Hero pine — the brand tree, dead centre, the thing we fly into.
      // This is the Nature Kit rounded pine (models/pine.glb, baked into
      // forest.js as pineRound): the same tree as the //dzian mark.
      var PINE = F.pineRound || F.treeHigh;
      var PINE_H = F.pineRound ? 1.25 : 2.28;   // model height, for scaling
      heroPine = new THREE.Mesh(geom(PINE), new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.85
      }));
      heroPine.scale.setScalar(6.2 / PINE_H);
      island.add(heroPine);

      // Composed, not scattered. Even rings of identical trees are exactly
      // what made this read as a stock asset field, so these are hand-placed:
      // a few close ones framing the edges, the rest falling away behind the
      // hero into the fog. x, z, height.
      var STAND = [
        [-6.4,   1.8, 4.6], [ 7.1,   3.2, 5.1], [-9.8,  -3.4, 4.2],
        [ 10.4, -5.6, 4.8], [-4.2,  -8.2, 3.8], [ 4.6,  -9.8, 3.5],
        [-14.5, -9.0, 4.0], [ 15.2, -12.0, 3.9], [-2.6, -16.0, 3.2],
        [ 8.8, -18.5, 3.0], [-11.0, -20.0, 3.1], [ 18.0, -23.0, 3.3],
        [-19.5, -26.0, 3.0], [ 5.0, -28.0, 2.8], [-6.0, -33.0, 2.7],
        [ 13.0, -35.0, 2.9], [-24.0, -38.0, 2.8], [ 2.0, -42.0, 2.6]
      ];
      var seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

      var pines = [];
      for (var i = 0; i < STAND.length; i++) {
        var p3 = STAND[i];
        if (isSmall && i % 3 === 2) continue;          // thin out on phones
        var depth = Math.min(1, Math.abs(p3[1]) / 42);  // farther = paler
        pines.push({
          x: p3[0], z: p3[1], ry: rnd() * 6.283,
          s: (p3[2] + rnd() * 0.4) / PINE_H,
          t: 0.92 - depth * 0.18 + rnd() * 0.1
        });
      }
      instance(PINE, pines);

      // A handful of rocks at the hero's feet for scale. No grass patches —
      // dark tufts dotted over a pale floor were the "swamp" read.
      instance(F.stones, [
        { x: -2.9, z: 1.6, ry: 0.6, s: 0.85, t: 1.05 },
        { x: 3.4, z: -1.2, ry: 2.4, s: 0.62, t: 1.0 },
        { x: -5.6, z: -4.4, ry: 4.1, s: 0.7, t: 0.95 }
      ]);

      onResize();
      ready = true;
      wrap.classList.add("has-3d");
      canvas.classList.add("is-ready");
      return true;
    }

    function onResize() {
      if (!renderer || !wrap) return;
      var w = wrap.clientWidth || window.innerWidth;
      var h = wrap.clientHeight || window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.8));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
    function ease(x) { return x * x * (3 - 2 * x); }

    // The camera move IS the hero. Three beats, matching the copy:
    //   1. the stand sits centred under the title
    //   2. it swings aside as the intro arrives
    //   3. the camera drives through the outer trees into the hero pine
    function frame(time) {
      raf = null;
      if (!ready) return;
      if (!t0) t0 = time;
      var t = (time - t0) / 1000;
      var p = progress;

      var a = ease(seg(p, 0.0, 0.34));    // settle in
      var b = ease(seg(p, 0.28, 0.56));   // swing aside
      var c = ease(seg(p, 0.62, 1.0));    // fly in

      // Fog + floor track the page flood, so the horizon always dissolves into
      // whatever colour the page is behind the canvas.
      var flood = ease(seg(p, 0.02, 0.30));
      var fr = CREAM.r + (GREEN.r - CREAM.r) * flood;
      var fg = CREAM.g + (GREEN.g - CREAM.g) * flood;
      var fb = CREAM.b + (GREEN.b - CREAM.b) * flood;
      fog.color.setRGB(fr, fg, fb);
      groundMat.color.setRGB(fr * 0.72, fg * 0.78, fb * 0.66);
      // Pull the fog in as we push through the trees
      fog.near = 12 - c * 9;
      fog.far = 46 - c * 26;

      // Eye level, not a diorama seen from above — a high camera looking down
      // on evenly spaced trees is what read as a model railway.
      var dist = 19 - a * 3.5 - c * 14.3;             // 19 -> 15.5 -> 1.2
      var height = 3.1 - a * 0.5 + c * 0.6;
      var orbit = -0.42 + a * 0.28 + b * 0.42 + c * 0.5 + t * 0.012; // always drifting
      camera.position.set(
        Math.sin(orbit) * dist + cmx * (0.9 - c * 0.7),
        height + cmy * 0.4,
        Math.cos(orbit) * dist
      );
      // Aim up the trunk as we close in, so the pine fills the frame
      camera.lookAt(0, 2.4 + c * 2.2, 0);

      // The stand slides right while the copy takes the left
      island.position.x = b * 4.6 - c * 3.2;

      renderer.render(scene, camera);
      if (!reduceMotion) raf = requestAnimationFrame(frame);
    }

    function tick() { if (ready && raf === null) raf = requestAnimationFrame(frame); }

    return {
      setProgress: function (p) { progress = p; if (reduceMotion) tick(); },
      setPointer: function (x, y) { mx = x; my = y; },
      resize: function () { onResize(); tick(); },
      // Lazy boot: three.js + the baked models in parallel, after first paint
      boot: function () {
        if (!canvas || !wrap) return;
        var pending = 2, failed = false;
        function settle(err) {
          if (err) failed = true;
          if (--pending > 0) return;
          if (failed || typeof THREE === "undefined") return; // SVG mark stays
          try {
            if (build()) {
              // Cursor parallax, eased
              if (!reduceMotion) {
                document.addEventListener("mousemove", function (e) {
                  stage3d.setPointer((e.clientX / window.innerWidth - 0.5) * 2,
                                     (e.clientY / window.innerHeight - 0.5) * 2);
                }, { passive: true });
                (function ease3d() {
                  cmx += (mx - cmx) * 0.05; cmy += (my - cmy) * 0.05;
                  requestAnimationFrame(ease3d);
                })();
              }
              tick();
            }
          } catch (e) {
            // Keep the SVG mark, but never fail silently — a blank hero with
            // no console trace is the worst possible failure mode here.
            if (window.console) console.warn("stage scene unavailable:", e && e.message);
          }
        }
        loadScript(THREE_URL, settle);
        loadScript("models/forest.js", settle);
      }
    };
  })();

  // ---- STAGE: one pinned scroll scene (hero title -> brand ground -> intro) ----
  var stage = document.getElementById("stage");
  if (stage && !reduceMotion) {
    var sBg = stage.querySelector(".stage-bg");
    var sTitle = document.getElementById("stageTitle");
    var sIntro = document.getElementById("stageIntro");
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

      // Act 3 — the camera itself flies into the stand. The wrapper is NOT
      // scaled: the dolly happens inside the WebGL scene so it stays sharp.
      stage3d.setProgress(p);

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

  // Boot the WebGL stand once the page has painted — never before, so the
  // landing content is never waiting on three.js. Under reduced motion it
  // still builds, renders one composed frame, and never starts a loop.
  if (stage) {
    if (document.readyState === "complete") stage3d.boot();
    else window.addEventListener("load", function () { stage3d.boot(); });
    window.addEventListener("resize", function () { stage3d.resize(); }, { passive: true });
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

  // ---- Masked line reveals on headings ----
  // Splits a heading into per-line bands that rise into place when scrolled to.
  // Done in JS so the HTML stays plain text (and reads fine with JS disabled).
  (function () {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var heads = document.querySelectorAll(".bg-head, .light-head");
    if (!heads.length) return;

    function split(el) {
      // Only split simple headings — anything with links or nested markup we
      // leave alone rather than risk destroying it.
      var kids = el.childNodes, parts = [], ok = true;
      for (var i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n.nodeType === 3) { if (n.textContent.trim()) parts.push({ html: n.textContent }); }
        else if (n.nodeType === 1 && n.tagName === "BR") { /* line break */ }
        else if (n.nodeType === 1 && /^(SPAN|EM|STRONG|I|B)$/.test(n.tagName) && !n.querySelector("a")) {
          parts.push({ html: n.outerHTML });
        } else { ok = false; break; }
      }
      if (!ok || !parts.length) return false;
      var html = "";
      for (var j = 0; j < parts.length; j++) {
        html += '<span class="rl-line"><span>' + parts[j].html + "</span></span>";
      }
      el.innerHTML = html;
      return true;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("rl-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.25 });

    Array.prototype.forEach.call(heads, function (h) {
      if (split(h)) io.observe(h);
    });
  })();

  // ---- Stat counters ----
  // Counts up to the number already in the markup, keeping any +/st suffix.
  (function () {
    var stats = document.querySelectorAll(".bg-stats strong, .pnum");
    if (!stats.length || reduceMotion || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, raw = el.textContent.trim();
        var m = raw.match(/^(\d[\d,]*)(.*)$/);
        if (!m) return;
        var target = parseInt(m[1].replace(/,/g, ""), 10), suffix = m[2] || "";
        if (!target || target > 100000) return;
        var start = 0, dur = 1100, t0 = 0;
        function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur);
          var eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(start + (target - start) * eased).toLocaleString() + suffix;
          if (k < 1) requestAnimationFrame(step);
        }
        el.textContent = "0" + suffix;
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(stats, function (s) { io.observe(s); });
  })();

  // ---- Magnetic buttons (fine pointers only) ----
  (function () {
    if (reduceMotion || !window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;
    var btns = document.querySelectorAll(".btn");
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.add("is-magnetic");
      b.addEventListener("mousemove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = "translate(" + (dx * 14).toFixed(1) + "px," + (dy * 10).toFixed(1) + "px)";
      });
      b.addEventListener("mouseleave", function () { b.style.transform = ""; });
    });
  })();

  // ---- Service worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
