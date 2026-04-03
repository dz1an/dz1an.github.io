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
  var cursorTrail = [];
  var MAX_CURSOR_TRAIL = 15;
  var lastTrailTime = 0;
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
  var groundEmbers = [];
  var MAX_EMBERS = 20;
  // Restore embers from previous visit
  function saveEmbers() {
    try {
      var data = groundEmbers.map(function(e) { return { x: e.mesh.position.x, z: e.mesh.position.z }; });
      localStorage.setItem("forestEmbers", JSON.stringify(data));
    } catch(e) {}
  }

  function restoreEmbers() {
    try {
      var data = JSON.parse(localStorage.getItem("forestEmbers") || "[]");
      data.forEach(function(d) { spawnEmber(d.x, d.z); });
      if (data.length > 0 && scene._brandLabel) {
        // Show "welcome back" — temporarily change brand label
        scene._brandLabel.material.map.dispose();
        var wb = makeLabel("welcome back", { fontSize: 18, fontWeight: "400", color: "rgba(163,177,138,0.5)", scale: 1.0, opacity: 0.4 });
        wb.position.copy(scene._brandSub.position);
        wb.position.y -= 0.5;
        scene.add(wb);
        scene._welcomeBack = wb;
      }
    } catch(e) {}
  }

  var TREE_COUNT = isMobile ? 35 : 120;
  var AMBIENT_FF_COUNT = isMobile ? 12 : 25;
  var PATH_LAMP_COUNT = isMobile ? 5 : 10;
  var lastTouchSpawn = 0;

  // === Palette ===
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

  // Camera path — designed per chapter, 3D content opposite text cards
  var CAMERA_PATH = [
    // Ch0: "Welcome to the Forest" (LEFT card) — trees on RIGHT
    { at: 0.00, pos: [0, 8, 44],      look: [2, 0, 20] },
    { at: 0.05, pos: [0, 6, 36],      look: [2, 0.5, 16] },
    // Ch1: "From Zamboanga" (RIGHT card) — forest depth on LEFT
    { at: 0.10, pos: [1, 4.5, 26],    look: [-2, 0.5, 10] },
    { at: 0.16, pos: [1, 3.5, 18],    look: [-1, 0.5, 4] },
    // Ch2: "Where Ideas Take Root" (LEFT card) — camp on RIGHT
    { at: 0.22, pos: [3, 2.5, 10],    look: [1, 0.5, 0] },
    { at: 0.28, pos: [3, 2, 6],       look: [0, 0.6, 0] },
    // Ch3: "Measure Twice" (RIGHT card) — Kent+laptop on LEFT, zoom into screen
    { at: 0.33, pos: [-1, 2, 5],           look: [-1, 0.5, -1] },
    { at: 0.345, pos: [-2, 1.3, 3],         look: [-1.9, 0.3, 1.5] },
    { at: 0.36, pos: [-2.2, 1.2, 2.8],    look: [-1.9, 0.3, 1.5] },
    { at: 0.38, pos: [-2.5, 2.5, 2],      look: [0, 0.5, -4] },
    // Ch4: "Vintech & ZamGo" (LEFT card) — lanterns on RIGHT
    { at: 0.42, pos: [-2, 3, -4],     look: [0, 2.5, -12] },
    { at: 0.47, pos: [-1, 3.2, -8],   look: [0, 3, -12] },
    { at: 0.52, pos: [0, 3, -12],     look: [2, 2.8, -16] },
    // Ch5: "Three More Lights" (RIGHT card) — lanterns on LEFT
    { at: 0.57, pos: [2, 3.2, -17],   look: [-2, 3, -21] },
    { at: 0.62, pos: [2, 3, -22],     look: [-1, 2.8, -27] },
    // Ch6: "The Fireflies" (LEFT card) — inside the meadow, fireflies around you
    { at: 0.67, pos: [3, 2.5, -34],   look: [-3, 2.5, -37] },
    { at: 0.72, pos: [2, 2.5, -37],   look: [-4, 2.5, -39] },
    // Ch7: "National Winner" (CENTER) — dramatic rise
    { at: 0.77, pos: [-1, 6, -30],    look: [0, 1, -10] },
    // Ch8: "Above the Canopy" (RIGHT card) — canopy on LEFT
    { at: 0.83, pos: [-3, 8, -15],    look: [-2, 2, 0] },
    { at: 0.88, pos: [-2, 9, -5],     look: [0, 1, 0] },
    // Ch9: "Let's Build Together" (CENTER) — settling in tree
    { at: 0.94, pos: [6, 8, 8],       look: [0, 0.5, 0] },
    { at: 1.00, pos: [12, 7, 5],      look: [0, 0.5, 0] }
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  // Mobile camera offset — higher and further back
  var MOB_Y = isMobile ? 3 : 0;
  var MOB_Z = isMobile ? 6 : 0;

  function getCameraState(p) {
    p = Math.max(0, Math.min(1, p));
    var i = 0;
    for (var k = 0; k < CAMERA_PATH.length - 1; k++) {
      if (p >= CAMERA_PATH[k].at && p <= CAMERA_PATH[k + 1].at) { i = k; break; }
      if (k === CAMERA_PATH.length - 2) i = k;
    }
    var a = CAMERA_PATH[i], b = CAMERA_PATH[i + 1];
    var t = (p - a.at) / (b.at - a.at);
    // Quintic smoothstep — much smoother than cubic
    t = t * t * t * (t * (t * 6 - 15) + 10);
    return {
      px: lerp(a.pos[0], b.pos[0], t),
      py: lerp(a.pos[1], b.pos[1], t) + MOB_Y,
      pz: lerp(a.pos[2], b.pos[2], t) + MOB_Z,
      lx: lerp(a.look[0], b.look[0], t),
      ly: lerp(a.look[1], b.look[1], t),
      lz: lerp(a.look[2], b.look[2], t)
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
    scene.fog = new THREE.Fog(0x0C1210, isMobile ? 25 : 18, isMobile ? 100 : 75);
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(isMobile ? 65 : 55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 8, 44);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    renderer.shadowMap.enabled = false;
    raycaster = new THREE.Raycaster(); mouseVec = new THREE.Vector2();

    // Lighting — moonlit forest with visible depth
    scene.add(new THREE.AmbientLight(0x2A4E3A, 1.2));
    var moon = new THREE.DirectionalLight(0xAABBCC, 1.0);
    moon.position.set(-20, 30, 10);
    scene.add(moon); scene._moon = moon;

    var f1 = new THREE.PointLight(0x5C7650, 0.4, 40); f1.position.set(5, 6, 10);
    var f2 = new THREE.PointLight(0xA3B18A, 0.3, 35); f2.position.set(-8, 4, -10);
    var f3 = new THREE.PointLight(0x344E41, 0.2, 30); f3.position.set(0, 8, -20);
    scene.add(f1, f2, f3); scene._fills = [f1, f2, f3];

    var _lc = window._creativeLoadCallback || function(){};
    _lc("Building terrain...");
    buildTerrain(); createDirtPath();
    _lc("Planting forest...");
    plantForest();
    _lc("Setting up campsite...");
    createCoreLantern();
    _lc("Lighting lanterns...");
    createProjectLanterns();
    _lc("Releasing fireflies...");
    createFireflies(); createMist();
    _lc("Painting sky...");
    createBillboardTrees(); createSky(); createSmoke(); createGroundDetails();
    _lc("Placing path lamps...");
    createPathLamps(); createAmbientFireflies();
    _lc("complete");

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
  // Gentler noise — less extreme peaks so trees sit flush
  function terrainHeight(x, z) {
    var h = noise2D(x, z) * 0.5;
    var d = Math.sqrt(x * x + z * z);
    if (d < 14) h *= d / 14;
    return h;
  }

  function buildTerrain() {
    var res = isMobile ? 50 : 80;
    var geo = new THREE.PlaneGeometry(120, 120, res, res);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, terrainHeight(x, y));
    }
    geo.computeVertexNormals();

    // Base terrain
    var terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x1A2E1C, roughness: 0.95, flatShading: true
    }));
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);
    scene._terrain = terrain;

    // Ground cover layer — slightly above terrain, hides gaps at tree bases
    var coverGeo = new THREE.PlaneGeometry(120, 120, 20, 20);
    var coverPos = coverGeo.attributes.position;
    for (var j = 0; j < coverPos.count; j++) {
      var cx = coverPos.getX(j), cy = coverPos.getY(j);
      coverPos.setZ(j, terrainHeight(cx, cy) + 0.02);
    }
    coverGeo.computeVertexNormals();
    var cover = new THREE.Mesh(coverGeo, new THREE.MeshStandardMaterial({
      color: 0x1E3320, roughness: 1.0, transparent: true, opacity: 0.6
    }));
    cover.rotation.x = -Math.PI / 2;
    scene.add(cover);
  }

  // ======================== Forest ========================
  function getGroundY(x, z) {
    return terrainHeight(x, z);
  }

  // Exclusion zones — keep trees away from lanterns, fireflies, and camera path
  // ======================== Dirt Path — entrance to campsite ========================
  function createDirtPath() {
    var pathMat = new THREE.MeshStandardMaterial({ color: 0x2A1F15, roughness: 0.95 });

    // Entrance to camp (z:42 to z:0) — gentle winding
    for (var pz = 42; pz >= -2; pz -= 1.5) {
      var xWobble = Math.sin(pz * 0.15) * 1.2;
      var gY = terrainHeight(xWobble, pz);
      var radius = 1.2 + Math.sin(pz * 0.3) * 0.3;
      var disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 6), pathMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(xWobble, gY + 0.015, pz);
      scene.add(disc);
    }

    // Widen into the clearing
    for (var ci = 0; ci < 5; ci++) {
      var ca = (ci / 5) * Math.PI - Math.PI / 2;
      var disc = new THREE.Mesh(new THREE.CircleGeometry(2 + Math.random() * 1.5, 6), pathMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(Math.cos(ca) * 4, 0.015, Math.sin(ca) * 4 + 2);
      scene.add(disc);
    }

    // Camp through grove to meadow (z:-2 to z:-32) — zigzag matching lanterns
    for (var gz = -2; gz >= -32; gz -= 1.5) {
      var gxWobble = Math.sin(gz * 0.2) * 2; // wider zigzag in grove
      var gy = terrainHeight(gxWobble, gz);
      var gradius = 1.0 + Math.sin(gz * 0.25) * 0.2;
      var gdisc = new THREE.Mesh(new THREE.CircleGeometry(gradius, 6), pathMat);
      gdisc.rotation.x = -Math.PI / 2;
      gdisc.position.set(gxWobble, gy + 0.015, gz);
      scene.add(gdisc);
    }

    // Widen into meadow entrance
    for (var mi = 0; mi < 4; mi++) {
      var mdisc = new THREE.Mesh(new THREE.CircleGeometry(1.5 + Math.random(), 6), pathMat);
      mdisc.rotation.x = -Math.PI / 2;
      mdisc.position.set(-3 + (Math.random() - 0.5) * 4, terrainHeight(-3, -33) + 0.015, -32 - mi * 1);
      scene.add(mdisc);
    }
  }

  function plantForest() {
    // === SHARED MATERIALS — created once, reused everywhere ===
    var trunkMats = TRUNK_COLORS.map(function (c) {
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true });
    });
    var canopyMats = CANOPY_COLORS.map(function (c) {
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true });
    });
    var groundDiscMat = new THREE.MeshStandardMaterial({ color: 0x162218, roughness: 1.0 });

    var segs = isMobile ? 5 : 6;
    var coneSegs = isMobile ? 6 : 8;
    var sphereSegs = isMobile ? 4 : 6;

    // === DESIGNED TREE POSITIONS ===
    var treePositions = [];

    // Helper: check if position is too close to any clear zone
    function treeOk(tx, tz) {
      // Campsite clearing
      if (tx * tx + tz * tz < 196) return false; // radius 14
      // Entrance path corridor (x:-3 to 3, z:12 to 44)
      if (Math.abs(tx) < 3.5 && tz > 12 && tz < 44) return false;
      // Grove corridor (x:-5 to 5, z:-6 to -30)
      if (Math.abs(tx) < 5 && tz < -6 && tz > -30) return false;
      // Meadow (radius 10 around -3, -36)
      var mx = tx + 3, mz = tz + 36;
      if (mx * mx + mz * mz < 100) return false;
      return true;
    }

    // --- 1. ENTRANCE PATHWAY (z: 42 to z: 14) — dense rows both sides ---
    // Inner row (close to path)
    for (var pz = 42; pz >= 14; pz -= 2.5) {
      treePositions.push({ x: -4 - Math.random() * 1.5, z: pz + (Math.random() - 0.5), type: "pine", size: "tall" });
      treePositions.push({ x: 4 + Math.random() * 1.5, z: pz - 1 + (Math.random() - 0.5), type: "pine", size: "tall" });
    }
    // Middle row
    for (var pz = 41; pz >= 14; pz -= 3) {
      treePositions.push({ x: -7 - Math.random() * 2, z: pz + (Math.random() - 0.5), type: "round", size: "tall" });
      treePositions.push({ x: 7 + Math.random() * 2, z: pz + (Math.random() - 0.5), type: "round", size: "tall" });
    }
    // Outer row (deep forest backdrop)
    for (var pz = 42; pz >= 14; pz -= 4) {
      treePositions.push({ x: -11 - Math.random() * 3, z: pz + (Math.random() - 0.5) * 2, type: "pine", size: "med" });
      treePositions.push({ x: 11 + Math.random() * 3, z: pz + (Math.random() - 0.5) * 2, type: "pine", size: "med" });
    }

    // --- 2. CAMP CLEARING ring (tight ring, evenly spaced) ---
    for (var ca = 0; ca < Math.PI * 2; ca += 0.25) {
      var cr = 14.5 + Math.random() * 2;
      var cx = Math.cos(ca) * cr;
      var cz = Math.sin(ca) * cr;
      if (!treeOk(cx, cz)) continue;
      treePositions.push({ x: cx + (Math.random() - 0.5) * 1.5, z: cz + (Math.random() - 0.5) * 1.5, type: Math.random() > 0.5 ? "pine" : "round", size: "tall" });
    }
    // Second ring (slightly further out)
    for (var ca = 0.15; ca < Math.PI * 2; ca += 0.35) {
      var cr = 18 + Math.random() * 3;
      var cx = Math.cos(ca) * cr;
      var cz = Math.sin(ca) * cr;
      if (!treeOk(cx, cz)) continue;
      treePositions.push({ x: cx + (Math.random() - 0.5), z: cz + (Math.random() - 0.5), type: Math.random() > 0.4 ? "pine" : "round", size: "med" });
    }

    // --- 3. GROVE FLANKING — dense walls both sides of lantern path ---
    // Left wall (2 deep)
    for (var gz = -8; gz >= -30; gz -= 2.5) {
      treePositions.push({ x: -6 - Math.random() * 1.5, z: gz + (Math.random() - 0.5), type: "pine", size: "tall" });
      treePositions.push({ x: -9 - Math.random() * 2, z: gz + 1 + (Math.random() - 0.5), type: "round", size: "med" });
    }
    // Right wall (2 deep)
    for (var gz = -9; gz >= -30; gz -= 2.5) {
      treePositions.push({ x: 6 + Math.random() * 1.5, z: gz + (Math.random() - 0.5), type: "pine", size: "tall" });
      treePositions.push({ x: 9 + Math.random() * 2, z: gz + 1 + (Math.random() - 0.5), type: "round", size: "med" });
    }

    // --- 4. MEADOW ring (denser, tighter spacing) ---
    for (var ma = 0; ma < Math.PI * 2; ma += 0.3) {
      var mr = 9 + Math.random() * 3;
      var mmx = -3 + Math.cos(ma) * mr;
      var mmz = -36 + Math.sin(ma) * mr;
      // Gap north (entry) and south (depth)
      if (mmz > -29 && Math.abs(mmx + 3) < 4) continue;
      if (mmz < -45 && Math.abs(mmx + 3) < 3) continue;
      treePositions.push({ x: mmx + (Math.random() - 0.5), z: mmz + (Math.random() - 0.5), type: "round", size: "tall" });
    }

    // --- 5. DEEP WOODS — fill all gaps, evenly distributed ---
    // Use a grid with jitter instead of pure random (prevents clumping)
    var deepSpacing = isMobile ? 14 : 10;
    for (var dgx = -50; dgx <= 50; dgx += deepSpacing) {
      for (var dgz = -55; dgz <= 50; dgz += deepSpacing) {
        var dx = dgx + (Math.random() - 0.5) * deepSpacing * 0.8;
        var dz = dgz + (Math.random() - 0.5) * deepSpacing * 0.8;
        if (Math.abs(dx) > 55 || Math.abs(dz) > 55) continue;
        var dc = Math.sqrt(dx * dx + dz * dz);
        if (dc < 20) continue; // skip inner zones
        if (!treeOk(dx, dz)) continue;
        treePositions.push({ x: dx, z: dz, type: Math.random() > 0.3 ? "pine" : (Math.random() > 0.5 ? "round" : "slim"), size: Math.random() > 0.5 ? "tall" : "med" });
      }
    }

    // === PLACE ALL TREES — LOD: near trees get detail, far trees get minimal ===
    var canopies = []; // for wind sway animation
    for (var i = 0; i < treePositions.length; i++) {
      var tp = treePositions[i];
      var x = tp.x, z = tp.z;
      var gY = getGroundY(x, z);
      var tMat = trunkMats[i % 4];
      var cMat = canopyMats[i % canopyMats.length];

      // Distance from origin — determines detail level
      var distFromCenter = Math.sqrt(x * x + z * z);
      var isNear = distFromCenter < 22; // pathway + clearing + inner grove
      var isFar = distFromCenter > 35;  // deep woods

      var isTall = tp.size === "tall";
      var height = isTall ? (6 + Math.random() * 4) : (3 + Math.random() * 4);
      var trunkH = height * (0.4 + Math.random() * 0.15);
      var canopyH = height * (0.5 + Math.random() * 0.2);
      var canopyR = isTall ? (1.5 + Math.random() * 2) : (1 + Math.random() * 1.5);
      var trunkR = isTall ? (0.12 + Math.random() * 0.15) : (0.08 + Math.random() * 0.1);
      var leanX = (Math.random() - 0.5) * 0.06;
      var leanZ = (Math.random() - 0.5) * 0.06;
      var tSegs = isFar ? 4 : segs;

      // Trunk (always)
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.5, trunkR * 1.1, trunkH, tSegs), tMat);
      trunk.position.set(x, gY + trunkH / 2, z);
      trunk.rotation.set(leanX, 0, leanZ);
      scene.add(trunk);

      // Root flare + ground disc (near only)
      if (isNear) {
        var rootFlare = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 1.1, trunkR * 1.6, trunkH * 0.12, tSegs), tMat);
        rootFlare.position.set(x, gY + trunkH * 0.06, z);
        scene.add(rootFlare);

        var groundDisc = new THREE.Mesh(new THREE.CircleGeometry(trunkR * 2.5 + 0.1, 5), groundDiscMat);
        groundDisc.rotation.x = -Math.PI / 2;
        groundDisc.position.set(x, gY + 0.01, z);
        scene.add(groundDisc);
      }

      // Canopy — far trees get 1 shape, near trees get full detail
      if (tp.type === "pine") {
        var layers = isFar ? 1 : (isMobile ? 2 : 3);
        for (var j = 0; j < layers; j++) {
          var lr = canopyR * (1 - j * 0.2);
          var lh = canopyH * (0.5 + j * 0.1);
          var cone = new THREE.Mesh(new THREE.ConeGeometry(lr, lh, isFar ? 5 : coneSegs), canopyMats[(i + j) % canopyMats.length]);
          cone.position.set(x, gY + trunkH + lh * 0.3 + j * canopyH * 0.22, z);
          cone.rotation.set(leanX, Math.random() * Math.PI, leanZ);
          scene.add(cone);
          if (isNear && j === 0) canopies.push({ mesh: cone, phase: Math.random() * Math.PI * 2, baseRx: leanX });
        }
      } else if (tp.type === "round") {
        var count = isFar ? 1 : (isMobile ? 2 : 3);
        for (var j = 0; j < count; j++) {
          var sr = canopyR * (isFar ? 0.6 : (0.4 + Math.random() * 0.3));
          var canopy = new THREE.Mesh(new THREE.SphereGeometry(sr, isFar ? 4 : sphereSegs, isFar ? 3 : sphereSegs - 1), canopyMats[(i + j) % canopyMats.length]);
          canopy.position.set(
            x + (isFar ? 0 : (Math.random() - 0.5) * canopyR * 0.5),
            gY + trunkH + sr * 0.3 + j * sr * 0.4,
            z + (isFar ? 0 : (Math.random() - 0.5) * canopyR * 0.5)
          );
          if (!isFar) canopy.scale.set(0.8 + Math.random() * 0.3, 0.6 + Math.random() * 0.3, 0.8 + Math.random() * 0.3);
          scene.add(canopy);
          if (isNear && j === 0) canopies.push({ mesh: canopy, phase: Math.random() * Math.PI * 2, baseRx: 0 });
        }
      } else {
        var slimH = canopyH * 1.3;
        var slimR = canopyR * 0.3;
        var canopy = new THREE.Mesh(new THREE.ConeGeometry(slimR, slimH, isFar ? 4 : coneSegs), cMat);
        canopy.position.set(x, gY + trunkH + slimH * 0.4, z);
        canopy.rotation.set(leanX, Math.random() * Math.PI, leanZ);
        scene.add(canopy);
        if (isNear) canopies.push({ mesh: canopy, phase: Math.random() * Math.PI * 2, baseRx: leanX });
      }
      trees.push({ x: x, z: z });
    }
    scene._canopies = canopies;
  }

  // ======================== Campsite — tent, campfire, seated figure ========================
  function createCoreLantern() {
    var gY = 0;
    var tentFabric = new THREE.MeshStandardMaterial({ color: 0x4A6B3F, roughness: 0.75, flatShading: true, side: THREE.DoubleSide });
    var tentFabricInner = new THREE.MeshStandardMaterial({ color: 0x3D5C35, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    var tentAccent = new THREE.MeshStandardMaterial({ color: 0x5C7650, roughness: 0.7, flatShading: true, side: THREE.DoubleSide });
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x6B5B4B, roughness: 0.7 });
    var ropeMat = new THREE.MeshBasicMaterial({ color: 0x8B7D6B });
    var logMat = new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9 });
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.95, flatShading: true });

    // === TENT — bigger, more detailed ===
    var tX = 2.5, tZ = -2.5; // pushed further back and right, away from camera sightline

    // Ground sheet (larger)
    var groundSheet = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.4), new THREE.MeshStandardMaterial({ color: 0x3A5A40, roughness: 0.9 }));
    groundSheet.rotation.x = -Math.PI / 2;
    groundSheet.position.set(tX, gY + 0.02, tZ);
    scene.add(groundSheet);

    // Main panels (larger, steeper)
    var panelGeo = new THREE.PlaneGeometry(1.5, 2.6);
    var tentL = new THREE.Mesh(panelGeo, tentFabric);
    tentL.position.set(tX - 0.55, gY + 0.7, tZ);
    tentL.rotation.set(0, 0, 0.55);
    scene.add(tentL);
    var tentR = new THREE.Mesh(panelGeo.clone(), tentFabric);
    tentR.position.set(tX + 0.55, gY + 0.7, tZ);
    tentR.rotation.set(0, 0, -0.55);
    scene.add(tentR);

    // Accent stripe along ridge (colored band)
    var stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2.6), tentAccent);
    stripe.position.set(tX - 0.08, gY + 1.18, tZ);
    stripe.rotation.set(0, 0, 0.55);
    scene.add(stripe);
    var stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2.6), tentAccent);
    stripe2.position.set(tX + 0.08, gY + 1.18, tZ);
    stripe2.rotation.set(0, 0, -0.55);
    scene.add(stripe2);

    // Front flaps (open, inviting)
    var flapGeo = new THREE.PlaneGeometry(0.8, 1.2);
    var flapL = new THREE.Mesh(flapGeo, tentFabricInner);
    flapL.position.set(tX - 0.3, gY + 0.5, tZ + 1.2);
    flapL.rotation.set(0.2, 0.4, 0.45);
    scene.add(flapL);
    var flapR = new THREE.Mesh(flapGeo.clone(), tentFabricInner);
    flapR.position.set(tX + 0.3, gY + 0.5, tZ + 1.2);
    flapR.rotation.set(0.2, -0.4, -0.45);
    scene.add(flapR);

    // Back wall
    var backGeo = new THREE.BufferGeometry();
    backGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      tX - 0.7, gY, tZ - 1.2,  tX + 0.7, gY, tZ - 1.2,  tX, gY + 1.3, tZ - 1.2
    ]), 3));
    backGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(backGeo, tentFabricInner));

    // Ridge pole (thicker)
    var ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 4), poleMat);
    ridge.position.set(tX, gY + 1.3, tZ);
    ridge.rotation.x = Math.PI / 2;
    scene.add(ridge);

    // Front A-frame poles
    var poleGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.5, 4);
    scene.add(new THREE.Mesh(poleGeo, poleMat).translateX(tX - 0.35).translateY(gY + 0.6).translateZ(tZ + 1.2).rotateZ(0.5));
    scene.add(new THREE.Mesh(poleGeo.clone(), poleMat).translateX(tX + 0.35).translateY(gY + 0.6).translateZ(tZ + 1.2).rotateZ(-0.5));

    // Back A-frame poles
    scene.add(new THREE.Mesh(poleGeo.clone(), poleMat).translateX(tX - 0.35).translateY(gY + 0.6).translateZ(tZ - 1.2).rotateZ(0.5));
    scene.add(new THREE.Mesh(poleGeo.clone(), poleMat).translateX(tX + 0.35).translateY(gY + 0.6).translateZ(tZ - 1.2).rotateZ(-0.5));

    // Guy ropes (4 corners)
    var ropeGeo = new THREE.CylinderGeometry(0.006, 0.006, 1.5, 3);
    [[-1, 0.5], [1, -0.5], [-1, -2.5], [1, -2.5]].forEach(function (rp) {
      var rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.position.set(tX + rp[0] * 0.8, gY + 0.3, tZ + rp[1] * 0.4);
      rope.rotation.set(0, Math.random(), rp[0] > 0 ? -0.7 : 0.7);
      scene.add(rope);
    });

    // Sleeping bag visible inside (rolled out)
    var sleepBag = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15, 0.8, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2A4A3A, roughness: 0.8 })
    );
    sleepBag.position.set(tX + 0.3, gY + 0.1, tZ - 0.2);
    sleepBag.rotation.set(0, 0.2, Math.PI / 2);
    scene.add(sleepBag);

    // Pillow
    var pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.08, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xDAD7CD, roughness: 0.85 })
    );
    pillow.position.set(tX + 0.3, gY + 0.12, tZ - 0.7);
    pillow.rotation.y = 0.15;
    scene.add(pillow);

    // === CAMPFIRE — more detailed ===
    // Fire ring (stones, varied)
    for (var si = 0; si < 10; si++) {
      var stoneAngle = (si / 10) * Math.PI * 2;
      var sr = 0.08 + Math.random() * 0.08;
      var stone = new THREE.Mesh(new THREE.DodecahedronGeometry(sr, 0), stoneMat);
      stone.position.set(Math.cos(stoneAngle) * 0.55, gY + 0.06, Math.sin(stoneAngle) * 0.55 + 0.5);
      stone.scale.y = 0.5;
      stone.rotation.set(Math.random(), Math.random(), 0);
      scene.add(stone);
    }

    // Log teepee (3 logs leaning together)
    for (var li = 0; li < 3; li++) {
      var la = (li / 3) * Math.PI * 2;
      var log = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 5), logMat);
      log.position.set(Math.cos(la) * 0.12, gY + 0.25, Math.sin(la) * 0.12 + 0.5);
      log.rotation.set(Math.cos(la) * 0.4, la, Math.sin(la) * 0.4);
      scene.add(log);
    }
    // Base logs (flat, under the teepee)
    var baseLog1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 5), logMat);
    baseLog1.position.set(0, gY + 0.08, 0.5); baseLog1.rotation.set(0, 0.8, Math.PI / 2);
    scene.add(baseLog1);
    var baseLog2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 5), logMat);
    baseLog2.position.set(0.05, gY + 0.08, 0.55); baseLog2.rotation.set(0, -0.5, Math.PI / 2);
    scene.add(baseLog2);

    // Fire light — main warm flicker (bright, close range)
    var fireLight = new THREE.PointLight(0xFF8C33, 3.5, 20);
    fireLight.position.set(0, gY + 0.8, 0.5);
    scene.add(fireLight);
    scene._fireLight = fireLight;

    // Secondary fill — low angle, warm red tone
    var fireFill = new THREE.PointLight(0xE86420, 1.2, 12);
    fireFill.position.set(0, gY + 0.3, 0.5);
    scene.add(fireFill);
    scene._fireFill = fireFill;

    // Wide ambient bounce — simulates light reflecting off ground/tent
    var fireBounce = new THREE.PointLight(0xCC7733, 1.0, 25);
    fireBounce.position.set(0, gY + 2.5, 0);
    scene.add(fireBounce);
    scene._fireBounce = fireBounce;

    // Soft upward glow — lights the canopy above
    var fireUp = new THREE.PointLight(0xFF9944, 0.6, 18);
    fireUp.position.set(0, gY + 3.5, 0.5);
    scene.add(fireUp);
    scene._fireUp = fireUp;

    // Fire particles (embers rising)
    var fireEmbers = [];
    for (var ei = 0; ei < 25; ei++) {
      var eColor = [0xFF6B33, 0xFFAA33, 0xFF8833, 0xFFCC55, 0xFF5522][Math.floor(Math.random() * 5)];
      var ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.02 + Math.random() * 0.03, 4, 4),
        new THREE.MeshBasicMaterial({ color: eColor, transparent: true, opacity: 0.8 })
      );
      ember.position.set(0, gY + 0.3, 0.5);
      ember.userData = {
        baseX: (Math.random() - 0.5) * 0.3,
        baseZ: 0.5 + (Math.random() - 0.5) * 0.3,
        speed: 0.5 + Math.random() * 1.5,
        maxH: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.3
      };
      scene.add(ember);
      fireEmbers.push(ember);
    }
    scene._fireEmbers = fireEmbers;

    // === KENT — detailed seated figure ===
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xC4956A, roughness: 0.6 });
    var hoodieMat = new THREE.MeshStandardMaterial({ color: 0x344E41, roughness: 0.75 });
    var hoodieAccent = new THREE.MeshStandardMaterial({ color: 0x5C7650, roughness: 0.7 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.85 });
    var bootMat = new THREE.MeshStandardMaterial({ color: 0x2D1B0E, roughness: 0.85 });
    var hairMat = new THREE.MeshStandardMaterial({ color: 0x0E0808, roughness: 0.9 });

    var figX = -1.2, figZ = 1.8; // further from fire, more breathing room

    // Log seat
    var seatLog = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 7), logMat);
    seatLog.position.set(figX, gY + 0.14, figZ + 0.05);
    seatLog.rotation.z = Math.PI / 2; seatLog.rotation.y = 0.3;
    scene.add(seatLog);

    // Torso (hoodie, leaning forward)
    var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), hoodieMat);
    torso.position.set(figX, gY + 0.65, figZ);
    torso.rotation.set(0.2, 0.3, 0);
    scene.add(torso);

    // Hood (behind head, bunched)
    var hood = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0.3, Math.PI * 0.5), hoodieMat);
    hood.position.set(figX + 0.02, gY + 0.95, figZ + 0.06);
    hood.rotation.x = 0.3;
    scene.add(hood);

    // Hoodie pocket (front kangaroo pocket)
    var pocket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.15), hoodieAccent);
    pocket.position.set(figX + 0.05, gY + 0.5, figZ - 0.12);
    pocket.rotation.set(0.2, 0.3, 0);
    scene.add(pocket);

    // Head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), skinMat);
    head.position.set(figX + 0.04, gY + 1.1, figZ - 0.06);
    scene.add(head);

    // Hair (short, styled)
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.set(figX + 0.04, gY + 1.16, figZ - 0.04);
    hair.rotation.x = -0.15;
    scene.add(hair);

    // Beanie
    var beanie = new THREE.Mesh(new THREE.SphereGeometry(0.175, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), hoodieAccent);
    beanie.position.set(figX + 0.04, gY + 1.2, figZ - 0.04);
    beanie.rotation.x = -0.1;
    scene.add(beanie);
    // Beanie rim
    var beanieRim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.025, 6, 12), hoodieMat);
    beanieRim.position.set(figX + 0.04, gY + 1.12, figZ - 0.04);
    beanieRim.rotation.x = Math.PI / 2 - 0.15;
    scene.add(beanieRim);

    // Neck
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 6), skinMat);
    neck.position.set(figX + 0.02, gY + 0.95, figZ - 0.03);
    scene.add(neck);

    // Left arm (resting on knee, hoodie sleeve)
    var armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.35, 3, 6), hoodieMat);
    armL.position.set(figX - 0.24, gY + 0.5, figZ + 0.05);
    armL.rotation.set(0.4, 0, -0.6);
    scene.add(armL);
    var handL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), skinMat);
    handL.position.set(figX - 0.38, gY + 0.32, figZ + 0.15);
    scene.add(handL);

    // Right arm + forearm (holding stick)
    var armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.35, 3, 6), hoodieMat);
    armR.position.set(figX + 0.24, gY + 0.52, figZ - 0.1);
    armR.rotation.set(0.6, 0, 0.5);
    scene.add(armR);
    var forearmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 3, 6), skinMat);
    forearmR.position.set(figX + 0.38, gY + 0.4, figZ - 0.2);
    forearmR.rotation.set(0.8, 0, 0.3);
    scene.add(forearmR);

    // Stick poking fire
    var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 1.3, 4), new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.9 }));
    stick.position.set(figX + 0.32, gY + 0.37, figZ - 0.38);
    stick.rotation.set(0.9, 0.2, 0.4);
    scene.add(stick);

    // Legs (jeans, sitting cross-legged)
    var thighL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 3, 6), pantsMat);
    thighL.position.set(figX - 0.12, gY + 0.3, figZ + 0.12);
    thighL.rotation.set(0.1, 0.3, Math.PI / 2 - 0.2);
    scene.add(thighL);
    var thighR = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 3, 6), pantsMat);
    thighR.position.set(figX + 0.1, gY + 0.3, figZ - 0.05);
    thighR.rotation.set(-0.2, -0.2, Math.PI / 2 + 0.1);
    scene.add(thighR);
    var shinL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 3, 6), pantsMat);
    shinL.position.set(figX - 0.05, gY + 0.16, figZ + 0.32);
    shinL.rotation.set(0.3, 0.5, 0.1);
    scene.add(shinL);
    var shinR = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 3, 6), pantsMat);
    shinR.position.set(figX + 0.15, gY + 0.16, figZ + 0.08);
    shinR.rotation.set(-0.2, -0.3, 0.2);
    scene.add(shinR);

    // Boots (hiking style, chunkier)
    var bootGeo = new THREE.BoxGeometry(0.12, 0.08, 0.2);
    var bootL = new THREE.Mesh(bootGeo, bootMat);
    bootL.position.set(figX + 0.05, gY + 0.05, figZ + 0.45);
    scene.add(bootL);
    // Boot sole
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.22), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 })).translateX(figX + 0.05).translateY(gY + 0.02).translateZ(figZ + 0.45));
    var bootR = new THREE.Mesh(bootGeo.clone(), bootMat);
    bootR.position.set(figX + 0.28, gY + 0.05, figZ + 0.2);
    bootR.rotation.y = -0.3;
    scene.add(bootR);

    // === CAMPSITE PROPS ===

    // Backpack (larger, more detailed)
    var bpMat = new THREE.MeshStandardMaterial({ color: 0x344E41, roughness: 0.8 });
    var backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.22), bpMat);
    backpack.position.set(figX - 0.55, gY + 0.22, figZ + 0.3);
    backpack.rotation.set(0, 0.3, -0.25);
    scene.add(backpack);
    // Backpack top flap
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.2), hoodieAccent).translateX(figX - 0.55).translateY(gY + 0.47).translateZ(figZ + 0.28).rotateZ(-0.2).rotateY(0.3));
    // Backpack side pocket
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.18), new THREE.MeshStandardMaterial({ color: 0x3A5A40, roughness: 0.8 })).translateX(figX - 0.72).translateY(gY + 0.18).translateZ(figZ + 0.3).rotateY(0.3));

    // Firewood stack near tent
    for (var wi = 0; wi < 4; wi++) {
      var fw = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 5), logMat);
      fw.position.set(tX - 0.8, gY + 0.06 + wi * 0.09, tZ + 0.6);
      fw.rotation.z = Math.PI / 2;
      fw.rotation.y = (Math.random() - 0.5) * 0.2;
      scene.add(fw);
    }

    // Laptop — on the ground next to Kent, clear of everything else
    var lapX = figX + 0.4;
    var lapZ = figZ + 0.6;
    var lapY = gY + 0.05;

    var laptopBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.02, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x2A2A2A, roughness: 0.3, metalness: 0.6 })
    );
    laptopBase.position.set(lapX, lapY, lapZ);
    laptopBase.rotation.y = 0.5; // angled toward Kent
    scene.add(laptopBase);

    // Screen (angled up, facing Kent but visible from camera)
    var screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.33, 0.22, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.2, emissive: 0x2244AA, emissiveIntensity: 0.3 })
    );
    screen.position.set(lapX - 0.05, lapY + 0.12, lapZ - 0.1);
    screen.rotation.set(-0.4, 0.5, 0);
    scene.add(screen);

    // Screen glow light — brighter so it's noticeable
    var screenLight = new THREE.PointLight(0x4466CC, 0.6, 5);
    screenLight.position.set(lapX, lapY + 0.2, lapZ);
    scene.add(screenLight);
    scene._screenLight = screenLight;

    // Code lines on screen
    var codeRot = [-0.4, 0.5, 0];
    [{ w: 0.25, off: 0.04 }, { w: 0.18, off: 0.02 }, { w: 0.22, off: 0 }].forEach(function (cl, ci) {
      var line = new THREE.Mesh(
        new THREE.PlaneGeometry(cl.w, 0.005),
        new THREE.MeshBasicMaterial({ color: 0xA3B18A, transparent: true, opacity: 0.6 - ci * 0.1 })
      );
      line.position.set(lapX - 0.05, lapY + 0.16 - ci * 0.025, lapZ - 0.09);
      line.rotation.set(codeRot[0], codeRot[1], codeRot[2]);
      scene.add(line);
    });

    // Store Kent's parts for idle animation
    scene._kent = {
      torso: torso, head: head, armR: armR, forearmR: forearmR, stick: stick,
      figX: figX, figZ: figZ, baseY: gY
    };

    // Store laptop screen for animation
    scene._laptopScreen = screen;

    // === Ground grass/ferns around clearing ===
    var grassMat = new THREE.MeshStandardMaterial({ color: 0x2D4233, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    var grassMat2 = new THREE.MeshStandardMaterial({ color: 0x3A5A40, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
    var grassBlades = [];
    for (var gi = 0; gi < (isMobile ? 30 : 60); gi++) {
      var ga = Math.random() * Math.PI * 2;
      var gr = 3 + Math.random() * 10;
      var gx = Math.cos(ga) * gr;
      var gz = Math.sin(ga) * gr;
      var gy = getGroundY(gx, gz);
      var bladeH = 0.15 + Math.random() * 0.25;
      var blade = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04 + Math.random() * 0.04, bladeH),
        Math.random() > 0.5 ? grassMat : grassMat2
      );
      blade.position.set(gx, gy + bladeH / 2, gz);
      blade.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      scene.add(blade);
      grassBlades.push(blade);
    }
    scene._grass = grassBlades;

    // === Visitor name carved on a tree (if they typed it in the console) ===
    var visitorName = localStorage.getItem("visitorName");
    if (visitorName) {
      // Place at the edge of the clearing — visible from ch2-3 camera positions
      // Camera at ch2: (3, 2.5, 10) looking at (1, 0.5, 0)
      // Camera at ch3: (-1, 2, 5) looking at (-1, 0.5, -1)
      // Tree at (2, y, 3) is right of the fire, visible from both angles
      var carveX = 2, carveZ = 3;
      var carveGY = getGroundY(carveX, carveZ);

      // Carve tree — thicker trunk so text is readable
      var carveTree = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.28, 3.5, 7),
        new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.85, flatShading: true })
      );
      carveTree.position.set(carveX, carveGY + 1.75, carveZ);
      scene.add(carveTree);

      // Canopy
      var carveCanopy = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 7, 5),
        new THREE.MeshStandardMaterial({ color: 0x3A5A40, roughness: 0.75, flatShading: true })
      );
      carveCanopy.position.set(carveX, carveGY + 4, carveZ);
      carveCanopy.scale.y = 0.7;
      scene.add(carveCanopy);

      // Carving text — as a sprite facing the camera
      var carveLabel = makeLabel("Kent + " + visitorName, {
        fontSize: 18, fontWeight: "600", color: "#DAD7CD", scale: 1.0, opacity: 0.7
      });
      carveLabel.position.set(carveX, carveGY + 1.6, carveZ + 0.3);
      scene.add(carveLabel);

      // Heart above
      var heartLabel = makeLabel("\u2665", {
        fontSize: 16, fontWeight: "400", color: "#A3B18A", scale: 0.5, opacity: 0.6
      });
      heartLabel.position.set(carveX, carveGY + 2.0, carveZ + 0.3);
      scene.add(heartLabel);

      // Small warm light on the carving
      var carveLight = new THREE.PointLight(0xE8C87A, 0.3, 4);
      carveLight.position.set(carveX, carveGY + 1.8, carveZ + 0.5);
      scene.add(carveLight);
    }

    // === Brand label floats above the campsite ===
    // Brand label — small, off to the side so it doesn't block the campsite
    var brand = makeLabel("//kent.dev", { fontSize: 22, fontWeight: "700", color: "#A3B18A", scale: 1.2, opacity: 0.5 });
    brand.position.set(-3, gY + 2.2, -2); scene.add(brand); scene._brandLabel = brand;
    var sub = makeLabel("Senior Software Developer", { fontSize: 11, fontWeight: "400", color: "rgba(163,177,138,0.35)", scale: 1.0, opacity: 0.3 });
    sub.position.set(-3, gY + 1.7, -2); scene.add(sub); scene._brandSub = sub;
  }

  // ======================== Project Lanterns — branch-hung, zigzag ========================
  function createProjectLanterns() {
    // Zigzag: lanterns alternate sides of the path
    // Odd index = left side (host tree at negative X), even = right side
    var positions = [
      { x: -1, z: -10, hostX: -4, chapter: 0.47 },  // Vintech — left
      { x:  2, z: -14, hostX:  5, chapter: 0.52 },   // ZamGo — right
      { x: -2, z: -19, hostX: -5, chapter: 0.57 },   // Vintazk Uni — left
      { x:  1, z: -23, hostX:  4, chapter: 0.60 },   // Barangay — right
      { x: -1, z: -27, hostX: -4, chapter: 0.62 }    // SmartScore — left
    ];

    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x2D1B0E, roughness: 0.85, flatShading: true });
    var ropeMat = new THREE.MeshBasicMaterial({ color: 0x5C4033 });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x4A3520, roughness: 0.9 });

    PROJECTS.forEach(function (proj, i) {
      var p = positions[i];
      var gY = getGroundY(p.hostX, p.z);
      var treeH = 5 + Math.random() * 2;
      var branchY = gY + treeH * 0.7;

      // Host tree trunk
      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.14, treeH, 6),
        trunkMat
      );
      trunk.position.set(p.hostX, gY + treeH / 2, p.z);
      scene.add(trunk);

      // Host tree canopy (simple)
      var canopyMat = new THREE.MeshStandardMaterial({ color: CANOPY_COLORS[i % 6], roughness: 0.75, flatShading: true });
      for (var ci = 0; ci < 2; ci++) {
        var cr = 1.2 + Math.random() * 0.8;
        var canopy = new THREE.Mesh(new THREE.SphereGeometry(cr, 7, 6), canopyMat);
        canopy.position.set(p.hostX + (Math.random() - 0.5) * 0.5, branchY + 1 + ci * 0.8, p.z + (Math.random() - 0.5) * 0.5);
        canopy.scale.y = 0.7;
        scene.add(canopy);
      }

      // Branch extending from trunk toward the path
      var branchLen = Math.abs(p.x - p.hostX) + 0.5;
      var branchDir = p.x > p.hostX ? 1 : -1;
      var branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.05, branchLen, 4),
        trunkMat
      );
      branch.position.set(
        (p.hostX + p.x) / 2,
        branchY,
        p.z
      );
      branch.rotation.z = branchDir * (Math.PI / 2 - 0.2);
      scene.add(branch);

      // Rope hanging from branch tip
      var ropeLen = 0.6;
      var hangY = branchY - ropeLen / 2;
      var rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, ropeLen, 3),
        ropeMat
      );
      rope.position.set(p.x, hangY, p.z);
      scene.add(rope);

      // Wooden frame (4 vertical sticks)
      var frameH = 0.3;
      var frameW = 0.12;
      var frameTop = hangY - ropeLen / 2;
      for (var fi = 0; fi < 4; fi++) {
        var fx = (fi % 2 === 0 ? -1 : 1) * frameW / 2;
        var fz = (fi < 2 ? -1 : 1) * frameW / 2;
        var stick = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, frameH, 3),
          frameMat
        );
        stick.position.set(p.x + fx, frameTop - frameH / 2, p.z + fz);
        scene.add(stick);
      }

      // Bark cap on top
      var cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.06, 4),
        frameMat
      );
      cap.position.set(p.x, frameTop + 0.03, p.z);
      scene.add(cap);

      // Glowing globe inside frame
      var globeY = frameTop - frameH * 0.4;
      var globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshPhysicalMaterial({
          color: proj.color, emissive: proj.color, emissiveIntensity: 0.15,
          transparent: true, opacity: 0.4, roughness: 0.1, clearcoat: 1.0
        })
      );
      globe.position.set(p.x, globeY, p.z);
      scene.add(globe);

      // Warm point light
      var light = new THREE.PointLight(proj.color, 0.8, 12);
      light.position.set(p.x, globeY, p.z);
      scene.add(light);

      // Label
      var label = makeLabel(proj.name, {
        fontSize: 20, fontWeight: "600", color: "#DAD7CD",
        sub: proj.sub, scale: 1.4, opacity: 0.01
      });
      label.position.set(p.x, globeY + 1, p.z);
      scene.add(label);

      lanterns.push({
        mesh: globe, light: light, label: label,
        baseY: globeY, x: p.x, z: p.z, chapter: p.chapter
      });
    });
  }

  // ======================== Fireflies (Tech) ========================
  function createFireflies() {
    var ffColors = [0xA3B18A, 0xB5C99A, 0xDAD7CD, 0x97A97C, 0x6B8F71];
    // Camera at ch6: pos (0, 3.2, -22) looking at (-6, 3, -28)
    // Place fireflies IN FRONT of camera — between camera and lookAt point, spread to sides
    // Two rows: close row and far row so they don't all stack

    // Fireflies in the meadow (center -3, -36) at eye level
    TECH.forEach(function (name, i) {
      var col = i % 4;
      var row = Math.floor(i / 4);
      // Spread across the meadow clearing
      var x = -5 + col * 3 + (Math.random() - 0.5) * 1;
      var z = -33 - row * 4 + (Math.random() - 0.5) * 1;
      var y = 2 + row * 0.8 + Math.random() * 1.5; // eye level, not above canopy

      var color = ffColors[i % ffColors.length];
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 }));
      mesh.position.set(x, y, z); scene.add(mesh);
      var light = null;
      if (!isMobile && i % 3 === 0) { light = new THREE.PointLight(color, 0.4, 6); light.position.set(x, y, z); scene.add(light); }
      var label = makeLabel(name, { fontSize: 22, fontWeight: "600", color: "#DAD7CD", scale: 1.8, opacity: 0.01 });
      label.position.set(x, y + 0.8, z); scene.add(label);
      fireflies.push({
        mesh: mesh, light: light, label: label, baseX: x, baseY: y, baseZ: z, color: color,
        phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.8,
        ampX: 0.3 + Math.random() * 0.8, ampY: 0.2 + Math.random() * 0.4, ampZ: 0.3 + Math.random() * 0.8
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
      { x: -2, z: 38, y: 2.5 },    // Entrance
      { x: 2, z: 28, y: 2.5 },     // Along path
      { x: -1, z: 18, y: 2.5 },    // Approaching clearing
      { x: 3, z: 8, y: 2.5 },      // Near clearing
      { x: -2, z: -6, y: 2.5 },    // Grove entrance
      { x: 1, z: -15, y: 2.5 },    // Mid-grove
      { x: -1, z: -22, y: 2.5 },   // Late grove
      { x: -3, z: -30, y: 2.5 },   // Meadow entrance
      { x: -5, z: -35, y: 2 },     // Meadow edge
      { x: -1, z: -39, y: 2 }      // Meadow far
    ];

    lampPositions.slice(0, PATH_LAMP_COUNT).forEach(function (lp) {
      var gY = getGroundY(lp.x, lp.z);

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

      // Light on every 3rd firefly (desktop only) — saves GPU
      var light = null;
      if (!isMobile && i % 3 === 0) {
        light = new THREE.PointLight(color, 0.25, 5);
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

  // ======================== Sky — Stars + Moon ========================
  // ======================== Billboard Trees — 2D silhouettes on the horizon ========================
  function createBillboardTrees() {
    // Dark silhouette material — these are just flat cutouts
    var billboardMats = [
      new THREE.MeshBasicMaterial({ color: 0x0A1A10, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
      new THREE.MeshBasicMaterial({ color: 0x0D1F14, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
      new THREE.MeshBasicMaterial({ color: 0x112218, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
    ];

    var billboards = [];
    var count = isMobile ? 30 : 60;

    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      var dist = 45 + Math.random() * 15; // far horizon ring
      var x = Math.cos(angle) * dist;
      var z = Math.sin(angle) * dist;
      var gY = terrainHeight(x, z);

      // Each billboard = trunk (thin rect) + canopy (triangle or circle)
      var group = new THREE.Group();
      var h = 5 + Math.random() * 8;
      var layer = Math.floor(Math.random() * 3); // depth layer determines opacity
      var mat = billboardMats[layer];

      // Trunk
      var trunkW = 0.15 + Math.random() * 0.1;
      var trunk = new THREE.Mesh(new THREE.PlaneGeometry(trunkW, h * 0.5), mat);
      trunk.position.y = h * 0.25;
      group.add(trunk);

      // Canopy — alternate between triangle (pine) and circle (round)
      if (Math.random() > 0.4) {
        // Pine silhouette — triangle
        var triH = h * 0.6;
        var triW = 1.5 + Math.random() * 2;
        var triGeo = new THREE.BufferGeometry();
        triGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
          -triW / 2, 0, 0,   triW / 2, 0, 0,   0, triH, 0
        ]), 3));
        triGeo.computeVertexNormals();
        var tri = new THREE.Mesh(triGeo, mat);
        tri.position.y = h * 0.35;
        group.add(tri);
      } else {
        // Round silhouette — circle
        var circR = 1 + Math.random() * 1.5;
        var circ = new THREE.Mesh(new THREE.CircleGeometry(circR, 8), mat);
        circ.position.y = h * 0.55;
        group.add(circ);
      }

      group.position.set(x, gY, z);
      scene.add(group);
      billboards.push(group);
    }
    scene._billboards = billboards;
  }

  function createSky() {
    // Stars
    var count = 800;
    var positions = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      // Hemisphere above (y > 0)
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.random() * Math.PI * 0.45; // upper hemisphere only
      var r = 80 + Math.random() * 40;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      var brightness = 0.4 + Math.random() * 0.6;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness * (0.9 + Math.random() * 0.1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    var stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.2, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true
    }));
    scene.add(stars);
    scene._stars = stars;

    // Moon — small, far away, off to the side
    var moonGeo = new THREE.SphereGeometry(1.5, 12, 12);
    var moonMat = new THREE.MeshBasicMaterial({ color: 0xDDE8F0, transparent: true, opacity: 0.2 });
    var moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(-60, 55, -70);
    scene.add(moonMesh);
    // Moon glow
    var glowGeo = new THREE.SphereGeometry(3, 12, 12);
    var glowMat = new THREE.MeshBasicMaterial({ color: 0xAABBCC, transparent: true, opacity: 0.04 });
    var moonGlow = new THREE.Mesh(glowGeo, glowMat);
    moonGlow.position.set(-30, 50, -40);
    scene.add(moonGlow);
  }

  // ======================== Smoke ========================
  function createSmoke() {
    var smokeParticles = [];
    for (var i = 0; i < 15; i++) {
      var smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0 })
      );
      smoke.position.set(0, 0.5, 0.5);
      smoke.userData = {
        speed: 0.2 + Math.random() * 0.4,
        maxH: 4 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.4,
        growRate: 1.5 + Math.random() * 1.5
      };
      scene.add(smoke);
      smokeParticles.push(smoke);
    }
    scene._smoke = smokeParticles;
  }

  // ======================== Ground Details — rocks, bushes, fallen logs ========================
  function createGroundDetails() {
    var rockMat = new THREE.MeshStandardMaterial({ color: 0x4A4A4A, roughness: 0.95, flatShading: true });
    var bushColors = [0x2D4233, 0x344E41, 0x3A5A40, 0x4A6B3F];

    // Scatter rocks
    for (var i = 0; i < 30; i++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 3 + Math.random() * 35;
      var rx = Math.cos(angle) * dist;
      var rz = Math.sin(angle) * dist;
      var dc = Math.sqrt(rx * rx + rz * rz);
      if (dc < 14) continue;
      var gy = getGroundY(rx, rz);

      var rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.25, 0),
        rockMat
      );
      rock.position.set(rx, gy + 0.1, rz);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.scale.set(1, 0.5 + Math.random() * 0.5, 1);
      scene.add(rock);
    }

    // Bushes (small clusters of spheres)
    for (var j = 0; j < 20; j++) {
      var ba = Math.random() * Math.PI * 2;
      var bd = 4 + Math.random() * 30;
      var bx = Math.cos(ba) * bd;
      var bz = Math.sin(ba) * bd;
      var bdc = Math.sqrt(bx * bx + bz * bz);
      if (bdc < 14) continue;
      var bgy = getGroundY(bx, bz);

      var bushColor = bushColors[Math.floor(Math.random() * bushColors.length)];
      var clusterCount = 2 + Math.floor(Math.random() * 2);
      for (var k = 0; k < clusterCount; k++) {
        var bush = new THREE.Mesh(
          new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 5, 4),
          new THREE.MeshStandardMaterial({ color: bushColor, roughness: 0.9, flatShading: true })
        );
        bush.position.set(
          bx + (Math.random() - 0.5) * 0.5,
          bgy + 0.15 + Math.random() * 0.15,
          bz + (Math.random() - 0.5) * 0.5
        );
        bush.scale.y = 0.6 + Math.random() * 0.3;
        scene.add(bush);
      }
    }

    // Fallen logs
    for (var l = 0; l < 6; l++) {
      var la = Math.random() * Math.PI * 2;
      var ld = 6 + Math.random() * 25;
      var lx = Math.cos(la) * ld;
      var lz = Math.sin(la) * ld;
      var ldc = Math.sqrt(lx * lx + lz * lz);
      if (ldc < 14) continue;
      var lgy = getGroundY(lx, lz);

      var flog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1 + Math.random() * 0.1, 0.12 + Math.random() * 0.1, 1.5 + Math.random() * 2, 6),
        new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9, flatShading: true })
      );
      flog.position.set(lx, lgy + 0.1, lz);
      flog.rotation.set(0, Math.random() * Math.PI, Math.PI / 2);
      scene.add(flog);
    }
  }

  // ======================== Pond ========================
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

  function spawnEmber(worldX, worldZ) {
    var eY = getGroundY(worldX, worldZ);
    var ember = new THREE.Mesh(
      new THREE.CircleGeometry(0.06 + Math.random() * 0.05, 6),
      new THREE.MeshBasicMaterial({
        color: [0xFF8833, 0xFFAA33, 0xE8C87A, 0xFFCC55][Math.floor(Math.random() * 4)],
        transparent: true, opacity: 0.7, depthWrite: false
      })
    );
    ember.rotation.x = -Math.PI / 2;
    ember.position.set(worldX, eY + 0.03, worldZ);
    scene.add(ember);
    groundEmbers.push({ mesh: ember, phase: Math.random() * Math.PI * 2 });
    saveEmbers();
    if (groundEmbers.length > MAX_EMBERS) {
      var old = groundEmbers.shift();
      scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
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
  var lastMouseSpawn = 0;
  function onMouseMove(e) {
    mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    if (isMouseDown) {
      var now = Date.now();
      if (now - lastMouseSpawn > 80) {
        var wp = getWorldPos(e.clientX, e.clientY);
        spawnFirefly(wp.x, wp.y, wp.z);
        lastMouseSpawn = now;
      }
    }
    // Cursor trail — small sage particles following mouse
    var now = Date.now();
    if (now - lastTrailTime > 50) { // throttle to 20 per second
      lastTrailTime = now;
      var trailWp = getWorldPos(e.clientX, e.clientY);
      var tp = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xA3B18A, transparent: true, opacity: 0.4 })
      );
      tp.position.set(trailWp.x, trailWp.y, trailWp.z);
      scene.add(tp);
      cursorTrail.push({ mesh: tp, born: now });
      if (cursorTrail.length > MAX_CURSOR_TRAIL) {
        var old = cursorTrail.shift();
        scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
      }
    }
  }
  function onClick(e) {
    var wp = getWorldPos(e.clientX, e.clientY);
    if (scrollProgress >= 0.20 && scrollProgress <= 0.42) {
      spawnEmber(wp.x, wp.z);
    } else {
      spawnFirefly(wp.x, wp.y, wp.z);
    }
    if (window.playSound) playSound("click");
  }
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

    // Camera — smooth damped position + lookAt
    var cam = getCameraState(scrollProgress);
    var damp = 0.025;
    camera.position.x += (cam.px + mouse.ndcX * 1.2 - camera.position.x) * damp;
    camera.position.y += (cam.py + mouse.ndcY * 0.8 - camera.position.y) * damp;
    camera.position.z += (cam.pz - camera.position.z) * damp;
    // Damped lookAt — prevent snapping
    if (!scene._lookTarget) scene._lookTarget = { x: cam.lx, y: cam.ly, z: cam.lz };
    scene._lookTarget.x += (cam.lx - scene._lookTarget.x) * damp;
    scene._lookTarget.y += (cam.ly - scene._lookTarget.y) * damp;
    scene._lookTarget.z += (cam.lz - scene._lookTarget.z) * damp;
    camera.lookAt(scene._lookTarget.x, scene._lookTarget.y, scene._lookTarget.z);

    // Fog
    // Smoother fog — lerp toward target instead of snapping
    var fogBase = isMobile ? 18 : 12;
    var fogMin = isMobile ? 10 : 6;
    var fogFarBase = isMobile ? 90 : 80;
    var fogFarMax = isMobile ? 130 : 100;
    var fogNearTarget = lerp(fogBase, fogMin, Math.min(1, scrollProgress * 1.2));
    var fogFarTarget = lerp(fogFarBase, fogFarMax, scrollProgress);
    scene.fog.near += (fogNearTarget - scene.fog.near) * 0.05;
    scene.fog.far += (fogFarTarget - scene.fog.far) * 0.05;

    // Lighting
    var fills = scene._fills;
    if (fills) {
      var vb = Math.min(scrollVelocity * 40, 0.4);
      fills[0].intensity = 0.4 + vb + (scrollProgress > 0.2 && scrollProgress < 0.45 ? 0.3 : 0);
      fills[1].intensity = 0.3 + vb + (scrollProgress > 0.38 && scrollProgress < 0.65 ? 0.3 : 0);
      fills[2].intensity = 0.2 + vb + (scrollProgress > 0.6 && scrollProgress < 0.8 ? 0.3 : 0);
    }
    if (scene._moon) scene._moon.intensity = 0.4 + scrollProgress * 0.4;

    // Campfire — flickering light + rising embers
    // Campfire visible while near the campsite (scroll 0.15 to 0.50), then fades but never fully
    // Campfire: ramp up as you approach, full during camp chapters, gentle fade but never off
    var cAmp = scrollProgress < 0.20 ? Math.min(1, scrollProgress / 0.10) : (scrollProgress < 0.42 ? 1.0 : Math.max(0.15, 1 - (scrollProgress - 0.42) * 0.8));
    if (scene._fireLight) {
      var flicker = 2.5 + Math.sin(t * 8) * 0.6 + Math.sin(t * 13) * 0.3 + Math.sin(t * 21) * 0.15;
      scene._fireLight.intensity = flicker * cAmp;
      // Color shifts between orange → red-orange → yellow-orange
      var colorShift = Math.sin(t * 3) * 0.5 + 0.5; // 0 to 1
      var fireR = 1.0;
      var fireG = 0.45 + colorShift * 0.15; // 0.45 to 0.60
      var fireB = 0.15 + colorShift * 0.1;  // 0.15 to 0.25
      scene._fireLight.color.setRGB(fireR, fireG, fireB);
    }
    if (scene._fireFill) {
      scene._fireFill.intensity = (0.9 + Math.sin(t * 6) * 0.3) * cAmp;
      // Redder fill
      scene._fireFill.color.setRGB(0.9, 0.35 + Math.sin(t * 2) * 0.1, 0.1);
    }
    if (scene._fireBounce) {
      scene._fireBounce.intensity = (0.7 + Math.sin(t * 4) * 0.2) * cAmp;
    }
    if (scene._fireUp) {
      scene._fireUp.intensity = (0.4 + Math.sin(t * 5) * 0.15) * cAmp;
    }
    // Fire embers — rise, drift, loop
    if (scene._fireEmbers) {
      for (var ei = 0; ei < scene._fireEmbers.length; ei++) {
        var em = scene._fireEmbers[ei], ed = em.userData;
        var cycle = ((t * ed.speed + ed.phase) % ed.maxH) / ed.maxH; // 0 to 1
        em.position.set(
          ed.baseX + Math.sin(t * 2 + ed.phase) * ed.drift,
          cycle * ed.maxH + 0.2,
          ed.baseZ + Math.cos(t * 1.5 + ed.phase) * ed.drift * 0.5
        );
        em.material.opacity = (1 - cycle) * 0.8 * cAmp;
        em.scale.setScalar((1 - cycle) * 0.8 + 0.2);
      }
    }
    // Brand label — fades when camera is close to campsite
    var brandFade = scrollProgress < 0.15 ? 1.0 : (scrollProgress < 0.40 ? Math.max(0, 1 - (scrollProgress - 0.15) * 4) : 0);
    if (scene._brandLabel) {
      scene._brandLabel.position.y = 2.2 + Math.sin(t * 0.4) * 0.06;
      scene._brandLabel.material.opacity = 0.5 * brandFade;
    }
    if (scene._brandSub) {
      scene._brandSub.position.y = 1.7 + Math.sin(t * 0.4 + 0.5) * 0.04;
      scene._brandSub.material.opacity = 0.3 * brandFade;
    }
    // Fade out welcome back after 3 seconds
    if (scene._welcomeBack) {
      var wbAge = t - (scene._welcomeBackTime || (scene._welcomeBackTime = t));
      if (wbAge > 3) {
        scene._welcomeBack.material.opacity *= 0.95;
        if (scene._welcomeBack.material.opacity < 0.01) {
          scene.remove(scene._welcomeBack);
          scene._welcomeBack = null;
        }
      }
    }

    // === Kent idle animation — breathing, head tilt, stick poking ===
    if (scene._kent) {
      var k = scene._kent;
      // Breathing — torso scale pulses
      var breath = Math.sin(t * 1.2) * 0.008;
      k.torso.scale.set(1 + breath, 1 + breath * 0.5, 1 + breath);
      // Head tilts subtly toward fire
      k.head.rotation.x = Math.sin(t * 0.4) * 0.04;
      k.head.rotation.z = Math.sin(t * 0.3) * 0.03;
      // Right arm — slow stick poke cycle
      var poke = Math.sin(t * 0.6) * 0.08;
      k.armR.rotation.x = 0.6 + poke;
      k.forearmR.rotation.x = 0.8 + poke * 0.5;
      k.stick.rotation.x = 0.9 + poke * 0.6;
    }

    // === Laptop screen animation — cursor blink + code scroll ===
    if (scene._laptopScreen) {
      var laptopZoom = 0;
      if (scrollProgress > 0.34 && scrollProgress < 0.37) {
        laptopZoom = 1 - Math.abs(scrollProgress - 0.355) / 0.015;
        laptopZoom = Math.max(0, Math.min(1, laptopZoom));
      }
      scene._laptopScreen.material.emissiveIntensity = 0.25 + Math.sin(t * 2.5) * 0.08 + laptopZoom * 0.5;
      if (scene._screenLight) {
        scene._screenLight.intensity = 0.3 + Math.sin(t * 2) * 0.1 + laptopZoom * 0.6;
      }
    }

    // === Grass sway in wind ===
    if (scene._grass) {
      for (var gri = 0; gri < scene._grass.length; gri++) {
        var blade = scene._grass[gri];
        blade.rotation.z = (Math.random() > 0.99 ? 0 : blade.rotation.z) + Math.sin(t * 1.5 + gri * 0.5) * 0.06;
      }
    }

    // === Tree canopy wind sway ===
    if (scene._canopies) {
      for (var ci = 0; ci < scene._canopies.length; ci++) {
        var cp = scene._canopies[ci];
        cp.mesh.rotation.x = cp.baseRx + Math.sin(t * 0.8 + cp.phase) * 0.02;
        cp.mesh.rotation.z = Math.sin(t * 0.6 + cp.phase * 1.3) * 0.015;
      }
    }

    // Canopy reveal — all lanterns flash when camera rises above (ch8)
    var canopyReveal = 0;
    if (scrollProgress > 0.82 && scrollProgress < 0.90) {
      canopyReveal = 1 - Math.abs(scrollProgress - 0.855) / 0.035;
      canopyReveal = Math.max(0, Math.min(1, canopyReveal));
      canopyReveal = canopyReveal * canopyReveal * (3 - 2 * canopyReveal);
    }
    // Burst fireflies at peak
    if (canopyReveal > 0.95 && !scene._canopyFlashed) {
      scene._canopyFlashed = true;
      for (var ri = 0; ri < 15; ri++) {
        var ra = (ri / 15) * Math.PI * 2;
        var rr = 5 + Math.random() * 8;
        spawnFirefly(camera.position.x + Math.cos(ra) * rr, camera.position.y - 2 + Math.random() * 4, camera.position.z + Math.sin(ra) * rr);
      }
    }
    if (scrollProgress < 0.82 || scrollProgress > 0.90) scene._canopyFlashed = false;

    // Lanterns — globe sways gently, brightens when camera is near
    for (var li = 0; li < lanterns.length; li++) {
      var lan = lanterns[li];
      // Gentle sway like a hanging lamp
      var sway = Math.sin(t * 0.8 + li * 1.5) * 0.08;
      var bobY = Math.sin(t * 0.5 + li * 0.9) * 0.05;
      lan.mesh.position.y = lan.baseY + bobY;
      lan.mesh.position.x = lan.x + sway;
      lan.light.position.set(lan.mesh.position.x, lan.baseY + bobY, lan.z);
      lan.label.position.set(lan.mesh.position.x, lan.baseY + bobY + 0.8, lan.z);

      // Proximity: how close is scrollProgress to this lantern's chapter?
      var dist = Math.abs(scrollProgress - (lan.chapter || 0.5));
      var near = Math.max(0, 1 - dist * 8);

      var revealNear = Math.max(near, canopyReveal);
      var tG = lerp(0.15, 1.2, revealNear), tL = lerp(0.3, 1.8, revealNear);
      var tO = lerp(0.0, 0.95, revealNear), tS = lerp(0.8, 1.3, revealNear);
      lan.mesh.material.emissiveIntensity += (tG - lan.mesh.material.emissiveIntensity) * 0.03;
      lan.light.intensity += (tL - lan.light.intensity) * 0.03;
      lan.label.material.opacity += (tO - lan.label.material.opacity) * 0.025;
      lan.mesh.scale.setScalar(lan.mesh.scale.x + (tS - lan.mesh.scale.x) * 0.03);
      // Flicker the light subtly
      lan.light.intensity *= 0.95 + Math.sin(t * 6 + li * 2) * 0.05;
    }

    // Fireflies — glow strongest in ch6 zone (0.63-0.75)
    var inTech = scrollProgress > 0.60 && scrollProgress < 0.80;
    var techProximity = inTech ? Math.min(1, 1 - Math.abs(scrollProgress - 0.70) * 4) : 0;
    for (var fi = 0; fi < fireflies.length; fi++) {
      var ff = fireflies[fi];

      // Fireflies stay at their meadow positions — camera comes to them
      var fx = ff.baseX + Math.sin(t * ff.speed + ff.phase) * ff.ampX;
      var fy = ff.baseY + Math.cos(t * ff.speed * 0.7 + ff.phase) * ff.ampY;
      var fz = ff.baseZ + Math.sin(t * ff.speed * 0.5 + ff.phase * 2) * ff.ampZ;

      ff.mesh.position.set(fx, fy, fz);
      if (ff.light) ff.light.position.set(fx, fy, fz);
      ff.label.position.set(fx, fy + 1.2, fz);

      // Direct set from proximity — no slow lerp, responsive to scroll
      var fO = lerp(0.05, 0.95, techProximity);
      var fL = lerp(0.02, 0.6, techProximity);
      var fLO = lerp(0.0, 0.9, techProximity);
      var fS = lerp(0.3, 1.8, techProximity);
      ff.mesh.material.opacity = fO;
      if (ff.light) ff.light.intensity = fL;
      ff.label.material.opacity = fLO;
      ff.mesh.scale.setScalar(fS);
      // Flicker
      if (techProximity > 0.1) ff.mesh.material.opacity *= 0.85 + Math.sin(t * 3 + fi * 2.5) * 0.15;
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

    // Stars twinkle — pulse opacity of individual stars
    if (scene._stars) {
      scene._stars.rotation.y = t * 0.001;
      scene._stars.material.opacity = 0.6 + Math.sin(t * 0.5) * 0.15;
    }

    // Smoke rises — wind drift + dispersal
    var windX = Math.sin(t * 0.3) * 0.4; // gentle wind direction shifts
    var windZ = Math.cos(t * 0.2) * 0.2;
    if (scene._smoke) {
      for (var si = 0; si < scene._smoke.length; si++) {
        var sm = scene._smoke[si], sd = sm.userData;
        var cycle = ((t * sd.speed + sd.phase) % sd.maxH) / sd.maxH;
        var h = cycle * sd.maxH;
        // Wind pushes smoke sideways as it rises
        sm.position.set(
          sd.drift * cycle + windX * cycle * 1.5 + Math.sin(t * 0.5 + sd.phase) * 0.3 * cycle,
          0.5 + h,
          0.5 + windZ * cycle + Math.cos(t * 0.3 + sd.phase) * 0.15 * cycle
        );
        // Fade: appear quickly, linger longer, fade softly
        var fadeIn = Math.min(1, cycle * 4);
        var fadeOut = Math.max(0, 1 - (cycle - 0.6) * 2.5);
        sm.material.opacity = fadeIn * fadeOut * 0.1 * cAmp;
        // Grow faster as it disperses
        var scale = 0.2 + cycle * cycle * sd.growRate * 1.5;
        sm.scale.setScalar(scale);
      }
    }




    // Mist
    if (scene._mist) { scene._mist.rotation.y = t * 0.002; scene._mist.position.y = Math.sin(t * 0.1) * 0.2; }

    // Billboard trees face camera (every 3rd frame to save CPU)
    if (scene._billboards && Math.floor(t * 20) % 3 === 0) {
      for (var bi = 0; bi < scene._billboards.length; bi++) {
        var bb = scene._billboards[bi];
        bb.rotation.y = Math.atan2(camera.position.x - bb.position.x, camera.position.z - bb.position.z);
      }
    }

    // Ground embers pulse
    for (var gei = 0; gei < groundEmbers.length; gei++) {
      var ge = groundEmbers[gei];
      ge.mesh.material.opacity = 0.35 + Math.sin(t * 2 + ge.phase) * 0.2;
    }

    // Cursor trail fade
    for (var cti = cursorTrail.length - 1; cti >= 0; cti--) {
      var ct = cursorTrail[cti];
      var age = (Date.now() - ct.born) / 1000;
      ct.mesh.material.opacity = Math.max(0, 0.4 - age * 0.5);
      ct.mesh.scale.setScalar(Math.max(0.1, 1 - age * 1.2));
      if (age > 1) {
        scene.remove(ct.mesh); ct.mesh.geometry.dispose(); ct.mesh.material.dispose();
        cursorTrail.splice(cti, 1);
      }
    }

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

    // Chapter transition burst — detect chapter boundary crossings
    var currentChapter = Math.floor(scrollProgress * 10);
    if (scene._lastChapter === undefined) scene._lastChapter = currentChapter;
    if (currentChapter !== scene._lastChapter) {
      scene._lastChapter = currentChapter;
      // Burst of fireflies at camera position
      for (var bi = 0; bi < 8; bi++) {
        var ba = Math.random() * Math.PI * 2;
        var br = 2 + Math.random() * 4;
        spawnFirefly(
          camera.position.x + Math.cos(ba) * br,
          camera.position.y - 1 + Math.random() * 3,
          camera.position.z + Math.sin(ba) * br - 3
        );
      }
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

  // Forest ambient audio — MP3 file
  var forestAudio = null;
  var audioFading = false;

  function initAudio() {
    if (forestAudio) return;
    try {
      forestAudio = new Audio("audio/forest.m4a");
      forestAudio.loop = true;
      forestAudio.volume = 0;

      var muted = localStorage.getItem("sound-muted") === "true";
      if (!muted) {
        forestAudio.play().catch(function () {});
        fadeAudio(0.3, 2000);
      }

      // Mute button
      var muteBtn = document.getElementById("forestMuteBtn");
      if (muteBtn) {
        updateMuteIcon(muteBtn, muted);

        muteBtn.addEventListener("click", function () {
          muted = !muted;
          localStorage.setItem("sound-muted", muted);
          updateMuteIcon(muteBtn, muted);

          if (muted) {
            fadeAudio(0, 500);
          } else {
            forestAudio.play().catch(function () {});
            fadeAudio(0.3, 500);
          }
        });
      }
    } catch (e) {}
  }

  function updateMuteIcon(btn, muted) {
    var icon = btn.querySelector("i");
    if (icon) {
      icon.className = muted ? "fas fa-volume-mute" : "fas fa-volume-up";
    }
    btn.classList.toggle("muted", muted);
  }

  function fadeAudio(target, duration) {
    if (!forestAudio) return;
    var muted = localStorage.getItem("sound-muted") === "true";
    var finalTarget = muted ? 0 : target;
    var start = forestAudio.volume;
    var startTime = Date.now();

    function step() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(1, elapsed / duration);
      forestAudio.volume = start + (finalTarget - start) * progress;
      if (progress < 1) requestAnimationFrame(step);
    }
    step();
  }

  function updateAmbientAudio() {
    if (!forestAudio) return;
    var muted = localStorage.getItem("sound-muted") === "true";
    var target = muted ? 0 : 0.3;
    // Gentle drift toward target
    forestAudio.volume += (target - forestAudio.volume) * 0.02;
  }

  function stopAudio() {
    if (forestAudio) {
      fadeAudio(0, 800);
      setTimeout(function () {
        if (forestAudio) { forestAudio.pause(); forestAudio.currentTime = 0; forestAudio = null; }
      }, 900);
    }
  }

  // ======================== Cleanup ========================
  function cleanup() {
    for (var i = spawned.length - 1; i >= 0; i--) { scene.remove(spawned[i]); spawned[i].geometry.dispose(); spawned[i].material.dispose(); }
    spawned = [];
    for (var j = trails.length - 1; j >= 0; j--) { scene.remove(trails[j]); trails[j].geometry.dispose(); trails[j].material.dispose(); }
    trails = [];
    for (var k = groundEmbers.length - 1; k >= 0; k--) {
      scene.remove(groundEmbers[k].mesh); groundEmbers[k].mesh.geometry.dispose(); groundEmbers[k].mesh.material.dispose();
    }
    groundEmbers = [];
    for (var ct = cursorTrail.length - 1; ct >= 0; ct--) {
      scene.remove(cursorTrail[ct].mesh); cursorTrail[ct].mesh.geometry.dispose(); cursorTrail[ct].mesh.material.dispose();
    }
    cursorTrail = [];
  }

  // ======================== Public API ========================
  window.creativeScene = {
    start: function () {
      if (isActive) return;
      if (!scene) { if (!init()) return; }
      isActive = true; canvas.style.display = "block"; canvas.style.pointerEvents = "auto";
      clock.start(); animate();
      // Restore previous visit embers after scene is ready
      setTimeout(restoreEmbers, 500);
      // Try to auto-play audio immediately, retry on first interaction if blocked
      initAudio();
      var audioRetry = function () {
        if (forestAudio && forestAudio.paused) {
          forestAudio.play().catch(function () {});
        }
        document.removeEventListener("click", audioRetry);
        document.removeEventListener("touchstart", audioRetry);
        document.removeEventListener("scroll", audioRetry, true);
      };
      document.addEventListener("click", audioRetry);
      document.addEventListener("touchstart", audioRetry);
      document.addEventListener("scroll", audioRetry, true);
    },
    stop: function () {
      isActive = false; stopAudio();
      if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
      if (canvas) { canvas.style.display = "none"; canvas.style.pointerEvents = "none"; }
      saveEmbers();
      cleanup();
    },
    isRunning: function () { return isActive; }
  };
})();
