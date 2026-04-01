// ============================================
// Creative Mode — //kent.dev Forest
// A scroll-driven walk through a procedural forest
// Projects are lanterns. Tech are fireflies.
// ============================================
(function () {
  var scene, camera, renderer, clock;
  var canvas = null;
  var isActive = false;
  var animationId = null;
  var resizeTimeout = null;

  var scrollProgress = 0;
  var scrollVelocity = 0;
  var lastScrollProgress = 0;
  var mouse = { ndcX: 0, ndcY: 0 };
  var isMouseDown = false;
  var raycaster, mouseVec;

  // Pools
  var trees = [];
  var lanterns = [];
  var fireflies = [];
  var trails = [];
  var spawned = [];

  // Mobile detection
  var isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth < 768 && "ontouchstart" in window);

  var MAX_TRAILS = isMobile ? 20 : 50;
  var MAX_SPAWNED = isMobile ? 12 : 25;
  var TREE_COUNT = isMobile ? 50 : 120;
  var AMBIENT_FF_COUNT = isMobile ? 15 : 40;
  var PATH_LAMP_COUNT = isMobile ? 5 : 10;
  var lastTouchSpawn = 0;

  // === Palette ===
  var SAGE = {
    deep: 0x344E41, dark: 0x3A5A40, primary: 0x5C7650,
    accent: 0xA3B18A, light: 0xDAD7CD, muted: 0x6B8F71,
    soft: 0x97A97C, cream: 0xB5C99A
  };
  var TRUNK_COLORS = [0x2D1B0E, 0x3B2314, 0x4A2E1A, 0x362015];
  var CANOPY_COLORS = [0x344E41, 0x3A5A40, 0x5C7650, 0x2D4233, 0x4A6B3F, 0x3D5C35];

  var PROJECTS = [
    { name: "Vintech",     sub: "Outsourcing Platform", color: 0xE8C87A },
    { name: "ZamGo",       sub: "636+ Businesses",      color: 0xD4A855 },
    { name: "Vintazk Uni", sub: "Learning System",      color: 0xF0D68A },
    { name: "Barangay\nConnect", sub: "Civic Tech",     color: 0xC9A24D },
    { name: "SmartScore",  sub: "AI Grading",           color: 0xDEB860 }
  ];

  var TECH = [
    "React","Supabase","Python","Flutter","Node.js","Django",
    "OpenCV","PostgreSQL","Git","Xcode","Claude Code","n8n"
  ];

  // Camera path — forest walk
  // 10 chapters — longer path through the forest
  var CAMERA_PATH = [
    { at: 0.00, pos: [0, 4, 55],     look: [0, 2, 0] },     // Ch0: Wide entrance
    { at: 0.08, pos: [0, 3.5, 42],   look: [0, 2, -5] },    // Walking in
    { at: 0.14, pos: [-3, 3, 32],    look: [2, 2, 0] },     // Ch1: The path
    { at: 0.22, pos: [2, 2.8, 22],   look: [0, 3, 0] },     // Approaching clearing
    { at: 0.28, pos: [4, 3, 14],     look: [0, 3.5, 0] },   // Ch2: The clearing
    { at: 0.34, pos: [7, 3.2, 8],    look: [0, 3, -2] },    // Ch3: Methodology
    { at: 0.42, pos: [10, 3.5, 0],   look: [5, 3, -10] },   // Ch4: First lanterns
    { at: 0.50, pos: [8, 4, -6],     look: [2, 3, -14] },   // Among lanterns
    { at: 0.58, pos: [4, 4.5, -12],  look: [-2, 3, -18] },  // Ch5: The grove
    { at: 0.65, pos: [-2, 3.5, -18], look: [-8, 3, -22] },  // Into deep woods
    { at: 0.72, pos: [-8, 3, -22],   look: [-12, 4, -26] }, // Ch6: Fireflies
    { at: 0.78, pos: [-12, 4, -16],  look: [-5, 4, -10] },  // Ch7: The award
    { at: 0.84, pos: [-8, 6, -8],    look: [0, 3, 0] },     // Ch8: Rising
    { at: 0.92, pos: [-3, 10, 8],    look: [0, 2, -5] },    // Above canopy
    { at: 1.00, pos: [0, 16, 22],    look: [0, 0, -5] }     // Ch9: Aerial overview
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function getCameraState(p) {
    p = Math.max(0, Math.min(1, p));
    var i = 0;
    for (var k = 0; k < CAMERA_PATH.length - 1; k++) {
      if (p >= CAMERA_PATH[k].at && p <= CAMERA_PATH[k + 1].at) { i = k; break; }
      if (k === CAMERA_PATH.length - 2) i = k;
    }
    var a = CAMERA_PATH[i], b = CAMERA_PATH[i + 1];
    var t = (p - a.at) / (b.at - a.at);
    t = t * t * (3 - 2 * t);
    return {
      px: lerp(a.pos[0], b.pos[0], t), py: lerp(a.pos[1], b.pos[1], t), pz: lerp(a.pos[2], b.pos[2], t),
      lx: lerp(a.look[0], b.look[0], t), ly: lerp(a.look[1], b.look[1], t), lz: lerp(a.look[2], b.look[2], t)
    };
  }

  // Simple noise
  function noise2D(x, z) {
    return Math.sin(x * 0.1 + z * 0.05) * Math.cos(z * 0.08 - x * 0.03) + Math.sin(x * 0.03 + z * 0.07) * 0.5;
  }

  // Text sprite factory
  function makeLabel(text, opts) {
    opts = opts || {};
    var fs = opts.fontSize || 22, fw = opts.fontWeight || "500", col = opts.color || "#DAD7CD", sub = opts.sub || "";
    var cvs = document.createElement("canvas"), ctx = cvs.getContext("2d");
    ctx.font = fw + " " + fs + "px Inter,system-ui,sans-serif";
    var lines = text.split("\n"), maxW = 0;
    lines.forEach(function (l) { var w = ctx.measureText(l).width; if (w > maxW) maxW = w; });
    var lh = fs * 1.2, subH = sub ? fs * 0.5 : 0, pad = 10;
    cvs.width = maxW + pad * 2; cvs.height = lines.length * lh + subH + pad * 2;
    ctx.font = fw + " " + fs + "px Inter,system-ui,sans-serif";
    ctx.fillStyle = col; ctx.textAlign = "center"; ctx.textBaseline = "top";
    lines.forEach(function (l, i) { ctx.fillText(l, cvs.width / 2, pad + i * lh); });
    if (sub) {
      ctx.font = "400 " + Math.round(fs * 0.42) + "px Inter,system-ui,sans-serif";
      ctx.fillStyle = "rgba(163,177,138,0.55)";
      ctx.fillText(sub, cvs.width / 2, pad + lines.length * lh + 2);
    }
    var tex = new THREE.CanvasTexture(cvs); tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: opts.opacity || 0.85, depthWrite: false }));
    var sc = opts.scale || 1.5; sp.scale.set(sc * (cvs.width / cvs.height), sc, 1);
    return sp;
  }

  // ======================== Init ========================
  function init() {
    canvas = document.getElementById("creativeCanvas");
    if (!canvas || typeof THREE === "undefined") return false;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0C1210);
    scene.fog = new THREE.Fog(0x0C1210, 10, 65);
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 4, 50);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isMobile;
    if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    raycaster = new THREE.Raycaster(); mouseVec = new THREE.Vector2();

    // Lighting — dark moonlit forest, lit by lanterns and fireflies
    scene.add(new THREE.AmbientLight(0x1a2e22, 0.5));
    var moon = new THREE.DirectionalLight(0x8899AA, 0.6);
    moon.position.set(-20, 30, 10); moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 1; moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -40; moon.shadow.camera.right = 40;
    moon.shadow.camera.top = 40; moon.shadow.camera.bottom = -40;
    scene.add(moon); scene._moon = moon;

    var f1 = new THREE.PointLight(0x5C7650, 0.4, 40); f1.position.set(5, 6, 10);
    var f2 = new THREE.PointLight(0xA3B18A, 0.3, 35); f2.position.set(-8, 4, -10);
    var f3 = new THREE.PointLight(0x344E41, 0.2, 30); f3.position.set(0, 8, -20);
    scene.add(f1, f2, f3); scene._fills = [f1, f2, f3];

    buildTerrain(); plantForest(); createCoreLantern();
    createProjectLanterns(); createFireflies(); createMist();
    createPathLamps(); createAmbientFireflies();

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", function () { isMouseDown = true; });
    canvas.addEventListener("mouseup", function () { isMouseDown = false; });
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("touchmove", onTouchDrag, { passive: false });
    canvas.addEventListener("touchend", function () { isMouseDown = false; });
    window.addEventListener("resize", onResize);
    return true;
  }

  // ======================== Terrain ========================
  function buildTerrain() {
    var geo = new THREE.PlaneGeometry(120, 120, 80, 80);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      var h = noise2D(x, y) * 1.2;
      var d = Math.sqrt(x * x + y * y);
      if (d < 8) h *= d / 8;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    var terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1A2E1C, roughness: 0.95, flatShading: true }));
    terrain.rotation.x = -Math.PI / 2; terrain.receiveShadow = true;
    scene.add(terrain); scene._terrain = terrain;
  }

  // ======================== Forest ========================
  function plantForest() {
    for (var i = 0; i < TREE_COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 8 + Math.random() * 50;
      var x = Math.cos(angle) * dist, z = Math.sin(angle) * dist - 10;
      if (Math.abs(x) > 55 || Math.abs(z) > 55) continue;

      var height = 3 + Math.random() * 7;
      var trunkH = height * (0.4 + Math.random() * 0.2);
      var canopyH = height * (0.5 + Math.random() * 0.3);
      var canopyR = 1.2 + Math.random() * 2.5;
      var trunkR = 0.1 + Math.random() * 0.2;
      var gY = noise2D(x, z) * 1.2;
      var dC = Math.sqrt(x * x + (z + 10) * (z + 10));
      if (dC < 8) gY *= dC / 8;

      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, 6),
        new THREE.MeshStandardMaterial({ color: TRUNK_COLORS[i % 4], roughness: 0.9 })
      );
      trunk.position.set(x, gY + trunkH / 2, z); trunk.castShadow = true;
      scene.add(trunk);

      var layers = 2 + Math.floor(Math.random() * 2);
      for (var j = 0; j < layers; j++) {
        var lr = canopyR * (1 - j * 0.2), lh = canopyH * (0.6 + j * 0.15);
        var cone = new THREE.Mesh(
          new THREE.ConeGeometry(lr, lh, 7 + Math.floor(Math.random() * 3)),
          new THREE.MeshStandardMaterial({ color: CANOPY_COLORS[Math.floor(Math.random() * 6)], roughness: 0.8, flatShading: true })
        );
        cone.position.set(x, gY + trunkH + lh * 0.35 + j * canopyH * 0.25, z);
        cone.rotation.y = Math.random() * Math.PI; cone.castShadow = true;
        scene.add(cone);
      }
      trees.push({ x: x, z: z });
    }
  }

  // ======================== Core Lantern ========================
  function createCoreLantern() {
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshBasicMaterial({ color: 0xA3B18A, transparent: true, opacity: 0.3 }));
    orb.position.set(0, 4, 0); scene.add(orb); scene._coreOrb = orb;
    // Orbiting embers around the core lantern
    var embers = [];
    for (var ei = 0; ei < 20; ei++) {
      var ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xA3B18A, transparent: true, opacity: 0.5 + Math.random() * 0.4 })
      );
      ember.position.set(0, 4, 0);
      ember.userData = {
        radius: 0.8 + Math.random() * 1.5,
        speed: 0.3 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        tilt: (Math.random() - 0.5) * Math.PI * 0.8,
        yOffset: (Math.random() - 0.5) * 1.5
      };
      scene.add(ember);
      embers.push(ember);
    }
    scene._coreEmbers = embers;
    var cl = new THREE.PointLight(0xA3B18A, 1.5, 20); cl.position.set(0, 4, 0); scene.add(cl); scene._coreLight = cl;
    var brand = makeLabel("//kent.dev", { fontSize: 32, fontWeight: "700", color: "#A3B18A", scale: 2.2, opacity: 0.7 });
    brand.position.set(0, 7, 0); scene.add(brand); scene._brandLabel = brand;
    var sub = makeLabel("Senior Software Developer", { fontSize: 15, fontWeight: "400", color: "rgba(163,177,138,0.45)", scale: 1.8, opacity: 0.45 });
    sub.position.set(0, 6, 0); scene.add(sub); scene._brandSub = sub;
  }

  // ======================== Project Lanterns ========================
  function createProjectLanterns() {
    var positions = [{ x: 6, z: -8 }, { x: 3, z: -14 }, { x: 9, z: -12 }, { x: -1, z: -10 }, { x: 5, z: -18 }];
    PROJECTS.forEach(function (proj, i) {
      var p = positions[i], y = 3 + Math.random() * 2;
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhysicalMaterial({
        color: proj.color, emissive: proj.color, emissiveIntensity: 0.5, transparent: true, opacity: 0.8,
        roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05
      }));
      mesh.position.set(p.x, y, p.z); scene.add(mesh);
      var light = new THREE.PointLight(proj.color, 0.6, 8); light.position.set(p.x, y, p.z); scene.add(light);
      var label = makeLabel(proj.name, { fontSize: 20, fontWeight: "600", color: "#DAD7CD", sub: proj.sub, scale: 1.4, opacity: 0.8 });
      label.position.set(p.x, y + 1.2, p.z); scene.add(label);
      lanterns.push({ mesh: mesh, light: light, label: label, baseY: y, x: p.x, z: p.z });
    });
  }

  // ======================== Fireflies (Tech) ========================
  function createFireflies() {
    var ffColors = [0xA3B18A, 0xB5C99A, 0xDAD7CD, 0x97A97C, 0x6B8F71];
    TECH.forEach(function (name, i) {
      var angle = (i / TECH.length) * Math.PI * 2 + Math.random() * 0.5;
      var r = 12 + Math.random() * 15;
      var x = Math.cos(angle) * r, z = Math.sin(angle) * r - 15, y = 2 + Math.random() * 5;
      var color = ffColors[i % ffColors.length];
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 }));
      mesh.position.set(x, y, z); scene.add(mesh);
      var light = null;
      if (!isMobile) { light = new THREE.PointLight(color, 0.3, 4); light.position.set(x, y, z); scene.add(light); }
      var label = makeLabel(name, { fontSize: 14, fontWeight: "500", color: "rgba(218,215,205,0.6)", scale: 0.9, opacity: 0.5 });
      label.position.set(x, y + 0.6, z); scene.add(label);
      fireflies.push({
        mesh: mesh, light: light, label: label, baseX: x, baseY: y, baseZ: z, color: color,
        phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 1.5,
        ampX: 0.5 + Math.random() * 1.5, ampY: 0.3 + Math.random() * 0.8, ampZ: 0.5 + Math.random() * 1.5
      });
    });
  }

  // ======================== Mist ========================
  function createMist() {
    var n = 400, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = Math.random() * 3 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var mist = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x2D4A3A, size: 1.5, transparent: true, opacity: 0.08, sizeAttenuation: true, depthWrite: false }));
    scene.add(mist); scene._mist = mist;
  }

  // ======================== Path Lamps — warm lights along the walk ========================
  function createPathLamps() {
    // Place lamps along the camera path to illuminate the journey
    var lampPositions = [
      { x: -2, z: 40, y: 2.5 },   // Near entrance
      { x: 3, z: 30, y: 2.5 },    // Along path
      { x: -1, z: 20, y: 2.5 },   // Approaching clearing
      { x: 5, z: 10, y: 2.5 },    // Near clearing
      { x: 8, z: 2, y: 2.5 },     // Toward lanterns
      { x: 3, z: -6, y: 2.5 },    // Lantern area
      { x: -3, z: -14, y: 2.5 },  // Deep woods path
      { x: -8, z: -20, y: 2.5 },  // Firefly zone
      { x: -10, z: -10, y: 2.5 }, // Turning back
      { x: -4, z: 0, y: 2.5 }     // Back toward clearing
    ];

    lampPositions.slice(0, PATH_LAMP_COUNT).forEach(function (lp) {
      var gY = noise2D(lp.x, lp.z) * 1.2;
      var dC = Math.sqrt(lp.x * lp.x + (lp.z + 10) * (lp.z + 10));
      if (dC < 8) gY *= dC / 8;

      // Lamp post (thin cylinder)
      var post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 2, 4),
        new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9 })
      );
      post.position.set(lp.x, gY + 1, lp.z);
      scene.add(post);

      // Lamp glow (small sphere)
      var glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xE8C87A, transparent: true, opacity: 0.8 })
      );
      glow.position.set(lp.x, gY + 2.2, lp.z);
      scene.add(glow);

      // Warm point light
      var light = new THREE.PointLight(0xE8C87A, 0.8, 12);
      light.position.set(lp.x, gY + 2.5, lp.z);
      scene.add(light);
    });
  }

  // ======================== Ambient Fireflies — scattered throughout ========================
  function createAmbientFireflies() {
    var ambientFFs = [];
    for (var i = 0; i < AMBIENT_FF_COUNT; i++) {
      var x = (Math.random() - 0.5) * 60;
      var z = (Math.random() - 0.5) * 70 - 5;
      var y = 1.5 + Math.random() * 5;
      var color = [0xA3B18A, 0xB5C99A, 0xDAD7CD, 0x97A97C][Math.floor(Math.random() * 4)];

      var mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 })
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);

      // Small glow per firefly (skip on mobile — too many lights)
      var light = null;
      if (!isMobile) {
        light = new THREE.PointLight(color, 0.15, 4);
        light.position.set(x, y, z);
        scene.add(light);
      }

      ambientFFs.push({
        mesh: mesh, light: light,
        baseX: x, baseY: y, baseZ: z,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.0,
        ampX: 0.3 + Math.random() * 1.0,
        ampY: 0.2 + Math.random() * 0.5,
        ampZ: 0.3 + Math.random() * 1.0
      });
    }
    scene._ambientFFs = ambientFFs;
  }

  // ======================== Spawn ========================
  function spawnFirefly(x, y, z) {
    var color = [0xA3B18A, 0xDAD7CD, 0xB5C99A, 0x97A97C][Math.floor(Math.random() * 4)];
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 }));
    mesh.position.set(x, y, z);
    mesh.userData = { vx: (Math.random() - 0.5) * 0.04, vy: 0.02 + Math.random() * 0.03, vz: (Math.random() - 0.5) * 0.04, life: 1.0, decay: 0.003 + Math.random() * 0.003 };
    scene.add(mesh); spawned.push(mesh);
    if (spawned.length > MAX_SPAWNED) { var old = spawned.shift(); scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
    for (var i = 0; i < 4; i++) {
      var p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 }));
      p.position.set(x, y, z);
      var a = Math.random() * Math.PI * 2, spd = 0.02 + Math.random() * 0.04;
      p.userData = { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + 0.01, vz: (Math.random() - 0.5) * spd, life: 1.0, decay: 0.03 + Math.random() * 0.02 };
      scene.add(p); trails.push(p);
      if (trails.length > MAX_TRAILS) { var ot = trails.shift(); scene.remove(ot); ot.geometry.dispose(); ot.material.dispose(); }
    }
  }

  // ======================== Events ========================
  function getWorldPos(cx, cy) {
    mouseVec.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouseVec, camera);
    var d = raycaster.ray.direction, o = raycaster.ray.origin;
    var t = (3 - o.y) / d.y; if (t < 0) t = 10;
    return { x: o.x + d.x * t, y: 3, z: o.z + d.z * t };
  }
  function onMouseMove(e) {
    mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    if (isMouseDown) { var wp = getWorldPos(e.clientX, e.clientY); spawnFirefly(wp.x, wp.y, wp.z); }
  }
  function onClick(e) { var wp = getWorldPos(e.clientX, e.clientY); spawnFirefly(wp.x, wp.y, wp.z); if (window.playSound) playSound("click"); }
  function onTouch(e) { e.preventDefault(); isMouseDown = true; var t = e.touches[0]; var wp = getWorldPos(t.clientX, t.clientY); spawnFirefly(wp.x, wp.y, wp.z); lastTouchSpawn = Date.now(); }
  function onTouchDrag(e) {
    e.preventDefault(); var t = e.touches[0];
    mouse.ndcX = (t.clientX / window.innerWidth) * 2 - 1;
    mouse.ndcY = -(t.clientY / window.innerHeight) * 2 + 1;
    // Throttle: max 1 spawn per 100ms on touch drag
    var now = Date.now();
    if (now - lastTouchSpawn > 100) {
      var wp = getWorldPos(t.clientX, t.clientY);
      spawnFirefly(wp.x, wp.y, wp.z);
      lastTouchSpawn = now;
    }
  }
  function onResize() { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(function () { if (!camera || !renderer) return; camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }, 100); }
  function updateScroll() {
    var c = document.getElementById("creativeScroll"); if (!c) return;
    var top = c.scrollTop, max = c.scrollHeight - c.clientHeight;
    scrollProgress = max > 0 ? top / max : 0;
    scrollVelocity = Math.abs(scrollProgress - lastScrollProgress);
    lastScrollProgress = scrollProgress;
  }

  // ======================== Animate ========================
  function animate() {
    if (!isActive) return;
    animationId = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    updateScroll(); updateAmbientAudio();

    // Camera
    var cam = getCameraState(scrollProgress);
    camera.position.x += (cam.px + mouse.ndcX * 1.2 - camera.position.x) * 0.03;
    camera.position.y += (cam.py + mouse.ndcY * 0.8 - camera.position.y) * 0.03;
    camera.position.z += (cam.pz - camera.position.z) * 0.03;
    camera.lookAt(cam.lx, cam.ly, cam.lz);

    // Fog
    scene.fog.near = lerp(10, 5, Math.min(1, scrollProgress * 1.5));
    scene.fog.far = lerp(65, 80, scrollProgress);

    // Lighting
    var fills = scene._fills;
    if (fills) {
      var vb = Math.min(scrollVelocity * 40, 0.4);
      fills[0].intensity = 0.4 + vb + (scrollProgress > 0.2 && scrollProgress < 0.45 ? 0.3 : 0);
      fills[1].intensity = 0.3 + vb + (scrollProgress > 0.38 && scrollProgress < 0.65 ? 0.3 : 0);
      fills[2].intensity = 0.2 + vb + (scrollProgress > 0.6 && scrollProgress < 0.8 ? 0.3 : 0);
    }
    if (scene._moon) scene._moon.intensity = 0.4 + scrollProgress * 0.4;

    // Core
    if (scene._coreOrb) {
      var cAmp = scrollProgress < 0.35 ? Math.min(1, scrollProgress / 0.15) : Math.max(0.2, 1 - (scrollProgress - 0.35) * 1.5);
      scene._coreOrb.material.opacity = (0.2 + Math.sin(t * 1.5) * 0.1) * cAmp;
      scene._coreOrb.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
      scene._coreLight.intensity = (1.0 + Math.sin(t * 1.5) * 0.5) * cAmp;
    }
    // Embers orbit the core
    if (scene._coreEmbers) {
      var coreY = 4;
      var velPush = Math.min(scrollVelocity * 40, 0.5);
      for (var ei = 0; ei < scene._coreEmbers.length; ei++) {
        var em = scene._coreEmbers[ei], ed = em.userData;
        var r = ed.radius + velPush;
        var a = t * ed.speed + ed.phase;
        em.position.set(
          Math.cos(a) * r * Math.cos(ed.tilt),
          coreY + ed.yOffset + Math.sin(a) * r * Math.sin(ed.tilt),
          Math.sin(a) * r
        );
        em.material.opacity = (0.3 + Math.sin(t * 3 + ei) * 0.3) * cAmp;
      }
    }
    if (scene._brandLabel) scene._brandLabel.position.y = 7 + Math.sin(t * 0.4) * 0.12;
    if (scene._brandSub) scene._brandSub.position.y = 6 + Math.sin(t * 0.4 + 0.5) * 0.08;

    // Lanterns
    var inProj = scrollProgress > 0.38 && scrollProgress < 0.65;
    for (var li = 0; li < lanterns.length; li++) {
      var lan = lanterns[li], bob = Math.sin(t * 0.6 + li * 1.2) * 0.3;
      lan.mesh.position.y = lan.baseY + bob; lan.light.position.y = lan.baseY + bob; lan.label.position.y = lan.baseY + bob + 1.2;
      var tG = inProj ? 0.8 : 0.3, tL = inProj ? 1.2 : 0.4, tO = inProj ? 0.9 : 0.5, tS = inProj ? 1.3 : 1.0;
      lan.mesh.material.emissiveIntensity += (tG - lan.mesh.material.emissiveIntensity) * 0.03;
      lan.light.intensity += (tL - lan.light.intensity) * 0.03;
      lan.label.material.opacity += (tO - lan.label.material.opacity) * 0.03;
      lan.mesh.scale.setScalar(lan.mesh.scale.x + (tS - lan.mesh.scale.x) * 0.03);
    }

    // Fireflies
    var inTech = scrollProgress > 0.62 && scrollProgress < 0.78;
    for (var fi = 0; fi < fireflies.length; fi++) {
      var ff = fireflies[fi];
      var fx = ff.baseX + Math.sin(t * ff.speed + ff.phase) * ff.ampX;
      var fy = ff.baseY + Math.cos(t * ff.speed * 0.7 + ff.phase) * ff.ampY;
      var fz = ff.baseZ + Math.sin(t * ff.speed * 0.5 + ff.phase * 2) * ff.ampZ;
      ff.mesh.position.set(fx, fy, fz); if (ff.light) ff.light.position.set(fx, fy, fz); ff.label.position.set(fx, fy + 0.6, fz);
      var fO = inTech ? 0.95 : 0.4, fL = inTech ? 0.6 : 0.15, fLO = inTech ? 0.7 : 0.25, fS = inTech ? 2.0 : 1.0;
      ff.mesh.material.opacity += (fO - ff.mesh.material.opacity) * 0.03;
      if (ff.light) ff.light.intensity += (fL - ff.light.intensity) * 0.03;
      ff.label.material.opacity += (fLO - ff.label.material.opacity) * 0.03;
      ff.mesh.scale.setScalar(ff.mesh.scale.x + (fS - ff.mesh.scale.x) * 0.03);
      ff.mesh.material.opacity *= 0.85 + Math.sin(t * 5 + fi * 3) * 0.15;
    }

    // Ambient fireflies wander and flicker
    if (scene._ambientFFs) {
      for (var ai = 0; ai < scene._ambientFFs.length; ai++) {
        var af = scene._ambientFFs[ai];
        var ax = af.baseX + Math.sin(t * af.speed + af.phase) * af.ampX;
        var ay = af.baseY + Math.cos(t * af.speed * 0.6 + af.phase) * af.ampY;
        var az = af.baseZ + Math.sin(t * af.speed * 0.4 + af.phase * 2) * af.ampZ;
        af.mesh.position.set(ax, ay, az);
        if (af.light) af.light.position.set(ax, ay, az);
        af.mesh.material.opacity = 0.4 + Math.sin(t * 4 + ai * 2.5) * 0.35;
        if (af.light) af.light.intensity = 0.1 + Math.sin(t * 4 + ai * 2.5) * 0.1;
      }
    }

    // Mist
    if (scene._mist) { scene._mist.rotation.y = t * 0.002; scene._mist.position.y = Math.sin(t * 0.1) * 0.2; }

    // Spawned
    for (var si = spawned.length - 1; si >= 0; si--) {
      var s = spawned[si], sd = s.userData;
      s.position.x += sd.vx; s.position.y += sd.vy; s.position.z += sd.vz;
      sd.vy *= 0.995; sd.vx *= 0.99; sd.vz *= 0.99; sd.life -= sd.decay;
      s.material.opacity = Math.max(0, sd.life) * (0.7 + Math.sin(t * 8 + si) * 0.3);
      s.scale.setScalar(sd.life * 0.8 + 0.2);
      if (sd.life <= 0) { scene.remove(s); s.geometry.dispose(); s.material.dispose(); spawned.splice(si, 1); }
    }

    // Trails
    for (var ti = trails.length - 1; ti >= 0; ti--) {
      var tr = trails[ti], trd = tr.userData;
      tr.position.x += trd.vx; tr.position.y += trd.vy; tr.position.z += trd.vz;
      trd.life -= trd.decay; tr.material.opacity = Math.max(0, trd.life); tr.scale.setScalar(trd.life);
      if (trd.life <= 0) { scene.remove(tr); tr.geometry.dispose(); tr.material.dispose(); trails.splice(ti, 1); }
    }

    // Velocity ambient fireflies
    if (scrollVelocity > 0.003 && Math.random() < scrollVelocity * 8) {
      var sa = Math.random() * Math.PI * 2, sr = 3 + Math.random() * 8;
      spawnFirefly(camera.position.x + Math.cos(sa) * sr, camera.position.y - 1 + Math.random() * 3, camera.position.z + Math.sin(sa) * sr - 5);
    }

    canvas.setAttribute("data-shapes", lanterns.length + fireflies.length + spawned.length);
    renderer.render(scene, camera);
  }

  // ======================== Audio ========================
  var audioCtx = null, ambientGain = null, ambientOsc = null, ambientOsc2 = null, currentChAudio = -1;
  // 10 chapters of forest tones
  var CH_FREQS = [
    [82.41, 123.47],   // ch0: entrance — open
    [87.31, 130.81],   // ch1: the path — walking
    [110, 164.81],     // ch2: clearing — centered
    [98, 146.83],      // ch3: methodology — grounded
    [116.54, 174.61],  // ch4: first lanterns — warm
    [103.83, 155.56],  // ch5: the grove — deeper
    [73.42, 110],      // ch6: fireflies — deep woods
    [130.81, 196],     // ch7: award — triumphant
    [110, 164.81],     // ch8: rising — ascending
    [82.41, 130.81]    // ch9: overview — resolution
  ];

  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      ambientGain = audioCtx.createGain(); ambientGain.gain.value = 0; ambientGain.connect(audioCtx.destination);
      ambientOsc = audioCtx.createOscillator(); ambientOsc.type = "sine"; ambientOsc.frequency.value = 82.41; ambientOsc.connect(ambientGain); ambientOsc.start();
      ambientOsc2 = audioCtx.createOscillator(); ambientOsc2.type = "triangle"; ambientOsc2.frequency.value = 123.47;
      var g2 = audioCtx.createGain(); g2.gain.value = 0.3; ambientOsc2.connect(g2); g2.connect(ambientGain); ambientOsc2.start();
    } catch (e) {}
  }
  function updateAmbientAudio() {
    if (!audioCtx || !ambientGain) return;
    var vol = localStorage.getItem("sound") !== "off" ? 0.025 : 0;
    ambientGain.gain.value += (vol - ambientGain.gain.value) * 0.015;
    var ch = Math.min(9, Math.floor(scrollProgress * 10));
    if (ch !== currentChAudio) { currentChAudio = ch; ambientOsc.frequency.setTargetAtTime(CH_FREQS[ch][0], audioCtx.currentTime, 0.8); ambientOsc2.frequency.setTargetAtTime(CH_FREQS[ch][1], audioCtx.currentTime, 0.8); }
  }
  function stopAudio() { if (ambientGain) ambientGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1); }

  // ======================== Cleanup ========================
  function cleanup() {
    for (var i = spawned.length - 1; i >= 0; i--) { scene.remove(spawned[i]); spawned[i].geometry.dispose(); spawned[i].material.dispose(); }
    spawned = [];
    for (var j = trails.length - 1; j >= 0; j--) { scene.remove(trails[j]); trails[j].geometry.dispose(); trails[j].material.dispose(); }
    trails = [];
  }

  // ======================== Public API ========================
  window.creativeScene = {
    start: function () {
      if (isActive) return;
      if (!scene) { if (!init()) return; }
      isActive = true; canvas.style.display = "block"; canvas.style.pointerEvents = "auto";
      clock.start(); animate();
      var initOnce = function () { initAudio(); canvas.removeEventListener("click", initOnce); canvas.removeEventListener("touchstart", initOnce); };
      canvas.addEventListener("click", initOnce); canvas.addEventListener("touchstart", initOnce);
    },
    stop: function () {
      isActive = false; stopAudio();
      if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
      if (canvas) { canvas.style.display = "none"; canvas.style.pointerEvents = "none"; }
      cleanup();
    },
    isRunning: function () { return isActive; }
  };
})();
