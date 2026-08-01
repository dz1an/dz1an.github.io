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
      var radius = 118 - c * 88;                    // 118% -> 30% (as it always was)
      var theta = 15 + a * 18 + c * 52;             // ~85deg total, eased per act
      var phi = 82 - c * 10;                        // lifts slightly as we close in
      if (sMv) sMv.cameraOrbit = theta.toFixed(1) + "deg " + phi.toFixed(1) + "deg " + radius.toFixed(1) + "%";
      // NOTE: do NOT fade the pine out at the end. The copy is already dimming
      // to 15% here, so fading the tree too leaves the last frame as two ghosts
      // on empty green. The pine owns this beat at full strength.

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

  // ============================================================
  // THE PLACE — a pinned fly-through of a small town, built from the baked
  // Kenney Fantasy Town Kit (models/town.js, recoloured to the brand).
  //
  // Full-bleed inside a sticky pin, exactly like the stage. That matters: a
  // scene with ground can only be drawn edge-to-edge, because a boxed one
  // paints a hard rectangle across the page.
  //
  // three.js and the 240KB town data load ONLY when this section comes near —
  // never on first paint, and never at all if the visitor stops before it.
  // ============================================================
  (function () {
    var section = document.getElementById("place");
    var canvas = document.getElementById("placeCanvas");
    if (!section || !canvas || reduceMotion) return;

    var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
    var renderer, scene, camera, raf = null, ready = false, booting = false;
    var progress = 0, t0 = 0;
    var lines = section.querySelectorAll(".place-line");
    var isSmall = window.innerWidth < 720;

    function loadScript(src, done) {
      var s = document.createElement("script");
      s.onload = function () { done(); };                 // never wire done directly: onload passes an Event
      s.onerror = function () { done(new Error(src)); };
      s.src = src;
      document.body.appendChild(s);
    }

    function geom(def) {
      function bytes(str) {
        var bin = atob(str), u = new Uint8Array(bin.length);
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

    var HALF = Math.PI / 2, PI = Math.PI;

    function build() {
      var T = window.DZ_TOWN;
      if (!T) return false;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !isSmall });
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      scene.add(new THREE.AmbientLight(0xE4EADC, 1.15));
      scene.add(new THREE.HemisphereLight(0xF6F7EE, 0x6B7A5E, 0.85));
      var key = new THREE.DirectionalLight(0xFFF6E2, 1.6);
      key.position.set(-9, 14, 8);
      scene.add(key);
      // Cream fog matched to the page so the village edges dissolve instead of
      // ending on a visible boundary
      scene.fog = new THREE.Fog(0xFAFAF7, 26, 62);

      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400),
        new THREE.MeshStandardMaterial({ color: 0xC9CDB6, roughness: 1 })
      );
      ground.rotation.x = -HALF;
      ground.position.y = -0.02;
      scene.add(ground);

      // Collect placements per model, then draw each model as one InstancedMesh
      var buckets = {};
      function put(key, x, y, z, ry, s) {
        (buckets[key] || (buckets[key] = [])).push({ x: x, y: y, z: z, ry: ry || 0, s: s || 1 });
      }
      // Kenney walls sit on their cell's +X edge, so rotation picks the edge:
      // 0 = +X, PI = -X, +90deg = -Z, -90deg = +Z.
      function cottage(cx, cz, w, d, floors, doorAt) {
        for (var i = 0; i < w; i++) {
          for (var j = 0; j < d; j++) {
            var x = cx + i, z = cz + j;
            for (var f = 0; f < floors; f++) {
              var frontZ = (f === 0 && doorAt === "z0" && j === 0 && i === (w >> 1));
              var frontX = (f === 0 && doorAt === "x1" && i === w - 1 && j === (d >> 1));
              if (i === w - 1) put(frontX ? "wallDoor" : (f ? "wallWin" : "wall"), x, f, z, 0);
              if (i === 0) put(f ? "wallWin" : "wall", x, f, z, PI);
              if (j === 0) put(frontZ ? "wallDoor" : (f ? "wallWin" : "wall"), x, f, z, HALF);
              if (j === d - 1) put(f ? "wallWin" : "wall", x, f, z, -HALF);
            }
            put("roofPoint", x, floors, z, 0);
          }
        }
      }

      // Paving: a plaza with a street running out toward the viewer. This is
      // what turns scattered houses into a place.
      function pave(x0, x1, z0, z1) {
        for (var px = x0; px <= x1; px++) for (var pz = z0; pz <= z1; pz++) put("road", px, 0, pz, 0);
      }
      pave(-4, 5, -1, 3);                    // the plaza
      pave(1, 2, 4, 11);                     // the street out toward the viewer
      // Lanes to every plot — without these the buildings read as dropped on
      // bare ground rather than standing on a street
      pave(-8, -5, 0, 0);
      pave(-5, -5, 4, 8);
      pave(-4, 5, -2, -2);
      pave(6, 9, -2, -2);
      pave(6, 8, 1, 1);
      pave(3, 6, 5, 5);
      pave(0, 0, -5, -2);
      pave(-10, -8, 2, 2);
      pave(-11, -9, -2, -2);

      // Buildings around the square — varied footprint and height
      cottage(-8, -1, 2, 2, 2, "x1");
      cottage(-7, 4, 2, 2, 1, "z0");
      cottage(3, -3, 2, 2, 2, "z0");
      cottage(7, 0, 1, 2, 1, "x1");
      cottage(-1, -6, 3, 2, 1, "z0");
      cottage(-4, -3, 2, 2, 2, "x1");
      cottage(6, 5, 2, 2, 2, "z0");
      if (!isSmall) {
        cottage(-10, 2, 2, 1, 1, "z0");
        cottage(9, -4, 2, 2, 1, "x1");
        cottage(-9, -6, 2, 2, 1, "x1");
        cottage(4, 8, 2, 2, 1, "z0");
        cottage(-6, 8, 2, 2, 1, "x1");
      }
      // Mill: a tower with the blades mounted on its +X face
      cottage(-11, -3, 1, 1, 3);
      put("windmill", -10.45, 2.15, -3, 0);

      var CHIM = [[-8, -1, 2], [3, -3, 2], [-4, -3, 2], [6, 5, 2], [-1, -6, 1]];
      for (var ci = 0; ci < CHIM.length; ci++) {
        put("chimney", CHIM[ci][0] + 0.35, CHIM[ci][2] + 0.35, CHIM[ci][1], 0);
      }

      // The square itself
      put("fountain", 1.0, 0, 1.5, 0.3);
      put("stall", -2.4, 0, 0.6, 0.9);
      put("stall", 4.2, 0, 2.6, -1.2);
      put("bench", -0.6, 0, 3.4, 0.2);
      put("bench", 3.2, 0, -0.4, PI);
      put("cart", -3.2, 0, 2.8, 0.6);
      put("cart", 5.6, 0, 6.5, -0.4);
      put("lantern", -1.4, 0, 2.8, 0);
      put("lantern", 4.4, 0, -0.6, 0);
      put("lantern", 0.4, 0, 7.5, 0);
      put("banner", 2.95, 1.1, -2, 0);
      put("banner", -3.05, 1.1, -2, PI);

      // Fences and hedges give the plots edges
      for (var fx = -4; fx <= -1; fx++) put("fence", fx, 0, 6, HALF);
      put("fenceGate", 0, 0, 6, HALF);
      for (var fz = 7; fz <= 9; fz++) put("fence", -4, 0, fz, PI);
      for (var hx = 6; hx <= 9; hx++) put("hedge", hx, 0, 3, HALF);
      for (var hz = 4; hz <= 6; hz++) put("hedge", 9, 0, hz, 0);

      var TREES = [[-12.5, -0.5, 1], [10.5, -3.5, 1], [-8.0, 7.5, 0], [11.0, 3.0, 0],
                   [1.5, -9.0, 1], [-3.0, -9.0, 0], [13.0, 1.0, 1], [-13.5, 4.0, 0],
                   [8.0, 9.5, 1], [-9.5, 10.0, 0], [12.0, 7.0, 0]];
      for (var t = 0; t < TREES.length; t++) {
        put(TREES[t][2] ? "treeHigh" : "tree", TREES[t][0], 0, TREES[t][1], t * 1.7);
      }

      var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
      var dummy = new THREE.Object3D();
      for (var key in buckets) {
        if (!buckets.hasOwnProperty(key) || !T[key]) continue;
        var list = buckets[key];
        var im = new THREE.InstancedMesh(geom(T[key]), mat, list.length);
        for (var k = 0; k < list.length; k++) {
          var it = list[k];
          dummy.position.set(it.x, it.y, it.z);
          dummy.rotation.set(0, it.ry, 0);
          dummy.scale.setScalar(it.s);
          dummy.updateMatrix();
          im.setMatrixAt(k, dummy.matrix);
        }
        im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = false;
        scene.add(im);
      }

      onResize();
      ready = true;
      canvas.classList.add("is-ready");
      return true;
    }

    function onResize() {
      if (!renderer) return;
      isSmall = window.innerWidth < 720;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.8));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function ease(x) { return x * x * (3 - 2 * x); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    // Slow descent: a wide look at the whole village, then down into the square
    function frame(time) {
      raf = null;
      if (!ready) return;
      // Self-limiting: stop as soon as the section leaves the viewport instead
      // of trusting the scroll handler to cancel us. Scrolling back wakes it.
      var vis = section.getBoundingClientRect();
      if (vis.bottom < 0 || vis.top > window.innerHeight) return;
      if (!t0) t0 = time;
      var t = (time - t0) / 1000;
      var p = ease(progress);
      var drift = t * 0.02;

      var dist = lerp(26, 9.5, p);
      var height = lerp(11, 2.6, p);
      var ang = lerp(0.55, -0.35, p) + drift;
      camera.position.set(Math.sin(ang) * dist, height, Math.cos(ang) * dist + 1.5);
      camera.lookAt(0, lerp(1.6, 1.1, p), lerp(-1.5, 0.5, p));

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function tick() { if (ready && raf === null) raf = requestAnimationFrame(frame); }

    function boot() {
      if (booting) return;
      booting = true;
      var pending = 2, failed = false;
      function settle(err) {
        if (err) failed = true;
        if (--pending > 0) return;
        if (failed || typeof THREE === "undefined" || !window.DZ_TOWN) {
          if (window.console) console.warn("town scene unavailable");
          return;
        }
        try {
          if (build()) {
            window.addEventListener("resize", onResize, { passive: true });
            tick();
          }
        } catch (e) {
          if (window.console) console.warn("town scene failed:", e && e.message);
        }
      }
      loadScript(THREE_URL, settle);
      loadScript("models/town.js", settle);
    }

    // Load only when the section is close, and stop rendering once it is gone
    var near = false;
    function onScroll() {
      var r = section.getBoundingClientRect();
      var vh = window.innerHeight;
      if (!near && r.top < vh * 2.5 && r.bottom > -vh) { near = true; boot(); }

      var total = r.height - vh;
      progress = total > 0 ? clamp01(-r.top / total) : 0;

      // Copy: one line at a time as the descent goes on
      var idx = progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2;
      for (var i = 0; i < lines.length; i++) {
        lines[i].classList.toggle("on", i === idx && r.top < vh * 0.8 && r.bottom > vh * 0.2);
      }

      var visible = r.bottom > 0 && r.top < vh;
      if (visible) tick();
      else if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); }
    }, { passive: true });
    onScroll();
  })();

  // ---- Service worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
