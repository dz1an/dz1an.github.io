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
  // fx3d — the page's 3D accents, all on ONE shared canvas.
  //
  // Instead of one big hero stunt, small scenes are anchored to placeholder
  // elements scattered down the page: the hero vista, the trophy beside the
  // award stat, a stand of pines between sections, the camp at contact.
  //
  // Architecture: one fixed transparent full-viewport canvas, one
  // WebGLRenderer, one scene per accent, drawn with setViewport/setScissor
  // into each placeholder's rect (three.js "multiple elements" pattern). One
  // GL context, one DPR policy, geometry uploaded once and shared.
  //
  // The canvas sits ABOVE section backgrounds but BELOW section content, so an
  // accent paints onto its block and never covers text.
  //
  // Accents are declared in HTML (`data-fx="vista"`), so services.html — which
  // loads this same file but has no placeholders — never fetches three.js at
  // all. Geometry is the baked Kenney set (models/forest.js + models/props.js,
  // sage vertex colours, no textures), lazy-loaded after first paint.
  // ============================================================
  var fx3d = (function () {
    var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
    var renderer = null, canvas = null, accents = [], ready = false, raf = null, t0 = 0;
    var mx = 0, my = 0;                       // raw pointer, vista parallax only
    var isSmall = window.innerWidth < 720;
    var GEOMS = {};                           // decode each model once
    var propMat = null;

    function loadScript(src, done) {
      var s = document.createElement("script");
      // NOTE: onload must NOT be wired straight to done — the browser passes a
      // load Event as the first argument, and done() treats a truthy first
      // argument as an error. That silently failed every boot and left the
      // static fallback mark on screen with no scene at all.
      s.onload = function () { done(); };
      s.onerror = function () { done(new Error("load failed: " + src)); };
      s.src = src;
      document.body.appendChild(s);
    }

    function geom(def, key) {
      if (key && GEOMS[key]) return GEOMS[key];
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
      if (key) GEOMS[key] = g;
      return g;
    }

    function mat() {
      if (!propMat) propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
      return propMat;
    }
    function mesh(def, key) { return new THREE.Mesh(geom(def, key), mat()); }

    // One InstancedMesh per model: {x,y,z, ry, s, t}. t is a brightness tint —
    // the models are baked for the playground's night, so daylight needs a lift.
    function instance(def, list, parent, key) {
      if (!def || !list.length) return null;
      var im = new THREE.InstancedMesh(geom(def, key), mat(), list.length);
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
      parent.add(im);
      return im;
    }

    // Deliberately restrained daylight. Cranked up, the baked foliage blows out
    // to a flat mint and the whole thing reads as a stock asset field.
    function daylight(scene) {
      scene.add(new THREE.AmbientLight(0xDDE4D2, 1.0));
      scene.add(new THREE.HemisphereLight(0xF4F6EC, 0x5A6B4E, 0.75));
      var key = new THREE.DirectionalLight(0xFFF6E2, 1.45);
      key.position.set(-9, 13, 7);
      scene.add(key);
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    var seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

    function pineOf(F) { return F.pineRound || F.treeHigh; }
    function pineH(F) { return F.pineRound ? 1.25 : 2.28; }

    // ---- HERO — one tree ------------------------------------------------
    // Deliberately a SINGLE pine on transparent background: no stand, no
    // ground plane, no fog. A whole forest here read as a stock asset field,
    // and any ground plane inside a scissored rect shows its own hard edge —
    // the accent then looks like a pasted panel instead of part of the page.
    function buildVista(el) {
      var F = window.DZ_FOREST;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      daylight(scene);

      var PINE = pineOf(F), PH = pineH(F);
      var hero = mesh(PINE, "pine");
      hero.scale.setScalar(2.6 / PH);
      scene.add(hero);

      var cmx = 0, cmy = 0;
      return {
        el: el, scene: scene, camera: camera, lw: 0, lh: 0,
        update: function (t, r) {
          // Eased pointer parallax lives here so it stops when the loop sleeps
          cmx += (mx - cmx) * 0.05;
          cmy += (my - cmy) * 0.05;
          hero.rotation.y = t * 0.12;                 // slow, like the old hero
          var p = clamp01(-r.top / (r.height || 1));  // 0 at rest, 1 as it exits
          camera.position.set(cmx * 0.5, 1.3 + p * 0.5 + cmy * 0.25, 6.3);
          camera.lookAt(0, 1.3, 0);
        }
      };
    }

    // ---- TROPHY — the award, turning beside the stat ---------------------
    function buildTrophy(el) {
      var F = window.DZ_FOREST;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
      camera.position.set(0, 0.9, 2.6);
      camera.lookAt(0, 0.55, 0);
      scene.add(new THREE.AmbientLight(0xDDE4D2, 0.9));
      var key = new THREE.DirectionalLight(0xFFF6E2, 1.3);
      key.position.set(2, 3, 2);
      scene.add(key);

      var cup = mesh(F.trophy, "trophy");
      cup.scale.setScalar(1.1 / 0.48);        // model is 0.48 tall
      scene.add(cup);

      return {
        el: el, scene: scene, camera: camera, lw: 0, lh: 0,
        update: function (t) {
          cup.rotation.y = 0.6 + t * 0.35;
          cup.position.y = Math.sin(t * 0.9) * 0.02;
        }
      };
    }

    // ---- CAMP — tent, fire, a log to sit on. The invitation, made literal --
    function buildCamp(el) {
      var F = window.DZ_FOREST, P = window.DZ_PROPS;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
      camera.lookAt(0, 0.7, 0);
      daylight(scene);
      // Extra lift: the camp props are baked for the playground's night, and
      // against the green block they otherwise sink into it.
      scene.add(new THREE.AmbientLight(0xE6EFE2, 0.55));

      // NO ground plane and NO fog here on purpose. Inside a scissored rect
      // either one paints a hard-edged rectangle across the section — the
      // accent then reads as a pasted panel. The props sit straight on the
      // block's own green instead.

      // This anchor is a WIDE band (roughly 6:1), so the camp is spread across
      // it rather than clustered in the middle — props bunched at centre read
      // as a few models floating in dead space.
      if (P) {
        var tent = mesh(P.tent, "tent");
        tent.position.set(-3.5, 0, -0.3);
        tent.rotation.y = 0.6;                 // mouth toward the fire
        scene.add(tent);
        var fire = mesh(P.fire, "fire");
        fire.position.set(-0.1, 0, 0.35);
        scene.add(fire);
        var log1 = mesh(P.log, "log");
        log1.position.set(1.2, 0, 0.5);
        log1.rotation.y = -0.9;
        scene.add(log1);
        var log2 = mesh(P.log, "log");
        log2.position.set(-1.6, 0, 1.0);
        log2.rotation.y = 0.4;
        log2.scale.setScalar(0.85);
        scene.add(log2);
      }
      if (F) {
        // A couple of pines make it a clearing instead of props on a plane,
        // and balance the tent's weight on the left.
        instance(pineOf(F), [
          { x: 4.6, z: -1.8, ry: 0.7, s: 2.6 / pineH(F), t: 0.9 },
          { x: 6.4, z: -3.4, ry: 2.9, s: 2.0 / pineH(F), t: 0.8 },
          { x: -6.2, z: -2.6, ry: 4.4, s: 2.2 / pineH(F), t: 0.85 }
        ], scene, "pine");
        instance(F.stones, [
          { x: -1.0, z: 1.4, ry: 1.2, s: 0.5, t: 0.9 },
          { x: 2.7, z: 0.1, ry: 3.4, s: 0.42, t: 0.85 },
          { x: -4.9, z: 1.2, ry: 0.4, s: 0.36, t: 0.8 }
        ], scene, "stones");
      }

      // Warm glow over the fire — no embers, this is a daylight page
      var glow = new THREE.PointLight(0xFFB871, 0.9, 6);
      glow.position.set(-0.1, 0.7, 0.35);
      scene.add(glow);

      return {
        el: el, scene: scene, camera: camera, lw: 0, lh: 0,
        update: function (t, r, vh) {
          glow.intensity = 0.9 * (1 + 0.12 * Math.sin(t * 6.5) + 0.06 * Math.sin(t * 13));
          var seen = clamp01((vh - r.top) / (vh + (r.height || 1)));
          camera.position.set(0, 1.45 + seen * 0.25, 5.0);
          camera.lookAt(0, 0.75, 0);
        }
      };
    }

    // (The pine-divider accent was removed: a treeline needs a ground plane,
    //  and any ground plane inside a scissored rect draws a hard-edged strip
    //  across the page.)

    var BUILD = { vista: buildVista, trophy: buildTrophy, camp: buildCamp };

    function frame(time) {
      raf = null;
      if (!ready) return;
      if (!t0) t0 = time;
      var t = reduceMotion ? 0 : (time - t0) / 1000;
      var vh = window.innerHeight, any = false;

      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);

      for (var i = 0; i < accents.length; i++) {
        var a = accents[i], r = a.el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > vh) continue;  // off-screen
        any = true;
        a.update(t, r, vh);
        if (r.width !== a.lw || r.height !== a.lh) {
          a.lw = r.width; a.lh = r.height;
          a.camera.aspect = r.width / r.height;
          a.camera.updateProjectionMatrix();
        }
        // three multiplies viewport/scissor by pixelRatio internally, so these
        // are CSS pixels. y is measured from the BOTTOM of the canvas.
        var y = vh - r.bottom;
        renderer.setViewport(r.left, y, r.width, r.height);
        renderer.setScissor(r.left, y, r.width, r.height);
        renderer.render(a.scene, a.camera);
      }
      // Sleep when nothing is on screen; scroll/resize wakes us again. Under
      // reduced motion we never self-chain: one frame per wake keeps the
      // accents glued to their anchors without animating anything.
      if (any && !reduceMotion) raf = requestAnimationFrame(frame);
    }

    function wake() { if (ready && raf === null) raf = requestAnimationFrame(frame); }

    function onResize() {
      if (!renderer) return;
      isSmall = window.innerWidth < 720;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.8));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      wake();
    }

    return {
      boot: function () {
        var slots = document.querySelectorAll("[data-fx]");
        if (!slots.length) return;             // services.html: nothing to do
        var pending = 3, failed = false;
        function settle(err) {
          if (err) failed = true;
          if (--pending > 0) return;
          if (failed || typeof THREE === "undefined" ||
              !window.DZ_FOREST || !window.DZ_PROPS) return;  // fallbacks stay
          try {
            canvas = document.createElement("canvas");
            canvas.id = "fxCanvas";
            renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !isSmall });
            renderer.setClearColor(0x000000, 0);
            renderer.autoClear = false;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 0.95;

            for (var i = 0; i < slots.length; i++) {
              var kind = slots[i].getAttribute("data-fx");
              if (BUILD[kind]) accents.push(BUILD[kind](slots[i]));
              else if (window.console) console.warn("unknown fx accent:", kind);
            }
            if (!accents.length) return;

            onResize();
            document.body.appendChild(canvas);
            ready = true;

            var vista = document.getElementById("heroVista");
            if (vista) vista.classList.add("has-3d");   // fades the SVG mark out

            window.addEventListener("scroll", wake, { passive: true });
            window.addEventListener("resize", onResize, { passive: true });
            canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); });
            canvas.addEventListener("webglcontextrestored", function () { wake(); });
            if (!reduceMotion) {
              document.addEventListener("mousemove", function (e) {
                mx = (e.clientX / window.innerWidth - 0.5) * 2;
                my = (e.clientY / window.innerHeight - 0.5) * 2;
              }, { passive: true });
            }
            wake();
          } catch (e) {
            // Never fail silently — a blank hero with no console trace is the
            // worst possible failure mode here.
            if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
            renderer = null; ready = false;
            if (window.console) console.warn("fx scenes unavailable:", e && e.message);
          }
        }
        loadScript(THREE_URL, settle);
        loadScript("models/forest.js", settle);
        loadScript("models/props.js", settle);
      }
    };
  })();

  // ---- Nav flips to light while a green block is behind the bar ----
  // Replaces the old stage-progress gating. The probe is the line just under
  // the header, so this stays correct no matter how the page is composed (and
  // it keeps working when the announcement bar is dismissed and the bar moves).
  (function () {
    var topBar = document.querySelector(".top");
    var greens = document.querySelectorAll(".blockgreen");
    if (!topBar || !greens.length) return;
    var ticking = false, wasDark = false;
    function check() {
      ticking = false;
      var y = topBar.getBoundingClientRect().bottom - 1;
      var dark = false;
      for (var i = 0; i < greens.length; i++) {
        var r = greens[i].getBoundingClientRect();
        if (r.top <= y && r.bottom >= y) { dark = true; break; }
      }
      if (dark !== wasDark) { wasDark = dark; topBar.classList.toggle("on-dark", dark); }
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    window.addEventListener("resize", check);
    check();
  })();

  // Boot the accents once the page has painted — never before, so the landing
  // content never waits on three.js. Pages without [data-fx] load nothing.
  if (document.querySelector("[data-fx]")) {
    if (document.readyState === "complete") fx3d.boot();
    else window.addEventListener("load", function () { fx3d.boot(); });
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
