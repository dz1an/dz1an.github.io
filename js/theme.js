// ============================================
// Theme Toggle — Code Mode (dark) ↔ Creative Mode (3D)
// ============================================
(function () {
  var savedTheme = localStorage.getItem("theme");
  // Default is dark / code mode (no data-theme attribute needed)
  // Activate creative mode if explicitly saved
  if (savedTheme === "creative") {
    document.documentElement.setAttribute("data-theme", "creative");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    // If saved as creative, lazy-load and start
    if (savedTheme === "creative") {
      if (window.loadCreativeMode) {
        window.loadCreativeMode(function () {
          if (window.creativeScene) window.creativeScene.start();
          startChapterObserver();
          startScrollProgress();
          startShapeCounter();
        });
      } else if (window.creativeScene) {
        window.creativeScene.start();
      }
    }

    function createBuildTerminal(goingCreative) {
      var mode = goingCreative ? "creative" : "code";

      var overlay = document.createElement("div");
      overlay.className = "xc-build-overlay";

      var terminal = document.createElement("div");
      terminal.className = "xc-build-terminal";

      // Title bar (built with DOM API)
      var titlebar = document.createElement("div");
      titlebar.className = "xc-build-titlebar";
      ["xcode-dot-red", "xcode-dot-yellow", "xcode-dot-green"].forEach(function (cls) {
        var dot = document.createElement("span");
        dot.className = "xcode-dot " + cls;
        titlebar.appendChild(dot);
      });
      var titleText = document.createElement("span");
      titleText.className = "xc-build-title";
      titleText.textContent = "kent.dev \u2014 Build Log";
      titlebar.appendChild(titleText);
      terminal.appendChild(titlebar);

      var body = document.createElement("div");
      body.className = "xc-build-body";
      terminal.appendChild(body);

      overlay.appendChild(terminal);
      document.body.appendChild(overlay);

      var lines = goingCreative
        ? [
            { text: "$ xcodebuild -scheme kent.dev -config forest", cls: "xc-cmd" },
            { text: "\u25b8 Loading Three.js runtime...", cls: "" },
            { text: "\u25b8 Compiling ForestScene.swift", cls: "" },
            { text: "\u25b8 Planting 120 trees \u2014 sage green canopy", cls: "" },
            { text: "\u25b8 Lighting 5 lanterns + 12 fireflies", cls: "" },
            { text: "\u2713 Build Succeeded \u2014 Entering the Forest", cls: "xc-success" },
          ]
        : [
            { text: "$ xcodebuild -scheme kent.dev -config code", cls: "xc-cmd" },
            { text: "\u25b8 Leaving the forest...", cls: "" },
            { text: "\u25b8 Compiling ThemeProvider.swift", cls: "" },
            { text: "\u25b8 Restoring dark palette [#1c1c1e]", cls: "" },
            { text: "\u25b8 Linking kent.dev", cls: "" },
            { text: "\u2713 Build Succeeded \u2014 Code Mode Active", cls: "xc-success" },
          ];

      var delay = 250;
      lines.forEach(function (line, i) {
        setTimeout(function () {
          var div = document.createElement("div");
          div.className = "xc-build-line " + line.cls;
          div.textContent = line.text;
          body.appendChild(div);
          body.scrollTop = body.scrollHeight;
        }, delay * (i + 1));
      });

      return overlay;
    }

    function updateThemeColor(color) {
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      metas.forEach(function (m) { m.setAttribute("content", color); });
    }

    function activateCreative() {
      document.documentElement.setAttribute("data-theme", "creative");
      localStorage.setItem("theme", "creative");
      updateThemeColor("#0C1210");

      function startScene() {
        if (window.creativeScene) window.creativeScene.start();
        var scrollEl = document.getElementById("creativeScroll");
        if (scrollEl) scrollEl.scrollTop = 0;
        startShapeCounter();
        startChapterObserver();
        startScrollProgress();
      }

      // Lazy-load Three.js + creative.js if not yet loaded
      if (window.loadCreativeMode) {
        window.loadCreativeMode(startScene);
      } else {
        startScene();
      }
    }

    function deactivateCreative() {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "dark");
      updateThemeColor("#1c1c1e");
      if (window.creativeScene) window.creativeScene.stop();
      stopShapeCounter();
      stopChapterObserver();
      if (window.updateParticleColor) window.updateParticleColor();
    }

    // Toggle button (navbar) — cinematic transition
    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      var goingCreative = current !== "creative";

      if (window.playSound) playSound("build");

      // Create cinematic fade overlay
      var fade = document.createElement("div");
      fade.className = "creative-transition";
      document.body.appendChild(fade);

      // Force reflow then activate
      fade.offsetHeight;
      fade.classList.add("ct-active");

      // Show build terminal on top of fade
      var buildOverlay = createBuildTerminal(goingCreative);

      // At peak darkness, swap modes (after lines have played)
      setTimeout(function () {
        if (goingCreative) {
          activateCreative();
        } else {
          deactivateCreative();
        }
      }, 1800);

      // Fade out after build terminal finishes + brief pause to read
      setTimeout(function () {
        document.documentElement.classList.remove("theme-switching");
        buildOverlay.classList.add("xc-build-done");
        setTimeout(function () { buildOverlay.remove(); }, 500);

        // Begin fade out
        fade.classList.add("ct-fade-out");
        setTimeout(function () { fade.remove(); }, 800);
      }, 2600);

      document.documentElement.classList.add("theme-switching");
    });

    // Back button (creative HUD) — cinematic exit with build terminal
    var backBtn = document.getElementById("creativeBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (window.playSound) playSound("build");

        var fade = document.createElement("div");
        fade.className = "creative-transition";
        document.body.appendChild(fade);
        fade.offsetHeight;
        fade.classList.add("ct-active");

        var buildOverlay = createBuildTerminal(false);
        document.documentElement.classList.add("theme-switching");

        setTimeout(function () {
          deactivateCreative();
        }, 1800);

        setTimeout(function () {
          document.documentElement.classList.remove("theme-switching");
          buildOverlay.classList.add("xc-build-done");
          setTimeout(function () { buildOverlay.remove(); }, 500);

          fade.classList.add("ct-fade-out");
          setTimeout(function () { fade.remove(); }, 800);
        }, 2600);
      });
    }

    // Live shape counter
    var shapeCounterInterval = null;
    var shapeCountEl = document.getElementById("creativeShapeCount");

    function startShapeCounter() {
      if (shapeCounterInterval) return;
      shapeCounterInterval = setInterval(function () {
        if (shapeCountEl && window.creativeScene && window.creativeScene.isRunning()) {
          var canvas = document.getElementById("creativeCanvas");
          // Access shape count from the scene's children count minus static objects
          var count = canvas ? canvas.getAttribute("data-shapes") || "0" : "0";
          shapeCountEl.textContent = "lights: " + count;
        }
      }, 200);
    }

    function stopShapeCounter() {
      if (shapeCounterInterval) {
        clearInterval(shapeCounterInterval);
        shapeCounterInterval = null;
      }
    }

    // Chapter visibility observer
    var chapterObserver = null;

    function startChapterObserver() {
      var scrollContainer = document.getElementById("creativeScroll");
      if (!scrollContainer) return;

      var chapters = scrollContainer.querySelectorAll(".chapter-content");

      chapterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("chapter-visible");
          } else {
            entry.target.classList.remove("chapter-visible");
          }
        });
      }, {
        root: scrollContainer,
        threshold: 0.3
      });

      chapters.forEach(function (ch) { chapterObserver.observe(ch); });
    }

    function stopChapterObserver() {
      if (chapterObserver) {
        chapterObserver.disconnect();
        chapterObserver = null;
      }
      // Reset chapter visibility
      var chapters = document.querySelectorAll(".chapter-content");
      chapters.forEach(function (ch) { ch.classList.remove("chapter-visible"); });
    }

    // Scroll progress bar
    function startScrollProgress() {
      var scrollEl = document.getElementById("creativeScroll");
      var progressEl = document.getElementById("creativeProgress");
      var dots = document.querySelectorAll(".creative-dot");
      if (!scrollEl || !progressEl) return;

      // Click dots to jump to chapters
      dots.forEach(function (dot) {
        dot.addEventListener("click", function () {
          var ch = parseInt(dot.getAttribute("data-chapter"));
          var max = scrollEl.scrollHeight - scrollEl.clientHeight;
          scrollEl.scrollTo({ top: (ch / 10) * max, behavior: "smooth" });
        });
      });

      scrollEl.addEventListener("scroll", function () {
        var max = scrollEl.scrollHeight - scrollEl.clientHeight;
        var pct = max > 0 ? (scrollEl.scrollTop / max) * 100 : 0;
        progressEl.style.width = pct + "%";

        // Update active dot
        var currentCh = Math.min(9, Math.floor((pct / 100) * 10));
        dots.forEach(function (d, i) {
          if (i === currentCh) {
            d.classList.add("active");
          } else {
            d.classList.remove("active");
          }
        });
      });
    }

    // CTA buttons — switch back to portfolio and navigate
    var contactBtn = document.getElementById("creativeContactBtn");
    var projectsBtn = document.getElementById("creativeProjectsBtn");

    // Helper: cinematic exit with build terminal, then navigate to a section
    function cinematicExitTo(sectionId) {
      if (window.playSound) playSound("build");

      var fade = document.createElement("div");
      fade.className = "creative-transition";
      document.body.appendChild(fade);
      fade.offsetHeight;
      fade.classList.add("ct-active");

      var buildOverlay = createBuildTerminal(false);
      document.documentElement.classList.add("theme-switching");

      setTimeout(function () {
        deactivateCreative();
      }, 1800);

      setTimeout(function () {
        document.documentElement.classList.remove("theme-switching");
        buildOverlay.classList.add("xc-build-done");
        setTimeout(function () { buildOverlay.remove(); }, 500);

        fade.classList.add("ct-fade-out");
        setTimeout(function () {
          fade.remove();
          if (sectionId) {
            var el = document.getElementById(sectionId);
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }
        }, 800);
      }, 2600);
    }

    if (contactBtn) {
      contactBtn.addEventListener("click", function (e) {
        e.preventDefault();
        cinematicExitTo("contact");
      });
    }

    if (projectsBtn) {
      projectsBtn.addEventListener("click", function (e) {
        e.preventDefault();
        cinematicExitTo("projects");
      });
    }

    // If starting in creative mode
    if (savedTheme === "creative") {
      startShapeCounter();
      startChapterObserver();
      startScrollProgress();
    }
  });
})();

// ============================================
// Terminal Preloader — Boot Sequence
// ============================================
(function () {
  var bootLines = [
    { text: "loading modules...", delay: 200 },
    { text: '<span class="term-muted">[core]</span> css-variables <span class="term-success">✓</span>', delay: 150 },
    { text: '<span class="term-muted">[core]</span> design-system <span class="term-success">✓</span>', delay: 120 },
    { text: '<span class="term-muted">[plugin]</span> particles.js <span class="term-success">✓</span>', delay: 180 },
    { text: '<span class="term-muted">[plugin]</span> typed.js <span class="term-success">✓</span>', delay: 100 },
    { text: '<span class="term-muted">[plugin]</span> scroll-reveal <span class="term-success">✓</span>', delay: 130 },
    { text: "compiling <span class='term-accent'>//kent.dev</span>...", delay: 300 },
    { text: '<span class="term-success">ready.</span> launching portfolio ↗', delay: 400 },
  ];

  var terminalBody = document.getElementById("terminalBody");
  if (!terminalBody) {
    // Fallback if terminal HTML not found
    window.addEventListener("load", function () {
      document.body.classList.add("loaded");
    });
    return;
  }

  var totalDelay = 300; // initial pause

  bootLines.forEach(function (line) {
    totalDelay += line.delay;
    setTimeout(function () {
      var div = document.createElement("div");
      div.className = "terminal-line";
      div.innerHTML = line.text;
      terminalBody.appendChild(div);
      // Auto-scroll to bottom
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }, totalDelay);
  });

  // After all lines, wait for window load then reveal site
  var bootDone = false;
  var windowLoaded = false;

  function tryReveal() {
    if (bootDone && windowLoaded) {
      document.body.classList.add("loaded");
    }
  }

  setTimeout(function () {
    bootDone = true;
    tryReveal();
  }, totalDelay + 300);

  window.addEventListener("load", function () {
    windowLoaded = true;
    tryReveal();
  });
})();

// ============================================
// Scroll Progress Bar
// ============================================
(function () {
  var progressBar = document.getElementById("scrollProgress");
  if (!progressBar) return;

  window.addEventListener("scroll", function () {
    var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    var progress = (scrollTop / scrollHeight) * 100;
    progressBar.style.width = progress + "%";
  });
})();

// ============================================
// Navbar scroll effect
// ============================================
window.addEventListener("scroll", function () {
  var navbar = document.getElementById("mainNav");
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add("navbar-scrolled");
    } else {
      navbar.classList.remove("navbar-scrolled");
    }
  }
});

// ============================================
// Particle System — Canvas-based hero particles
// ============================================
(function () {
  var canvas = document.getElementById("particleCanvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var particles = [];
  var mouseX = -1000;
  var mouseY = -1000;
  var PARTICLE_COUNT = 80;
  var CONNECTION_DIST = 120;
  var MOUSE_RADIUS = 150;
  var animationId;

  function getParticleColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--particle-color").trim();
  }
  var particleRGB = getParticleColor();

  window.updateParticleColor = function () {
    particleRGB = getParticleColor();
  };

  function resize() {
    var hero = canvas.parentElement;
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.2,
    };
  }

  function init() {
    resize();
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }
  }

  function drawParticle(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(" + particleRGB + ", " + p.opacity + ")";
    ctx.fill();
  }

  function drawConnection(p1, p2, dist) {
    var opacity = (1 - dist / CONNECTION_DIST) * 0.15;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = "rgba(" + particleRGB + ", " + opacity + ")";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // Mouse proximity — push particles away
      var dx = p.x - mouseX;
      var dy = p.y - mouseY;
      var mouseDist = Math.sqrt(dx * dx + dy * dy);
      if (mouseDist < MOUSE_RADIUS) {
        var force = (MOUSE_RADIUS - mouseDist) / MOUSE_RADIUS;
        var angle = Math.atan2(dy, dx);
        p.vx += Math.cos(angle) * force * 0.3;
        p.vy += Math.sin(angle) * force * 0.3;
      }

      // Damping
      p.vx *= 0.99;
      p.vy *= 0.99;

      p.x += p.vx;
      p.y += p.vy;

      // Wrap around
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      drawParticle(p);

      // Connections
      for (var j = i + 1; j < particles.length; j++) {
        var p2 = particles[j];
        var distX = p.x - p2.x;
        var distY = p.y - p2.y;
        var dist = Math.sqrt(distX * distX + distY * distY);
        if (dist < CONNECTION_DIST) {
          drawConnection(p, p2, dist);
        }
      }

      // Mouse connection lines
      if (mouseDist < MOUSE_RADIUS * 1.5) {
        var mOpacity = (1 - mouseDist / (MOUSE_RADIUS * 1.5)) * 0.3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = "rgba(" + particleRGB + ", " + mOpacity + ")";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    animationId = requestAnimationFrame(animate);
  }

  // Track mouse relative to canvas
  canvas.parentElement.addEventListener("mousemove", function (e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  canvas.parentElement.addEventListener("mouseleave", function () {
    mouseX = -1000;
    mouseY = -1000;
  });

  window.addEventListener("resize", function () {
    resize();
  });

  // Pause when not visible for performance
  var heroObserver = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      if (!animationId) animate();
    } else {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  });

  init();
  heroObserver.observe(canvas.parentElement);
  animate();
})();

// ============================================
// Custom Cursor — Xcode Crosshair
// ============================================
(function () {
  var cursor = document.getElementById("customCursor");
  if (!cursor || !window.matchMedia("(pointer: fine)").matches) return;

  var xc = document.getElementById("xcCursor");
  var label = document.getElementById("xcLabel");
  var curX = 0, curY = 0;
  var labelX = 0, labelY = 0;

  document.addEventListener("mousemove", function (e) {
    curX = e.clientX;
    curY = e.clientY;

    // Crosshair follows instantly
    xc.style.left = curX + "px";
    xc.style.top = curY + "px";

    // Label follows with offset
    label.style.left = (curX + 18) + "px";
    label.style.top = (curY + 18) + "px";

    // Update coordinates
    label.textContent = Math.round(curX) + ", " + Math.round(curY);
  });

  // On interactive elements: hide crosshair, show default pointer
  var hoverTargets = document.querySelectorAll("a, button, .tilt-card, .skill-tag, .nav-link, .xcode-tab, .spotlight-item");
  hoverTargets.forEach(function (el) {
    el.addEventListener("mouseenter", function () {
      xc.classList.add("xc-hover");
      label.style.opacity = "0";
    });
    el.addEventListener("mouseleave", function () {
      xc.classList.remove("xc-hover");
      label.style.opacity = "0.7";
    });
  });

  // Hide default cursor globally, restore on interactive elements
  document.body.style.cursor = "none";
  var styleTag = document.createElement("style");
  styleTag.textContent = "a, button, .tilt-card, .skill-tag, .nav-link, .xcode-tab, .spotlight-item { cursor: pointer !important; }";
  document.head.appendChild(styleTag);
})();

// ============================================
// 3D Tilt / Proximity Sensor on Cards
// ============================================
(function () {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  var tiltCards = document.querySelectorAll(".tilt-card");

  tiltCards.forEach(function (card) {
    card.addEventListener("mousemove", function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var centerX = rect.width / 2;
      var centerY = rect.height / 2;

      var rotateX = ((y - centerY) / centerY) * -8;
      var rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform =
        "perspective(800px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg) scale3d(1.02, 1.02, 1.02)";

      // Dynamic shine/glare
      var glareX = (x / rect.width) * 100;
      var glareY = (y / rect.height) * 100;
      var pc = getComputedStyle(document.documentElement).getPropertyValue("--particle-color").trim();
      card.style.background =
        "radial-gradient(circle at " + glareX + "% " + glareY + "%, rgba(" + pc + ",0.08) 0%, transparent 50%), var(--color-bg-card)";
    });

    card.addEventListener("mouseleave", function () {
      card.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale3d(1, 1, 1)";
      card.style.background = "var(--color-bg-card)";
    });

    card.style.transition = "transform 0.4s cubic-bezier(0.03, 0.98, 0.52, 0.99), background 0.3s ease";
    card.style.willChange = "transform";
  });
})();

// ============================================
// Magnetic Buttons
// ============================================
(function () {
  if (!window.matchMedia("(pointer: fine)").matches) return;

  var magneticBtns = document.querySelectorAll(".magnetic-btn");

  magneticBtns.forEach(function (btn) {
    btn.addEventListener("mousemove", function (e) {
      var rect = btn.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;

      btn.style.transform = "translate(" + x * 0.3 + "px, " + y * 0.3 + "px)";
    });

    btn.addEventListener("mouseleave", function () {
      btn.style.transform = "translate(0, 0)";
    });

    btn.style.transition = "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
  });
})();

// ============================================
// Text Scramble Effect on Hero Name
// ============================================
(function () {
  var scrambleEls = document.querySelectorAll(".text-scramble");
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

  function scramble(el) {
    var original = el.getAttribute("data-text");
    if (!original) return;

    var iteration = 0;
    var interval = setInterval(function () {
      el.textContent = original
        .split("")
        .map(function (char, index) {
          if (index < iteration) return original[index];
          if (char === " ") return " ";
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join("");

      if (iteration >= original.length) {
        clearInterval(interval);
      }

      iteration += 1 / 2;
    }, 30);
  }

  // Run on load with stagger
  window.addEventListener("load", function () {
    scrambleEls.forEach(function (el, i) {
      setTimeout(function () {
        scramble(el);
      }, 800 + i * 400);
    });
  });

  // Re-scramble on hover
  scrambleEls.forEach(function (el) {
    el.addEventListener("mouseenter", function () {
      scramble(el);
    });
  });
})();

// ============================================
// Animated Count-Up Numbers
// ============================================
(function () {
  var counters = document.querySelectorAll(".count-up");

  var counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var target = parseInt(el.getAttribute("data-target"), 10);
          var suffix = el.getAttribute("data-suffix") || "";
          var duration = 2000;
          var start = 0;
          var startTime = null;

          function easeOutExpo(t) {
            return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          }

          function update(timestamp) {
            if (!startTime) startTime = timestamp;
            var elapsed = timestamp - startTime;
            var progress = Math.min(elapsed / duration, 1);
            var easedProgress = easeOutExpo(progress);
            var current = Math.floor(easedProgress * target);

            el.textContent = current + suffix;

            if (progress < 1) {
              requestAnimationFrame(update);
            } else {
              el.textContent = target + suffix;
            }
          }

          requestAnimationFrame(update);
          counterObserver.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(function (counter) {
    counterObserver.observe(counter);
  });
})();

// ============================================
// Scroll Reveal — IntersectionObserver
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  var revealElements = document.querySelectorAll(".reveal");

  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  revealElements.forEach(function (el) {
    revealObserver.observe(el);
  });
});

// ============================================
// Bento Cell Staggered Reveal
// ============================================
(function () {
  var grid = document.querySelector(".bento-grid");
  if (!grid) return;

  var bentoCells = grid.querySelectorAll(".bento-cell");

  var bentoObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          bentoCells.forEach(function (cell, i) {
            setTimeout(function () {
              cell.classList.add("bento-revealed");
            }, i * 120);
          });
          bentoObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  bentoObserver.observe(grid);
})();

// ============================================
// Parallax on Scroll
// ============================================
(function () {
  var blobs = document.querySelectorAll(".blob");

  window.addEventListener("scroll", function () {
    var scrollY = window.scrollY;

    blobs.forEach(function (blob, i) {
      var speed = 0.2 + i * 0.1;
      blob.style.transform = "translateY(" + scrollY * speed + "px)";
    });
  });
})();

// ============================================
// Navbar active link on click
// ============================================
window.addEventListener("load", function () {
  var navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();

      var targetId = link.getAttribute("href");
      var targetElement = document.querySelector(targetId);

      if (targetElement) {
        // Flash the target section with a slide-in effect
        targetElement.classList.add("section-enter");
        setTimeout(function () {
          targetElement.classList.remove("section-enter");
        }, 600);

        var targetOffsetTop = targetElement.offsetTop - 80;

        window.scrollTo({
          top: targetOffsetTop,
          behavior: "smooth",
        });

        navLinks.forEach(function (l) {
          l.classList.remove("active");
        });

        link.classList.add("active");

        // Close mobile menu
        var navCollapse = document.getElementById("navbarNav");
        if (navCollapse && navCollapse.classList.contains("show")) {
          var bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
          if (bsCollapse) bsCollapse.hide();
        }
      }
    });
  });
});

// ============================================
// Change navbar active class on scroll
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  var sections = document.querySelectorAll("section");
  var navLinks = document.querySelectorAll(".navbar-nav .nav-link");

  var options = {
    rootMargin: "-100px 0px -60% 0px",
    threshold: 0,
  };

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var sectionId = entry.target.getAttribute("id");
        var navLink = document.querySelector(
          '.navbar-nav .nav-link[href="#' + sectionId + '"]'
        );

        if (navLink) {
          navLinks.forEach(function (link) {
            link.classList.remove("active");
          });
          navLink.classList.add("active");
        }
      }
    });
  }, options);

  sections.forEach(function (section) {
    observer.observe(section);
  });
});

// ============================================
// Typed.js initialization
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  var typingElement = document.querySelector(".typing");
  if (typingElement) {
    new Typed(".typing", {
      strings: [
        "Senior Software Developer",
        "Digital Transformation",
        "Civic Tech Builder",
        "Project Lead",
      ],
      loop: true,
      typeSpeed: 50,
      backSpeed: 30,
      backDelay: 2500,
      startDelay: 500,
    });
  }
});

// ============================================
// macOS Notification Toast
// ============================================
function showToast(title, sub, icon) {
  var toast = document.getElementById("macToast");
  var titleEl = document.getElementById("toastTitle");
  var subEl = document.getElementById("toastSub");
  var iconEl = toast ? toast.querySelector(".mac-toast-icon i") : null;
  if (!toast || !titleEl || !subEl) return;

  titleEl.textContent = title;
  subEl.textContent = sub;
  if (iconEl && icon) {
    iconEl.className = icon;
  }

  toast.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function () {
    toast.classList.remove("show");
  }, 3000);
}

// ============================================
// ============================================
// Email Obfuscation — assembled at runtime
// ============================================
(function () {
  // Split into parts so bots can't scrape a plain email string
  var u = "dzian2k17";
  var d = "gmail";
  var t = "com";
  var addr = u + "@" + d + "." + t;

  // Expose for other scripts
  window._e = function () { return addr; };

  // Populate email link + display
  var link = document.getElementById("emailLink");
  var display = document.getElementById("emailDisplay");

  if (link) {
    link.href = "mai" + "lto:" + addr;
  }
  if (display) {
    display.textContent = addr;
  }
})();

// ============================================
// CV Download + Toast
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  var downloadButton = document.getElementById("downloadCVButton");

  if (downloadButton) {
    downloadButton.addEventListener("click", function () {
      var cvPath = "cv/John_kent_Evangelista_CV.pdf";

      var link = document.createElement("a");
      link.href = cvPath;
      link.download = "John_kent_Evangelista_CV.pdf";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("Download Started", "John_kent_Evangelista_CV.pdf", "fas fa-download");
      if (window.playSound) playSound("success");
    });
  }

  // Copy email button
  var copyEmailBtn = document.getElementById("copyEmailBtn");
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener("click", function () {
      var email = window._e ? window._e() : "";
      navigator.clipboard.writeText(email).then(function () {
        showToast("Copied to Clipboard", email, "fas fa-check");
      });
    });
  }
});

// ============================================
// Smooth scrolling for anchor links
// ============================================
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var targetId = this.getAttribute("href");
      if (targetId === "#") return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var offset = target.offsetTop - 80;
        window.scrollTo({
          top: offset,
          behavior: "smooth",
        });
      }
    });
  });
});

// ============================================
// Cursor glow follow (desktop only)
// ============================================
(function () {
  var glow = document.querySelector(".cursor-glow");
  if (!glow) return;

  if (window.matchMedia("(pointer: fine)").matches) {
    document.addEventListener("mousemove", function (e) {
      glow.style.left = e.clientX + "px";
      glow.style.top = e.clientY + "px";
    });
  } else {
    glow.style.display = "none";
  }
})();

// ============================================
// Code Scroll Spy Widget
// ============================================
(function () {
  var widget = document.getElementById("scrollSpy");
  var sectionEl = document.getElementById("spySection");
  var lineEl = document.getElementById("spyLine");
  if (!widget || !sectionEl || !lineEl) return;

  var sections = document.querySelectorAll("section[id]");
  var sectionMap = {};
  var lineCounter = 1;

  sections.forEach(function (sec, i) {
    sectionMap[sec.id] = { name: "#" + sec.id, line: (i + 1) * 24 };
  });

  function updateSpy() {
    var scrollY = window.scrollY + window.innerHeight / 3;
    var current = "home";

    sections.forEach(function (sec) {
      if (sec.offsetTop <= scrollY && sec.id) {
        current = sec.id;
      }
    });

    var info = sectionMap[current] || { name: "#home", line: 1 };
    sectionEl.textContent = info.name;
    lineEl.textContent = "ln " + info.line;

    // Show/hide based on scroll
    if (window.scrollY > 200) {
      widget.classList.add("visible");
    } else {
      widget.classList.remove("visible");
    }
  }

  window.addEventListener("scroll", updateSpy);
  updateSpy();
})();

// ============================================
// Skill Tags Stagger Animation
// ============================================
(function () {
  var skillContainers = document.querySelectorAll(".skill-tags");

  var skillObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var tags = entry.target.querySelectorAll(".skill-tag");
          tags.forEach(function (tag, i) {
            tag.style.opacity = "0";
            tag.style.transform = "translateY(15px) scale(0.9)";
            setTimeout(function () {
              tag.style.transition = "opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
              tag.style.opacity = "1";
              tag.style.transform = "translateY(0) scale(1)";
            }, 50 * i);
          });
          skillObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  skillContainers.forEach(function (container) {
    skillObserver.observe(container);
  });
})();


// ============================================
// Git Log Tab Switching
(function () {
  var tabs = document.querySelectorAll(".git-tab");
  var workGroup = document.getElementById("gitWork");
  var eduGroup = document.getElementById("gitEdu");
  if (!tabs.length || !workGroup || !eduGroup) return;

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");

      if (tab.getAttribute("data-tab") === "edu") {
        workGroup.style.display = "none";
        eduGroup.style.display = "block";
      } else {
        workGroup.style.display = "block";
        eduGroup.style.display = "none";
      }
    });
  });
})();

// ============================================
// UI Sound Effects (Web Audio API)
// ============================================
(function () {
  var audioCtx = null;
  var muted = localStorage.getItem("sound-muted") === "true";

  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  window.playSound = function (type) {
    if (muted) return;
    try {
      var ctx = getCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "click") {
        osc.frequency.value = 800;
        gain.gain.value = 0.05;
        osc.type = "sine";
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      } else if (type === "build") {
        // Xcode build ding — two ascending tones
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.type = "sine";
        osc.start();
        osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === "success") {
        osc.frequency.value = 523;
        gain.gain.value = 0.06;
        osc.type = "triangle";
        osc.start();
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "konami") {
        osc.frequency.value = 440;
        gain.gain.value = 0.1;
        osc.type = "square";
        osc.start();
        osc.frequency.setValueAtTime(554, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.16);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {}
  };

  // Mute toggle button
  document.addEventListener("DOMContentLoaded", function () {
    var muteBtn = document.getElementById("soundToggle");
    if (!muteBtn) return;

    function updateIcon() {
      var icon = muteBtn.querySelector("i");
      if (icon) {
        icon.className = muted ? "fas fa-volume-mute" : "fas fa-volume-up";
      }
    }
    updateIcon();

    muteBtn.addEventListener("click", function () {
      muted = !muted;
      localStorage.setItem("sound-muted", muted);
      updateIcon();
      if (!muted) playSound("click");
    });
  });

  // Add click sound to buttons
  document.addEventListener("click", function (e) {
    if (e.target.closest("a, button, .nav-link, .spotlight-item, .git-tab")) {
      playSound("click");
    }
  });
})();

// ============================================
// DevTools Easter Egg — Console Message
// ============================================
(function () {
  // Styled console banner
  console.log(
    "%c //kent.dev %c v1.0 ",
    "background: #3A5A40; color: #DAD7CD; font-size: 20px; font-weight: 900; padding: 10px 15px; border-radius: 6px 0 0 6px; font-family: monospace;",
    "background: #5C7650; color: #DAD7CD; font-size: 20px; font-weight: 400; padding: 10px 15px; border-radius: 0 6px 6px 0; font-family: monospace;"
  );

  console.log(
    "%c$ whoami%c\n  John Kent Evangelista\n  Senior Software Developer @ VINTAZK Outsourcing\n  Zamboanga City, Philippines",
    "color: #5C7650; font-weight: 700; font-size: 12px; font-family: monospace;",
    "color: #A3B18A; font-size: 11px; font-family: monospace;"
  );

  console.log(
    "%c$ cat tech-stack.txt%c\n  React · Flutter · Django · Supabase · Python · Node.js · Xcode",
    "color: #5C7650; font-weight: 700; font-size: 12px; font-family: monospace;",
    "color: #A3B18A; font-size: 11px; font-family: monospace;"
  );

  console.log(
    "%c⚠ Hey, curious dev!%c\n  Nice to see you poking around.\n  If you like what you see, let's build something together.\n  → linkedin.com/in/john-kent-evangelista-lsswb-482435307",
    "color: #28c840; font-weight: 700; font-size: 13px; font-family: monospace;",
    "color: #A3B18A; font-size: 11px; font-family: monospace; line-height: 1.6;"
  );

  console.log(
    "%c🎮 Hint: Try the Konami Code (↑↑↓↓←→←→BA)",
    "color: #d19a66; font-size: 10px; font-family: monospace; font-style: italic;"
  );

  console.log("%c🌲 Tip: Toggle creative mode to walk through the forest.", "color: #A3B18A; font-size: 11px;");

  // Detect DevTools — desktop only (mobile viewport changes cause false positives)
  var canDetectDevTools = !(
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    navigator.maxTouchPoints > 1 ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.innerWidth < 1024
  );

  if (canDetectDevTools) {
    var devtoolsOpen = false;
    var threshold = 160;

    function checkDevTools() {
      var widthDiff = window.outerWidth - window.innerWidth > threshold;
      var heightDiff = window.outerHeight - window.innerHeight > threshold;

      if ((widthDiff || heightDiff) && !devtoolsOpen) {
        devtoolsOpen = true;
        if (window.showToast) {
          showToast("DevTools Detected", "Welcome, fellow developer!", "fas fa-terminal");
        }
        if (window.playSound) playSound("success");
      } else if (!widthDiff && !heightDiff) {
        devtoolsOpen = false;
      }
    }

    window.addEventListener("resize", checkDevTools);
    setTimeout(checkDevTools, 2000);
  }
})();

// Konami Code Easter Egg
(function () {
  var konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // ↑↑↓↓←→←→BA
  var konamiIndex = 0;

  document.addEventListener("keydown", function (e) {
    if (e.keyCode === konamiCode[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiCode.length) {
        konamiIndex = 0;
        activateKonami();
      }
    } else {
      konamiIndex = 0;
    }
  });

  function activateKonami() {
    document.documentElement.classList.add("konami-active");
    if (window.playSound) playSound("konami");

    // Show toast
    if (window.showToast) {
      showToast("Konami Code!", "You found the easter egg!", "fas fa-gamepad");
    }

    // Revert after 5 seconds
    setTimeout(function () {
      document.documentElement.classList.remove("konami-active");
    }, 5000);
  }
})();

// Ripple Effect on Buttons
// ============================================
(function () {
  document.querySelectorAll(".btn-primary-custom, .cv-button, .nav-cta").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      var rect = btn.getBoundingClientRect();
      var ripple = document.createElement("span");
      var size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = e.clientX - rect.left - size / 2 + "px";
      ripple.style.top = e.clientY - rect.top - size / 2 + "px";
      ripple.classList.add("btn-ripple");
      btn.style.position = "relative";
      btn.style.overflow = "hidden";
      btn.appendChild(ripple);
      setTimeout(function () {
        ripple.remove();
      }, 600);
    });
  });
})();
