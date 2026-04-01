// ============================================
// Theme Toggle (dark default, persist to localStorage)
// ============================================
(function () {
  var savedTheme = localStorage.getItem("theme");
  // Default is dark (no data-theme attribute needed)
  // Only set light if explicitly saved
  if (savedTheme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      if (current === "light") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
      }

      // Update particle colors live
      if (window.updateParticleColor) {
        window.updateParticleColor();
      }

      // Aftershock ripple effect
      var aftershock = document.getElementById("toggleAftershock");
      if (aftershock) {
        aftershock.classList.remove("active");
        // Force reflow to restart animation
        void aftershock.offsetWidth;
        aftershock.classList.add("active");
        setTimeout(function () {
          aftershock.classList.remove("active");
        }, 750);
      }
    });
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
// Custom Cursor
// ============================================
(function () {
  var cursor = document.getElementById("customCursor");
  if (!cursor || !window.matchMedia("(pointer: fine)").matches) return;

  var dot = cursor.querySelector(".cursor-dot");
  var ring = cursor.querySelector(".cursor-ring");
  var curX = 0, curY = 0;
  var ringX = 0, ringY = 0;

  document.addEventListener("mousemove", function (e) {
    curX = e.clientX;
    curY = e.clientY;
    dot.style.left = curX + "px";
    dot.style.top = curY + "px";
  });

  function ringFollow() {
    ringX += (curX - ringX) * 0.15;
    ringY += (curY - ringY) * 0.15;
    ring.style.left = ringX + "px";
    ring.style.top = ringY + "px";
    requestAnimationFrame(ringFollow);
  }
  ringFollow();

  // Grow cursor on interactive elements + stop blink
  var hoverTargets = document.querySelectorAll("a, button, .tilt-card, .skill-tag, .nav-link");
  hoverTargets.forEach(function (el) {
    el.addEventListener("mouseenter", function () {
      ring.classList.add("cursor-hover");
      dot.style.animation = "none";
      dot.style.opacity = "1";
      dot.style.height = "8px";
      dot.style.width = "8px";
      dot.style.borderRadius = "1px";
    });
    el.addEventListener("mouseleave", function () {
      ring.classList.remove("cursor-hover");
      dot.style.animation = "cursor-blink 1s step-end infinite";
      dot.style.height = "18px";
      dot.style.width = "2px";
      dot.style.borderRadius = "1px";
    });
  });

  // Hide default cursor
  document.body.style.cursor = "none";
  document.querySelectorAll("a, button").forEach(function (el) {
    el.style.cursor = "none";
  });
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
  var floatBadges = document.querySelectorAll(".hero-float-badge");

  window.addEventListener("scroll", function () {
    var scrollY = window.scrollY;

    blobs.forEach(function (blob, i) {
      var speed = 0.2 + i * 0.1;
      blob.style.transform = "translateY(" + scrollY * speed + "px)";
    });

    floatBadges.forEach(function (badge, i) {
      var speed = 0.05 + i * 0.03;
      badge.style.transform = "translateY(" + scrollY * -speed + "px)";
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
        var targetOffsetTop = targetElement.offsetTop - 80;

        window.scrollTo({
          top: targetOffsetTop,
          behavior: "smooth",
        });

        navLinks.forEach(function (l) {
          l.classList.remove("active");
        });

        link.classList.add("active");
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
    });
  }

  // Copy email button
  var copyEmailBtn = document.getElementById("copyEmailBtn");
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener("click", function () {
      navigator.clipboard.writeText("dzian2k17@gmail.com").then(function () {
        showToast("Copied to Clipboard", "dzian2k17@gmail.com", "fas fa-check");
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
// Timeline Items Stagger
// ============================================
(function () {
  var timelines = document.querySelectorAll(".timeline");

  var timelineObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var items = entry.target.querySelectorAll(".timeline-item");
          items.forEach(function (item, i) {
            item.style.opacity = "0";
            item.style.transform = "translateX(-20px)";
            setTimeout(function () {
              item.style.transition = "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
              item.style.opacity = "1";
              item.style.transform = "translateX(0)";
            }, 150 * i);
          });
          timelineObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  timelines.forEach(function (tl) {
    timelineObserver.observe(tl);
  });
})();

// ============================================
// Ripple Effect on Buttons
// ============================================
(function () {
  document.querySelectorAll(".btn-primary-custom, .btn-email, .cv-button, .nav-cta").forEach(function (btn) {
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
