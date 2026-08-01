// ============================================
// Creative Mode — //dzian Forest
// A scroll-driven walk through a procedural forest
// Projects are lanterns. Tech are fireflies.
// ============================================
(function () {
  var scene, camera, renderer, clock;
  var canvas = null;
  var isActive = false;
  var animationId = null;
  var resizeTimeout = null;
  var listenersBound = false;
  var perfFrames = 0, perfStart = 0, perfTier = 0; // adaptive quality state

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
  var wayLabels = []; // static waypoint labels — faded by camera distance in animate()
  var trails = [];
  var spawned = [];
  var scrollEl = null;
  var lastShapeCount = -1;

  // Mobile detection
  var isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth < 768 && "ontouchstart" in window);

  // Respect reduced-motion for opt-in idle animations (characters, etc.)
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var MAX_TRAILS = isMobile ? 20 : 50;
  var MAX_SPAWNED = isMobile ? 12 : 25;
  var plantedTrees = [];
  var MAX_TREES = 12;
  // The forest remembers: trees planted by the visitor persist across visits
  function saveTrees() {
    try {
      var data = plantedTrees.map(function(e) { return { x: e.x, z: e.z }; });
      localStorage.setItem("plantedTrees", JSON.stringify(data));
    } catch(e) {}
  }

  function restoreTrees() {
    if (!scene) return; // user may exit before the delayed restore fires
    try {
      var data = JSON.parse(localStorage.getItem("plantedTrees") || "[]");
      data.forEach(function(d, i) { spawnTree(d.x, d.z, false, i * 0.15); });
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

  var TREE_COUNT = isMobile ? 30 : 52;
  var AMBIENT_FF_COUNT = isMobile ? 5 : 7;
  // Every path lamp carries a real PointLight now, so this IS the lamp light
  // count. Budget: 3 campfire + 5 project lanterns + these = 15 desktop.
  var PATH_LAMP_COUNT = isMobile ? 5 : 7;
  var lastTouchSpawn = 0;

  // === Palette ===
  // (Trunk/canopy color pools removed — all forest color is baked into the
  //  Kenney model vertex colors in models/forest.js, varied by instance tint.)

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
    // Ch0: "The Road Ahead" (LEFT card) — trees on RIGHT
    { at: 0.00, pos: [0, 8, 44],      look: [2, 0, 20] },
    { at: 0.05, pos: [0, 6, 36],      look: [2, 0.5, 16] },
    // Ch1: "Where the Path Began" (RIGHT card) — forest depth on LEFT
    { at: 0.10, pos: [1, 4.5, 26],    look: [-2, 0.5, 10] },
    { at: 0.16, pos: [1, 3.5, 18],    look: [-1, 0.5, 4] },
    // Ch2: "The Resting Place" (LEFT card) — camp on RIGHT
    { at: 0.22, pos: [3, 2.5, 10],    look: [1, 0.5, 0] },
    { at: 0.28, pos: [3, 2, 6],       look: [0, 0.6, 0] },
    // Ch3: "The Journal" (RIGHT card) — settle in at the campfire, camp on LEFT.
    // (This used to push into a laptop model that no longer exists; it now
    //  frames the fire + tent, which is what "the journal" chapter is about.)
    { at: 0.33,  pos: [2.9, 1.9, 4.6], look: [0.2, 0.6, 0.1] },
    { at: 0.345, pos: [2.4, 1.5, 3.4], look: [0.1, 0.5, 0.2] },
    { at: 0.36,  pos: [2.1, 1.4, 2.8], look: [0.0, 0.5, 0.1] },
    { at: 0.38,  pos: [1.4, 2.3, 1.4], look: [0, 0.6, -4] },
    // Ch4: "First Waypoints" (LEFT card) — lanterns on RIGHT
    { at: 0.42, pos: [-2, 3, -4],     look: [0, 2.5, -12] },
    { at: 0.47, pos: [-1, 3.2, -8],   look: [0, 3, -12] },
    { at: 0.52, pos: [0, 3, -12],     look: [2, 2.8, -16] },
    // Ch5: "More Light in the Dark" (RIGHT card) — lanterns on LEFT
    { at: 0.57, pos: [2, 3.2, -17],   look: [-2, 3, -21] },
    { at: 0.62, pos: [2, 3, -22],     look: [-1, 2.8, -27] },
    // Ch6: "What I Carry With Me" (LEFT card) — inside the firefly meadow
    { at: 0.67, pos: [3, 2.5, -34],   look: [-3, 2.5, -37] },
    { at: 0.72, pos: [2, 2.5, -37],   look: [-4, 2.5, -39] },
    // Ch7: "A Mark Left Behind" (CENTER) — rise over the award cairn
    { at: 0.77, pos: [-1, 6, -30],    look: [0, 1, -10] },
    // Ch8: "Rising Above" (RIGHT card) — canopy on LEFT
    { at: 0.83, pos: [-3, 8, -15],    look: [-2, 2, 0] },
    { at: 0.88, pos: [-2, 9, -5],     look: [0, 1, 0] },
    // Ch9: "The Journey Continues" (CENTER) — settle back over camp
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
    // sizeAttenuation:false = constant on-screen size. Labels read like clean
    // UI annotations at any distance and can never balloon across the frame.
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: opts.opacity || 0.85, depthWrite: false, sizeAttenuation: false }));
    var sc = (opts.scale || 1.5) * 0.033;
    sp.scale.set(sc * (cvs.width / cvs.height), sc, 1);
    return sp;
  }

  // Soft radial falloff texture, built once and shared by every glow halo and
  // ground pool. Hard-edged additive discs read as flat grey ellipses; a real
  // falloff reads as light.
  var glowTex = null;
  function getGlowTexture() {
    if (glowTex) return glowTex;
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.42)");
    g.addColorStop(0.7, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.minFilter = THREE.LinearFilter;
    return glowTex;
  }

  // Label visibility by real 3D distance: fade OUT when the camera is nearly on
  // top of a label (stops giant blurry text filling the frame) and beyond ~30
  // units (stops every zone's text stacking into one crowded view).
  function distVis(p) {
    var dx = p.x - camera.position.x, dy = p.y - camera.position.y, dz = p.z - camera.position.z;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var nearV = (d - 1.6) / 2.2;
    var farV = (30 - d) / 8;
    if (nearV < 0) nearV = 0; else if (nearV > 1) nearV = 1;
    if (farV < 0) farV = 0; else if (farV > 1) farV = 1;
    return nearV * farV;
  }

  // ======================== Init ========================
  function init() {
    canvas = document.getElementById("creativeCanvas");
    if (!canvas || typeof THREE === "undefined") return false;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0C1210);
    scene.fog = new THREE.Fog(0x0C1210, isMobile ? 28 : 22, isMobile ? 115 : 92);
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(isMobile ? 65 : 55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 8, 44);
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: "high-performance" });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Viewers reported the wood was too dark to read. Exposure is the right
      // lever for that: it scales the whole image before tone mapping, so the
      // campfire stays exactly as dominant relative to everything else. Raising
      // ambient instead is what once flattened this scene into mint daylight.
      renderer.toneMappingExposure = 2.25;
      renderer.shadowMap.enabled = false;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.15));
    raycaster = new THREE.Raycaster(); mouseVec = new THREE.Vector2();

    // Lighting — a DARK wood lit by its own sources.
    //
    // Deliberately low global light. Raising ambient/hemisphere to brighten the
    // scene was tried and reverted: it flattened the forest into uniform mint
    // daylight and erased the night entirely. The brightness has to come from
    // the campfire, the lanterns and the path lamps, so the trail reads as a
    // lit thread through dark trees. Keep these values low.
    // Phones skip the five project-lantern PointLights for performance, so they
    // lose light the desktop has and the wood goes muddy. Give the ambient back
    // just that much — this is compensation, not a brighter look.
    scene.add(new THREE.AmbientLight(0x33573F, isMobile ? 1.6 : 1.3));
    var moon = new THREE.DirectionalLight(0xAABBCC, 1.0);
    moon.position.set(-20, 30, 10);
    scene.add(moon); scene._moon = moon;

    // (The three weak fill PointLights that used to sit here were removed —
    //  they cost the same per-pixel as a lamp light while adding almost no
    //  visible light. That budget now pays for real lights on the path lamps.)

    buildTerrain(); createDirtPath();
    plantForest();
    createCoreLantern();
    createCampCharacters();
    createProjectLanterns();
    createMilestones();
    createFireflies(); createMist();
    createRuins();
    createSky(); createSmoke(); createGroundDetails();
    createPathLamps(); createAmbientFireflies();

    // Bind input listeners once — init() can run again after a full teardown.
    //
    // These MUST live on the scroll container, not the canvas. .creative-scroll
    // is a full-viewport fixed overlay at z-index 1001 with pointer-events:auto
    // (it has to be hit-testable to scroll at all), so it sits above the canvas
    // and swallows every pointer event — canvas-bound listeners never fired,
    // which meant plant-a-tree was silently dead on every device.
    if (!listenersBound) {
      listenersBound = true;
      var surface = document.getElementById("creativeScroll") || canvas;
      surface.addEventListener("mousemove", onMouseMove);
      surface.addEventListener("mousedown", function () { isMouseDown = true; });
      surface.addEventListener("mouseup", function () { isMouseDown = false; });
      surface.addEventListener("click", onClick);
      // Touch stays PASSIVE so the container keeps its native momentum scroll —
      // the journey is driven by scrolling, so stealing touchmove (the old
      // behaviour) made the walk unscrollable on phones. A tree is planted on a
      // deliberate tap instead: little movement, short duration.
      surface.addEventListener("touchstart", onTouchStart, { passive: true });
      surface.addEventListener("touchmove", onTouchMove, { passive: true });
      surface.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("resize", onResize);
    }
    return true;
  }

  // Pointer events that land on real UI (chapter cards, HUD, links) must never
  // plant a tree behind them.
  function isSceneSurface(target) {
    if (!target || !target.closest) return true;
    return !target.closest(".chapter-content, .creative-hud, .creative-dots, a, button");
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
      color: 0x243D28, roughness: 0.95, flatShading: true
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
      color: 0x2B4632, roughness: 1.0, transparent: true, opacity: 0.6
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
    var FLAT = [-Math.PI / 2, 0, 0];
    var plan = [];

    // Entrance to camp (z:42 to z:0) — gentle winding
    for (var pz = 42; pz >= -2; pz -= 1.5) {
      var xWobble = Math.sin(pz * 0.15) * 1.2;
      var radius = 1.2 + Math.sin(pz * 0.3) * 0.3;
      plan.push({ p: [xWobble, terrainHeight(xWobble, pz) + 0.015, pz], r: FLAT, s: [radius, radius, 1] });
    }

    // Widen into the clearing
    for (var ci = 0; ci < 5; ci++) {
      var ca = (ci / 5) * Math.PI - Math.PI / 2;
      var cr = 2 + Math.random() * 1.5;
      plan.push({ p: [Math.cos(ca) * 4, 0.015, Math.sin(ca) * 4 + 2], r: FLAT, s: [cr, cr, 1] });
    }

    // Camp through grove to meadow (z:-2 to z:-32) — zigzag matching lanterns
    for (var gz = -2; gz >= -32; gz -= 1.5) {
      var gxWobble = Math.sin(gz * 0.2) * 2;
      var gradius = 1.0 + Math.sin(gz * 0.25) * 0.2;
      plan.push({ p: [gxWobble, terrainHeight(gxWobble, gz) + 0.015, gz], r: FLAT, s: [gradius, gradius, 1] });
    }

    // Widen into meadow entrance
    for (var mi = 0; mi < 4; mi++) {
      var mr = 1.5 + Math.random();
      plan.push({ p: [-3 + (Math.random() - 0.5) * 4, terrainHeight(-3, -33) + 0.015, -32 - mi * 1], r: FLAT, s: [mr, mr, 1] });
    }

    // ~60 discs, one draw call
    buildInstanced(new THREE.CircleGeometry(1, 6), pathMat, plan);
  }

  function plantForest() {
    var groundDiscMat = new THREE.MeshStandardMaterial({ color: 0x162218, roughness: 1.0 });

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

    // --- 6. HORIZON RING (was billboard planes) — far silhouettes join the
    // same instanced batches as the near forest, so they cost nothing extra ---
    var ringCount = isMobile ? 30 : 60;
    for (var ri = 0; ri < ringCount; ri++) {
      var rAngle = (ri / ringCount) * Math.PI * 2;
      var rDist = 45 + Math.random() * 15;
      treePositions.push({
        x: Math.cos(rAngle) * rDist, z: Math.sin(rAngle) * rDist,
        type: Math.random() > 0.35 ? "pine" : "round", size: "tall", far: true
      });
    }

    // === INSTANCE THE MODELED TREES =========================================
    // Two Kenney Mini Forest pines (baked sage vertex colors, models/forest.js)
    // carry the whole forest in TWO draw calls; per-instance tint adds variety
    // and the far ring is simply tinted darker so depth still reads.
    var F = window.DZ_FOREST;
    var planHigh = [], planRound = [], planDisc = [];
    for (var i = 0; i < treePositions.length; i++) {
      var tp = treePositions[i];
      var x = tp.x, z = tp.z, gY = getGroundY(x, z);
      var isTall = tp.size === "tall";
      var height = tp.far ? (5 + Math.random() * 8) : isTall ? (6 + Math.random() * 4) : (3 + Math.random() * 4);
      var isNear = !tp.far && Math.sqrt(x * x + z * z) < 22;
      var tint = tp.far ? 0.35 + Math.random() * 0.2 : 0.8 + Math.random() * 0.35;
      var item = { x: x, y: gY, z: z, ry: Math.random() * Math.PI * 2, t: tint };
      if (tp.type === "round") { item.s = height * 0.7 / 1.68; planRound.push(item); }
      else { item.s = height / 2.28; planHigh.push(item); }
      if (isNear) {
        var discR = 0.5 + Math.random() * 0.3;
        planDisc.push({ p: [x, gY + 0.01, z], r: [-Math.PI / 2, 0, 0], s: [discR, discR, 1] });
      }
      if (!tp.far) trees.push({ x: x, z: z });
    }
    if (F) {
      buildInstancedProp(F.treeHigh, planHigh);
      buildInstancedProp(F.tree, planRound);
    }
    buildInstanced(new THREE.CircleGeometry(1, 5), groundDiscMat, planDisc);
  }

  // Upload a list of {p,r,s,c} transforms as a single InstancedMesh draw call.
  function buildInstanced(geo, mat, list) {
    if (!list.length) return null;
    var im = new THREE.InstancedMesh(geo, mat, list.length);
    var d = new THREE.Object3D();
    var col = new THREE.Color();
    for (var k = 0; k < list.length; k++) {
      var it = list[k];
      d.position.set(it.p[0], it.p[1], it.p[2]);
      d.rotation.set(it.r[0], it.r[1], it.r[2]);
      d.scale.set(it.s[0], it.s[1], it.s[2]);
      d.updateMatrix();
      im.setMatrixAt(k, d.matrix);
      if (it.c !== undefined) im.setColorAt(k, col.setHex(it.c));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; // one batch spans the whole map
    scene.add(im);
    return im;
  }

  // Decode a baked prop (models/props.js / models/forest.js entry) into a
  // vertex-colored BufferGeometry.
  function propGeometry(def) {
    function bytes(s) {
      var bin = atob(s), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u.buffer;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bytes(def.p)), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(bytes(def.n)), 3));
    var cu = new Uint8Array(bytes(def.c)), cf = new Float32Array(cu.length);
    for (var ci = 0; ci < cu.length; ci++) cf[ci] = cu[ci] / 255;
    g.setAttribute("color", new THREE.BufferAttribute(cf, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(def.i)), 1));
    return g;
  }

  // One InstancedMesh from a baked model: {x,y,z, ry, s|sy+sxz, t} per instance.
  // t is a brightness tint (instanceColor multiplies the baked vertex colors).
  var instPropMat = null;
  function buildInstancedProp(def, list) {
    if (!def || !list.length) return null;
    if (!instPropMat) instPropMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    var im = new THREE.InstancedMesh(propGeometry(def), instPropMat, list.length);
    var d = new THREE.Object3D(), col = new THREE.Color();
    for (var k = 0; k < list.length; k++) {
      var it = list[k];
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(0, it.ry || 0, 0);
      var sy = it.sy || it.s || 1, sxz = it.sxz || it.s || 1;
      d.scale.set(sxz, sy, sxz);
      d.updateMatrix();
      im.setMatrixAt(k, d.matrix);
      im.setColorAt(k, col.setScalar(it.t !== undefined ? it.t : 1));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    scene.add(im);
    return im;
  }

  // ======================== Clearing edge — rock outcrops + meadow cover ========================
  function createRuins() {
    var F = window.DZ_FOREST;
    if (!F) return; // degraded load: scene runs without outcrops/ground cover

    // Rock outcrops ring the camp clearing. (These were stone "ruins" columns —
    // upright grey slabs in a dark wood read as gravestones, which is not the
    // story. Natural outcrops give the clearing its edge without the graveyard.)
    var outcrops = [
      { x: 11.5, z: 3.5, s: 1.7, ry: 0.4 },
      { x: -10, z: -2, s: 1.3, ry: 2.1 },
      { x: 8.5, z: -7, s: 1.9, ry: 4.0 },
      { x: -9, z: 5.5, s: 1.1, ry: 1.2 },
      { x: 12, z: -4.5, s: 2.0, ry: 5.3 },
      { x: -11, z: -7.5, s: 1.0, ry: 3.0 }
    ];
    buildInstancedProp(F.rocksHigh, outcrops.map(function (c) {
      return { x: c.x, y: getGroundY(c.x, c.z) - 0.25, z: c.z, ry: c.ry, sy: c.s * 0.7, sxz: c.s, t: 0.5 + Math.random() * 0.2 };
    }));

    // Meadow ground cover — modeled grass patches + plants (replaces the
    // glowing wildflower specks: dark sage, sits on the ground, reads as turf)
    var planGrass = [], planPlant = [];
    var gCount = isMobile ? 6 : 10, pCount = isMobile ? 6 : 12;
    for (var gi = 0; gi < gCount; gi++) {
      var ga = Math.random() * Math.PI * 2, gr = Math.random() * 7;
      var gx = -3 + Math.cos(ga) * gr, gz = -36 + Math.sin(ga) * gr;
      planGrass.push({ x: gx, y: getGroundY(gx, gz) + 0.02, z: gz, ry: Math.random() * Math.PI * 2, s: 1.5 + Math.random() * 1.5, t: 0.9 + Math.random() * 0.3 });
    }
    for (var pi = 0; pi < pCount; pi++) {
      var pa = Math.random() * Math.PI * 2, pr = 1 + Math.random() * 8;
      var px = -3 + Math.cos(pa) * pr, pz = -36 + Math.sin(pa) * pr;
      planPlant.push({ x: px, y: getGroundY(px, pz), z: pz, ry: Math.random() * Math.PI * 2, s: 1.2 + Math.random() * 1.4, t: 0.85 + Math.random() * 0.4 });
    }
    buildInstancedProp(F.grass, planGrass);
    buildInstancedProp(F.plant, planPlant);
  }

  // ======================== Campsite — modeled tent, campfire, bedroll ========================
  // Camp props are real CC0 models (Kenney Survival Kit) pre-baked to sage
  // vertex colors in models/props.js — no textures, one draw call each.
  function buildProp(def) {
    return new THREE.Mesh(propGeometry(def), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  }

  function createCoreLantern() {
    var gY = 0;
    var PROPS = window.DZ_PROPS;

    // === Canvas tent — a real A-frame model, mouth turned toward the fire ===
    var shelterX = 2.5, shelterZ = -2.5;
    var sgY = getGroundY(shelterX, shelterZ);
    if (PROPS) {
      var tent = buildProp(PROPS.tent);
      tent.position.set(shelterX, sgY, shelterZ);
      tent.rotation.y = Math.atan2(0 - shelterX, 0.5 - shelterZ); // aim the model's front at the campfire
      scene.add(tent);
    }

    // Bedroll inside the tent, lying along its open axis — visible through the
    // mouth from the fire side (the model is an open-ended A-frame)
    var sleepBag = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4A3B2A, roughness: 0.8 }));
    sleepBag.position.set(shelterX - 0.3, sgY + 0.1, shelterZ + 0.35);
    sleepBag.rotation.set(0, 0.88, Math.PI / 2);
    scene.add(sleepBag);

    // === Campfire — modeled stone fire pit with stacked logs ===
    if (PROPS) {
      var firePit = buildProp(PROPS.fire);
      firePit.position.set(0, gY, 0.5);
      firePit.rotation.y = 0.7;
      scene.add(firePit);

      // Log seats pulled up to the fire, across from the tent
      var seat1 = buildProp(PROPS.log);
      seat1.position.set(-1.55, getGroundY(-1.55, 1.35), 1.35);
      seat1.rotation.y = 0.55;
      scene.add(seat1);
      var seat2 = buildProp(PROPS.log);
      seat2.position.set(1.6, getGroundY(1.6, 1.7), 1.7);
      seat2.rotation.y = -0.9;
      seat2.scale.setScalar(0.85);
      scene.add(seat2);
    }

    // Fire light — main warm flicker (bright, wide reach). Intensity is
    // driven every frame in animate(); range is set here.
    var fireLight = new THREE.PointLight(0xFF8C33, 5.2, 30);
    fireLight.position.set(0, gY + 0.8, 0.5);
    scene.add(fireLight);
    scene._fireLight = fireLight;

    // Secondary fill — low angle, warm red tone
    var fireFill = new THREE.PointLight(0xE86420, 2.0, 16);
    fireFill.position.set(0, gY + 0.3, 0.5);
    scene.add(fireFill);
    scene._fireFill = fireFill;

    // Wide ambient bounce — simulates light reflecting off ground/tent
    var fireBounce = new THREE.PointLight(0xCC7733, 1.6, 34);
    fireBounce.position.set(0, gY + 2.5, 0);
    scene.add(fireBounce);
    scene._fireBounce = fireBounce;

    // Flame glow + the pool it throws on the clearing floor — additive, no
    // extra lights. This is what makes the camp read as the brightest place
    // on the walk when you arrive.
    var fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTexture(), color: 0xFFA23C, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    fireGlow.position.set(0, gY + 0.55, 0.5);
    fireGlow.scale.setScalar(2.0);
    scene.add(fireGlow);
    scene._fireGlow = fireGlow;

    var firePool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: getGlowTexture(), color: 0xD9853A, transparent: true, opacity: 0.42,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    firePool.position.set(0, gY + 0.09, 0.5);
    firePool.rotation.x = -Math.PI / 2;
    firePool.scale.setScalar(6.5);
    scene.add(firePool);
    scene._firePool = firePool;

    // (fireUp canopy-glow light removed — every PointLight multiplies the
    // per-pixel shading cost; the bounce light covers this look well enough)

    // Fire particles (embers rising)
    var fireEmbers = [];
    var emberCount = isMobile ? 12 : 16;
    for (var ei = 0; ei < emberCount; ei++) {
      var eColor = [0xFF6B33, 0xFFAA33, 0xFF8833, 0xFFCC55, 0xFF5522][Math.floor(Math.random() * 5)];
      var ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.02 + Math.random() * 0.03, 4, 4),
        new THREE.MeshBasicMaterial({ color: eColor, transparent: true, opacity: 0.8 })
      );
      ember.position.set(0, gY + 0.3, 0.5);
      ember.userData = {
        baseX: (Math.random() - 0.5) * 0.6,
        baseZ: 0.5 + (Math.random() - 0.5) * 0.6,
        speed: 0.5 + Math.random() * 1.5,
        maxH: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.3
      };
      scene.add(ember);
      fireEmbers.push(ember);
    }
    scene._fireEmbers = fireEmbers;

    // === Brand label floats above the campsite ===
    // Brand label — small, off to the side so it doesn't block the campsite
    var brand = makeLabel("//dzian", { fontSize: 22, fontWeight: "700", color: "#A3B18A", scale: 1.2, opacity: 0.5 });
    brand.position.set(-3, gY + 2.2, -2); scene.add(brand); scene._brandLabel = brand;
    var sub = makeLabel("Software Developer", { fontSize: 11, fontWeight: "400", color: "rgba(163,177,138,0.35)", scale: 1.0, opacity: 0.3 });
    sub.position.set(-3, gY + 1.7, -2); scene.add(sub); scene._brandSub = sub;
  }

  // ======================== Visitor-name carving near the camp ========================
  function createCampCharacters() {
    var woodMat = new THREE.MeshStandardMaterial({ color: 0x3B2A1A, roughness: 0.9 });

    // ---- Visitor-name carving on a wooden marker near the camp ----
    try {
      var visitor = localStorage.getItem("visitorName");
      if (visitor) {
        var mx = -3.2, mz = 1.2, mgy = getGroundY(mx, mz);
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6), woodMat);
        post.position.set(mx, mgy + 0.85, mz); scene.add(post);
        var plaque = makeCarving("Kent + " + visitor);
        plaque.position.set(mx, mgy + 1.55, mz + 0.05);
        scene.add(plaque); scene._carving = plaque;
      }
    } catch (e) {}
  }

  // Wood-plaque "carved" label rendered to a canvas texture
  function makeCarving(text) {
    var cvs = document.createElement("canvas");
    cvs.width = 320; cvs.height = 120;
    var c = cvs.getContext("2d");
    c.fillStyle = "#3B2A1A"; c.fillRect(0, 0, 320, 120);
    c.strokeStyle = "rgba(0,0,0,0.45)"; c.lineWidth = 6; c.strokeRect(4, 4, 312, 112);
    c.font = "700 40px 'Inter', system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "rgba(0,0,0,0.5)"; c.fillText(text, 161, 63);
    c.fillStyle = "#A3B18A"; c.fillText(text, 160, 60);
    var tex = new THREE.CanvasTexture(cvs); tex.minFilter = THREE.LinearFilter;
    var plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.41),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    return plane;
  }

  // ======================== Project Lanterns — branch-hung, zigzag ========================
  // ======================== Milestone waypoints — the journey's real markers ========================
  // Career milestones as physical trail markers (education, award, what's next).
  // NO new PointLights here — labels/glows are unlit materials by design.
  function createMilestones() {
    var woodMat = new THREE.MeshStandardMaterial({ color: 0x3B2A1A, roughness: 0.9 });
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.95, flatShading: true });

    function signpost(x, z, plaqueText, labelText, subText) {
      var gY = getGroundY(x, z);
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), woodMat);
      post.position.set(x, gY + 0.75, z);
      scene.add(post);
      var plaque = makeCarving(plaqueText);
      plaque.position.set(x, gY + 1.35, z + 0.06);
      plaque.rotation.y = x > 0 ? -0.25 : 0.25; // angle toward the path
      scene.add(plaque);
      var label = makeLabel(labelText, { fontSize: 16, sub: subText, scale: 1.0, opacity: 0.55 });
      label.position.set(x, gY + 2.1, z);
      scene.add(label);
      wayLabels.push({ sp: label, base: 0.55 });
    }

    // Where the path began — university, at the trail entrance
    signpost(2.3, 38, "WMSU · 2020", "Where the path began", "BS Computer Science");


    // A mark left behind — stone cairn for the national award
    var cx = 2.6, cz = -30, cgY = getGroundY(cx, cz);
    for (var ci = 0; ci < 5; ci++) {
      var cs = 0.28 - ci * 0.045;
      var stone = new THREE.Mesh(new THREE.DodecahedronGeometry(cs, 0), stoneMat);
      stone.position.set(cx + (ci % 2 ? 0.04 : -0.04), cgY + 0.1 + ci * 0.16, cz);
      stone.scale.y = 0.6;
      stone.rotation.set(Math.random(), Math.random(), 0);
      scene.add(stone);
    }
    // The award itself resting on the cairn — a real trophy model (Kenney
    // Starter Kit Basic Scene) baked to firefly gold. Unlit like every other
    // milestone: the lantern light nearby is what catches it.
    var MF = window.DZ_FOREST;
    if (MF) {
      var trophy = buildProp(MF.trophy);
      trophy.position.set(cx, cgY + 0.82, cz);
      trophy.rotation.y = -0.5;
      trophy.scale.setScalar(1.15);
      scene.add(trophy);
    }

    var awardLabel = makeLabel("2025 Productivity Olympics", {
      fontSize: 18, fontWeight: "700", color: "#FFD24A",
      sub: "National Winner — with the VINTAZK team", scale: 1.15, opacity: 0.75
    });
    awardLabel.position.set(cx, cgY + 1.7, cz);
    scene.add(awardLabel);
    wayLabels.push({ sp: awardLabel, base: 0.75 });

    // The next lantern — LUMI, not lit yet (in development)
    var lx = -2.2, lz = -31.5, lgY = getGroundY(lx, lz);
    var post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.5, 5), woodMat);
    post2.position.set(lx, lgY + 0.75, lz);
    scene.add(post2);
    var dim = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xE8C87A, transparent: true, opacity: 0.22 })
    );
    dim.position.set(lx, lgY + 1.55, lz);
    scene.add(dim);
    var lumiLabel = makeLabel("LUMI", {
      fontSize: 16, color: "#E8C87A",
      sub: "the next lantern — in development", scale: 0.95, opacity: 0.5
    });
    lumiLabel.position.set(lx, lgY + 2.05, lz);
    scene.add(lumiLabel);
    wayLabels.push({ sp: lumiLabel, base: 0.5 });
  }

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

    // Host trees — the same instanced Kenney pine as the rest of the forest
    var HF = window.DZ_FOREST;
    if (HF) {
      buildInstancedProp(HF.treeHigh, positions.map(function (p) {
        return { x: p.hostX, y: getGroundY(p.hostX, p.z), z: p.z, ry: Math.random() * Math.PI * 2, s: (5.5 + Math.random() * 1.5) / 2.28, t: 0.85 + Math.random() * 0.25 };
      }));
    }

    PROJECTS.forEach(function (proj, i) {
      var p = positions[i];
      var gY = getGroundY(p.hostX, p.z);
      var treeH = 5 + Math.random() * 2;
      var branchY = gY + treeH * 0.7;

      // Branch extending from the host tree toward the path
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

      // Warm point light (intensity is driven per-frame in animate()).
      // Phones skip it: 5 lantern lights on top of the campfire and lamps is
      // the single biggest per-pixel cost in the scene, and the additive halo
      // below sells the same look for free.
      var light = null;
      if (!isMobile) {
        light = new THREE.PointLight(proj.color, 1.6, 17);
        light.position.set(p.x, globeY, p.z);
        scene.add(light);
      }

      // Soft additive halo so the lantern reads as a bright source, not just a
      // lit globe. Free — no extra light. It tracks the globe's sway below.
      var lanternHalo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(), color: proj.color, transparent: true,
        opacity: isMobile ? 0.72 : 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      lanternHalo.position.set(p.x, globeY, p.z);
      lanternHalo.scale.setScalar(1.6);
      scene.add(lanternHalo);

      // Label
      var label = makeLabel(proj.name, {
        fontSize: 20, fontWeight: "600", color: "#DAD7CD",
        sub: proj.sub, scale: 1.4, opacity: 0.01
      });
      label.position.set(p.x, globeY + 1, p.z);
      scene.add(label);

      lanterns.push({
        mesh: globe, light: light, label: label, halo: lanternHalo,
        baseY: globeY, x: p.x, z: p.z, chapter: p.chapter
      });
    });
  }

  // ======================== Fireflies (Tech) ========================
  function createFireflies() {
    var ffColors = [0xFFE066, 0xFFD24A, 0xC8E07A, 0xA9C46C, 0xE8C87A];
    // Camera at ch6: pos (0, 3.2, -22) looking at (-6, 3, -28)
    // Place fireflies IN FRONT of camera — between camera and lookAt point, spread to sides
    // Two rows: close row and far row so they don't all stack

    // Fireflies in the meadow (center -3, -36) at eye level
    TECH.forEach(function (name, i) {
      var col = i % 4;
      var row = Math.floor(i / 4);
      // Wide, deep spread — rows 5.5 apart so the far rows sit in the distance
      // fade instead of stacking legibly on top of the near row
      var x = -8 + col * 4.2 + (Math.random() - 0.5) * 1.2;
      var z = -32 - row * 5.5 + (Math.random() - 0.5) * 1.5;
      var y = 2 + row * 1.0 + Math.random() * 1.8; // eye level, not above canopy

      var color = ffColors[i % ffColors.length];
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, fog: false }));
      mesh.position.set(x, y, z); scene.add(mesh);
      var light = null;
      // No per-firefly PointLights — the emissive-looking MeshBasic spheres
      // read as glowing on their own, and lights here were pure GPU cost.
      var label = makeLabel(name, { fontSize: 20, fontWeight: "600", color: "#DAD7CD", scale: 1.4, opacity: 0.01 });
      label.position.set(x, y + 0.8, z); scene.add(label);
      fireflies.push({
        mesh: mesh, light: light, label: label, baseX: x, baseY: y, baseZ: z, color: color,
        phase: Math.random() * Math.PI * 2, speed: 0.12 + Math.random() * 0.25,
        ampX: 0.15 + Math.random() * 0.35, ampY: 0.1 + Math.random() * 0.2, ampZ: 0.15 + Math.random() * 0.35
      });
    });
  }

  // ======================== Mist ========================
  function createMist() {
    var n = isMobile ? 180 : 260, pos = new Float32Array(n * 3);
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

    // Shared materials + geometry — never allocate these inside the loop
    var postMat = new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9 });
    // fog:false on every glow below. Fog mixes a fragment toward the fog colour,
    // so a fogged additive glow turns into a flat grey disc floating in the
    // mist instead of warm light — light sources must not be fogged.
    var glowMat = new THREE.MeshBasicMaterial({ color: 0xFFF0C4, transparent: true, opacity: 0.95, fog: false });
    // Soft additive spill — a halo around the bulb and a pool on the trail.
    // Free (no lights) and it is most of what makes the path read as lit.
    var haloMat = new THREE.SpriteMaterial({
      map: getGlowTexture(), color: 0xFFD98A, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var poolMat = new THREE.MeshBasicMaterial({
      map: getGlowTexture(), color: 0xE0B96A, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    var postGeo = new THREE.CylinderGeometry(0.03, 0.04, 2, 4);
    var glowGeo = new THREE.SphereGeometry(0.13, 8, 8);
    var poolGeo = new THREE.PlaneGeometry(1, 1);

    lampPositions.slice(0, PATH_LAMP_COUNT).forEach(function (lp, li) {
      var gY = getGroundY(lp.x, lp.z);

      var post = new THREE.Mesh(postGeo, postMat);
      post.position.set(lp.x, gY + 1, lp.z);
      scene.add(post);

      var glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(lp.x, gY + 2.2, lp.z);
      scene.add(glow);

      var halo = new THREE.Sprite(haloMat);
      halo.position.set(lp.x, gY + 2.2, lp.z);
      halo.scale.setScalar(1.7);
      scene.add(halo);

      // Warm pool of light thrown on the trail under each lamp. Kept modest —
      // a wide flat disc cuts through the uneven ground and reads as a decal.
      var pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.set(lp.x, gY + 0.12, lp.z);
      pool.rotation.x = -Math.PI / 2;
      pool.scale.setScalar(3.4 + Math.random() * 0.6);
      scene.add(pool);

      // Every lamp is a real light now. The three weak ambient fills were
      // removed to pay for these — same per-pixel cost, far better result,
      // and the light lands where the walk actually goes.
      var light = new THREE.PointLight(0xF0C878, 2.4, 20);
      light.position.set(lp.x, gY + 2.4, lp.z);
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
      var color = [0xFFE066, 0xC8E07A, 0xA9C46C, 0xE8C87A][Math.floor(Math.random() * 4)];

      var mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7, fog: false })
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);

      // No lights on ambient fireflies — spheres alone read as glow
      var light = null;

      ambientFFs.push({
        mesh: mesh, light: light,
        baseX: x, baseY: y, baseZ: z,
        phase: Math.random() * Math.PI * 2,
        speed: 0.1 + Math.random() * 0.3,
        ampX: 0.15 + Math.random() * 0.4,
        ampY: 0.1 + Math.random() * 0.25,
        ampZ: 0.15 + Math.random() * 0.4
      });
    }
    scene._ambientFFs = ambientFFs;
  }

  // ======================== Sky — Stars + Moon ========================
  // ======================== Billboard Trees — 2D silhouettes on the horizon ========================
  // (Billboard horizon trees removed — the far ring now rides in the same
  //  instanced tree batches as the near forest; see plantForest.)

  function createSky() {
    // Procedural moonlit sky over the flat #0C1210 background.
    //
    // A photographic panorama (Kenney CC0 Skyboxes "night") was tried here and
    // removed on purpose: scene.background is tone-mapped like everything else
    // (ACES at exposure 1.8 — about a 3x linear gain), so at full strength it
    // rendered as a near-white haze behind the treeline, and darkened enough to
    // sit right it collapsed into swirling contour bands, because a near-black
    // sky has almost no 8-bit levels left to hold a gradient. Points and a flat
    // moon are smooth by construction, cost nothing, weigh 0 KB, and land
    // exactly on the palette. Don't reintroduce a photo sky here.
    //
    // Everything below is unlit + fog:false — the sky sits far past the fog far
    // plane (75), so fogged materials would vanish entirely.
    var starCount = isMobile ? 200 : 380;
    var sPos = new Float32Array(starCount * 3);
    var sCol = new Float32Array(starCount * 3);
    var STAR_TINTS = [0xDAD7CD, 0xE8C87A, 0xA3B18A, 0xEDEAE0];
    var tint = new THREE.Color(), v = new THREE.Vector3();
    for (var i = 0; i < starCount; i++) {
      do { // upper hemisphere only — no stars under the horizon
        v.set(Math.random() * 2 - 1, Math.random() * 0.95 + 0.05, Math.random() * 2 - 1);
      } while (v.lengthSq() > 1 || v.lengthSq() < 0.04);
      v.normalize().multiplyScalar(110);
      sPos[i * 3] = v.x; sPos[i * 3 + 1] = v.y + 6; sPos[i * 3 + 2] = v.z;
      tint.setHex(STAR_TINTS[i % STAR_TINTS.length]);
      var b = 0.3 + Math.random() * 0.7; // varied magnitudes read as depth
      sCol[i * 3] = tint.r * b; sCol[i * 3 + 1] = tint.g * b; sCol[i * 3 + 2] = tint.b * b;
    }
    var sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
    // Textured so stars are soft round points — an untextured PointsMaterial
    // draws hard white SQUARES, which is what they looked like up close.
    scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: true, vertexColors: true,
      map: getGlowTexture(), blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.9, depthWrite: false, fog: false
    })));

    // The moon sits in the direction the moon DirectionalLight comes from
    // (-20, 30, 10), so the light through the trees reads as coming from the
    // moon you can actually see.
    var dir = new THREE.Vector3(-20, 30, 10).normalize().multiplyScalar(105);
    var halo = new THREE.Mesh(
      new THREE.CircleGeometry(11, 24),
      new THREE.MeshBasicMaterial({ color: 0x9FB0A6, transparent: true, opacity: 0.10, depthWrite: false, fog: false })
    );
    halo.position.copy(dir).multiplyScalar(1.02); // behind the disc so it draws first
    halo.lookAt(0, 0, 0);
    scene.add(halo);
    var moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xE9EEDF, transparent: true, opacity: 0.92, depthWrite: false, fog: false })
    );
    moonDisc.position.copy(dir);
    moonDisc.lookAt(0, 0, 0);
    scene.add(moonDisc);
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
    // All modeled scatter (Mini Forest stones/rocks/plants + Survival Kit
    // logs), one InstancedMesh per model — 5 draw calls for every ground prop
    var F = window.DZ_FOREST, P = window.DZ_PROPS;
    if (!F) return;

    function scatter(count, dMin, dMax, make) {
      var out = [];
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var d = dMin + Math.random() * (dMax - dMin);
        var x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (x * x + z * z < 196) continue; // keep the camp clearing open
        out.push(make(x, z));
      }
      return out;
    }

    buildInstancedProp(F.stones, scatter(isMobile ? 12 : 22, 15, 38, function (x, z) {
      return { x: x, y: getGroundY(x, z), z: z, ry: Math.random() * Math.PI * 2, s: 0.5 + Math.random() * 0.7, t: 0.7 + Math.random() * 0.4 };
    }));
    buildInstancedProp(F.rocksLow, scatter(isMobile ? 5 : 9, 17, 40, function (x, z) {
      return { x: x, y: getGroundY(x, z), z: z, ry: Math.random() * Math.PI * 2, s: 1.0 + Math.random() * 1.2, t: 0.7 + Math.random() * 0.4 };
    }));
    buildInstancedProp(F.rocksHigh, scatter(isMobile ? 2 : 4, 24, 44, function (x, z) {
      return { x: x, y: getGroundY(x, z), z: z, ry: Math.random() * Math.PI * 2, s: 1.4 + Math.random() * 1.2, t: 0.6 + Math.random() * 0.35 };
    }));
    buildInstancedProp(F.plant, scatter(isMobile ? 10 : 20, 15, 36, function (x, z) {
      return { x: x, y: getGroundY(x, z), z: z, ry: Math.random() * Math.PI * 2, s: 1.4 + Math.random() * 1.8, t: 0.7 + Math.random() * 0.45 };
    }));
    if (P) {
      buildInstancedProp(P.log, scatter(isMobile ? 4 : 6, 15, 32, function (x, z) {
        return { x: x, y: getGroundY(x, z), z: z, ry: Math.random() * Math.PI * 2, s: 1.2 + Math.random() * 0.9, t: 0.8 + Math.random() * 0.3 };
      }));
    }
  }

  // ======================== Pond ========================
  // ======================== Spawn ========================
  function spawnFirefly(x, y, z) {
    var color = [0xFFE066, 0xC8E07A, 0xA9C46C, 0xE8C87A][Math.floor(Math.random() * 4)];
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, fog: false }));
    mesh.position.set(x, y, z);
    mesh.userData = { vx: (Math.random() - 0.5) * 0.04, vy: 0.02 + Math.random() * 0.03, vz: (Math.random() - 0.5) * 0.04, life: 1.0, decay: 0.003 + Math.random() * 0.003 };
    scene.add(mesh); spawned.push(mesh);
    if (spawned.length > MAX_SPAWNED) { var old = spawned.shift(); scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
    for (var i = 0; i < 4; i++) {
      var p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8, fog: false }));
      p.position.set(x, y, z);
      var a = Math.random() * Math.PI * 2, spd = 0.02 + Math.random() * 0.04;
      p.userData = { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + 0.01, vz: (Math.random() - 0.5) * spd, life: 1.0, decay: 0.03 + Math.random() * 0.02 };
      scene.add(p); trails.push(p);
      if (trails.length > MAX_TRAILS) { var ot = trails.shift(); scene.remove(ot); ot.geometry.dispose(); ot.material.dispose(); }
    }
  }

  // ======================== Plant a tree — the signature interaction ========
  // Click the ground and a pine grows there. It persists: come back and your
  // tree is still standing. Planted pines are the same Kenney model as the
  // forest (shared geometry + material — one allocation for all 12).
  var plantGeo = null, plantMat = null;
  function spawnTree(worldX, worldZ, instant, startDelay) {
    // Keep the campsite clear and stay inside the world — r²=25 covers the
    // modeled tent's farthest corner (4.86 from origin) so no pine can grow
    // through the canvas; saved trees inside the band are dropped on restore
    if (worldX * worldX + worldZ * worldZ < 25) return null;
    if (Math.abs(worldX) > 50 || Math.abs(worldZ) > 52) return null;
    var F = window.DZ_FOREST;
    if (!F) return null;

    if (!plantGeo) {
      plantGeo = propGeometry(F.tree);
      plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    }

    var gY = getGroundY(worldX, worldZ);
    var g = new THREE.Group();
    var h = 2.6 + Math.random() * 1.6;
    var tree = new THREE.Mesh(plantGeo, plantMat);
    tree.scale.setScalar(h / 1.68);
    g.add(tree);

    g.position.set(worldX, gY, worldZ);
    g.rotation.y = Math.random() * Math.PI * 2;
    g.scale.setScalar(instant ? 1 : 0.001);
    scene.add(g);

    plantedTrees.push({
      group: g,
      grow: instant ? 1 : 0,
      delay: startDelay || 0,
      x: worldX, z: worldZ
    });
    if (plantedTrees.length > MAX_TREES) {
      var old = plantedTrees.shift();
      scene.remove(old.group); // geometry is shared (plantGeo) — never dispose per-tree
    }
    return g;
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
    if (!isSceneSurface(e.target)) return; // clicked a card, the HUD or a link
    var wp = getWorldPos(e.clientX, e.clientY);
    var planted = spawnTree(wp.x, wp.z, false, 0);
    if (planted) {
      saveTrees();
      // a couple of fireflies rise from the fresh sapling
      spawnFirefly(wp.x, 1.2, wp.z);
      spawnFirefly(wp.x + 0.3, 1.6, wp.z - 0.2);
    } else {
      spawnFirefly(wp.x, wp.y, wp.z); // clicked the camp/sky — just sparkle
    }
    if (window.playSound) playSound("click");
  }
  // Tap = plant, drag = walk. Nothing here calls preventDefault, so the scroll
  // container keeps native momentum scrolling on phones.
  var tapX = 0, tapY = 0, tapAt = 0, tapMoved = false;
  function onTouchStart(e) {
    var t = e.touches[0];
    tapX = t.clientX; tapY = t.clientY; tapAt = Date.now(); tapMoved = false;
    mouse.ndcX = (t.clientX / window.innerWidth) * 2 - 1;
    mouse.ndcY = -(t.clientY / window.innerHeight) * 2 + 1;
  }
  function onTouchMove(e) {
    var t = e.touches[0];
    if (Math.abs(t.clientX - tapX) > 10 || Math.abs(t.clientY - tapY) > 10) tapMoved = true;
    mouse.ndcX = (t.clientX / window.innerWidth) * 2 - 1;
    mouse.ndcY = -(t.clientY / window.innerHeight) * 2 + 1;
  }
  function onTouchEnd(e) {
    isMouseDown = false;
    if (tapMoved || Date.now() - tapAt > 450) return;      // that was a scroll
    if (!isSceneSurface(e.target)) return;                  // tapped the UI
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var wp = getWorldPos(t.clientX, t.clientY);
    if (spawnTree(wp.x, wp.z, false, 0)) {
      saveTrees();
      spawnFirefly(wp.x, 1.2, wp.z);
      spawnFirefly(wp.x + 0.3, 1.6, wp.z - 0.2);
    } else {
      spawnFirefly(wp.x, wp.y, wp.z);
    }
    if (window.playSound) playSound("click");
  }
  function onResize() { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(function () { if (!camera || !renderer) return; camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }, 100); }
  function updateScroll() {
    if (!scrollEl) scrollEl = document.getElementById("creativeScroll");
    if (!scrollEl) return;
    var top = scrollEl.scrollTop, max = scrollEl.scrollHeight - scrollEl.clientHeight;
    scrollProgress = max > 0 ? top / max : 0;
    scrollVelocity = Math.abs(scrollProgress - lastScrollProgress);
    lastScrollProgress = scrollProgress;
  }

  // ======================== Animate ========================
  function animate() {
    if (!isActive) return;
    animationId = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    var frame = Math.floor(t * 60) | 0;

    // Adaptive quality — sample real fps; shed load in steps if it can't keep up
    if (perfTier < 2) {
      perfFrames++;
      if (!perfStart) perfStart = t;
      if (t - perfStart > 3) {
        var fps = perfFrames / (t - perfStart);
        perfFrames = 0; perfStart = t;
        if (fps < 34) {
          perfTier++;
          if (perfTier === 1) {
            renderer.setPixelRatio(1.0);
            if (scene._mist) scene._mist.visible = false;
          } else {
            renderer.setPixelRatio(0.85);
          }
        } else if (fps > 50) {
          perfTier = 2; // comfortably fast — stop sampling
        }
      }
    }
    // Pre-compute common trig values used across multiple loops
    var sinT2 = Math.sin(t * 2), sinT3 = Math.sin(t * 3), sinT4 = Math.sin(t * 4);
    var sinT5 = Math.sin(t * 5), sinT6 = Math.sin(t * 6), sinT8 = Math.sin(t * 8);
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

    // (The per-chapter fill-light ramp lived here. The three fill PointLights
    //  it drove were removed in favour of real lights on the path lamps, so
    //  there is nothing left to ramp.)
    // Moon rises through the walk — stays soft on purpose so the campfire and
    // lamps remain the brightest things in frame
    if (scene._moon) scene._moon.intensity = (isMobile ? 0.78 : 0.66) + scrollProgress * 0.4;

    // Campfire — flickering light + rising embers
    // Campfire visible while near the campsite (scroll 0.15 to 0.50), then fades but never fully
    // Campfire: ramp up as you approach, full during camp chapters, gentle fade but never off
    var cAmp = scrollProgress < 0.20 ? Math.min(1, scrollProgress / 0.10) : (scrollProgress < 0.42 ? 1.0 : Math.max(0.15, 1 - (scrollProgress - 0.42) * 0.8));
    // These intensities are the fire's real output — they OVERWRITE whatever
    // the PointLights were constructed with, so tune the campfire here.
    if (scene._fireLight) {
      var flicker = 5.2 + sinT8 * 1.1 + Math.sin(t * 13) * 0.5 + Math.sin(t * 21) * 0.25;
      scene._fireLight.intensity = flicker * cAmp;
      var colorShift = sinT3 * 0.5 + 0.5;
      scene._fireLight.color.setRGB(1.0, 0.45 + colorShift * 0.15, 0.15 + colorShift * 0.1);
    }
    if (scene._fireFill) {
      scene._fireFill.intensity = (2.0 + sinT6 * 0.5) * cAmp;
      scene._fireFill.color.setRGB(0.9, 0.35 + sinT2 * 0.1, 0.1);
    }
    if (scene._fireBounce) {
      scene._fireBounce.intensity = (1.6 + sinT4 * 0.35) * cAmp;
    }
    // The unlit fire glow + floor pool breathe with the same flicker, so the
    // free spill and the real light stay in sync
    if (scene._fireGlow) {
      var fg = (0.7 + sinT8 * 0.13 + Math.sin(t * 13) * 0.06) * cAmp;
      scene._fireGlow.material.opacity = fg;
      scene._fireGlow.scale.setScalar(2.0 + sinT8 * 0.18);
    }
    if (scene._firePool) {
      scene._firePool.material.opacity = (0.42 + sinT6 * 0.07) * cAmp;
    }
    if (scene._fireUp) {
      scene._fireUp.intensity = (0.4 + sinT5 * 0.15) * cAmp;
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
    // Forest mode: pillars/archway are static; no magic or characters to animate here.

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

    // (Canopy wind sway removed with the modeled forest — the instanced tree
    //  batches stay static, saving the per-frame matrix re-upload entirely.)

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
      if (lan.light) lan.light.position.set(lan.mesh.position.x, lan.baseY + bobY, lan.z);
      lan.label.position.set(lan.mesh.position.x, lan.baseY + bobY + 0.8, lan.z);
      if (lan.halo) lan.halo.position.set(lan.mesh.position.x, lan.baseY + bobY, lan.z);

      // Proximity: how close is scrollProgress to this lantern's chapter?
      var dist = Math.abs(scrollProgress - (lan.chapter || 0.5));
      var near = Math.max(0, 1 - dist * 8);

      var revealNear = Math.max(near, canopyReveal);
      // Lantern output — like the campfire, this overwrites the constructed
      // intensity, so brightness for the project lanterns is tuned here
      var tG = lerp(0.35, 1.8, revealNear), tL = lerp(1.1, 3.2, revealNear);
      var tO = lerp(0.0, 0.95, revealNear) * distVis(lan.label.position), tS = lerp(0.8, 1.3, revealNear);
      lan.mesh.material.emissiveIntensity += (tG - lan.mesh.material.emissiveIntensity) * 0.03;
      if (lan.light) lan.light.intensity += (tL - lan.light.intensity) * 0.03;
      // Fade out faster than in — a label you've walked past must not linger huge
      var oRate = tO < lan.label.material.opacity ? 0.09 : 0.025;
      lan.label.material.opacity += (tO - lan.label.material.opacity) * oRate;
      lan.mesh.scale.setScalar(lan.mesh.scale.x + (tS - lan.mesh.scale.x) * 0.03);
      // Flicker the light subtly
      if (lan.light) lan.light.intensity *= 0.95 + (sinT6 + Math.sin(li * 2) * 0.5) * 0.05;
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
      var fLO = lerp(0.0, 0.9, techProximity) * distVis(ff.label.position);
      var fS = lerp(0.3, 1.8, techProximity);
      ff.mesh.material.opacity = fO;
      if (ff.light) ff.light.intensity = fL;
      ff.label.material.opacity = fLO;
      ff.mesh.scale.setScalar(fS);
      // Flicker
      if (techProximity > 0.1) ff.mesh.material.opacity *= 0.85 + (sinT3 + Math.sin(fi * 2.5) * 0.5) * 0.15;
    }

    // Waypoint labels (signposts, award cairn, LUMI) — pure distance fade so a
    // marker you're standing on never fills the frame (every 2nd frame)
    if (frame % 2 === 0) {
      for (var wli = 0; wli < wayLabels.length; wli++) {
        var wl = wayLabels[wli];
        wl.sp.material.opacity = wl.base * distVis(wl.sp.position);
      }
    }

    // Ambient fireflies wander and flicker (every 2nd frame, staggered from canopy)
    if (scene._ambientFFs && frame % 2 === 1) {
      for (var ai = 0; ai < scene._ambientFFs.length; ai++) {
        var af = scene._ambientFFs[ai];
        var ax = af.baseX + Math.sin(t * af.speed + af.phase) * af.ampX;
        var ay = af.baseY + Math.cos(t * af.speed * 0.6 + af.phase) * af.ampY;
        var az = af.baseZ + Math.sin(t * af.speed * 0.4 + af.phase * 2) * af.ampZ;
        af.mesh.position.set(ax, ay, az);
        if (af.light) af.light.position.set(ax, ay, az);
        var affFlicker = sinT4 + Math.sin(ai * 2.5) * 0.5;
        af.mesh.material.opacity = 0.4 + affFlicker * 0.35;
        if (af.light) af.light.intensity = 0.1 + affFlicker * 0.1;
      }
    }

    // (Star field removed — the sky panorama has its own stars, and animating
    //  them cost a per-frame material write for something nobody could see.)

    // Smoke rises — wind drift + dispersal (every 2nd frame)
    var windX = Math.sin(t * 0.3) * 0.4;
    var windZ = Math.cos(t * 0.2) * 0.2;
    if (scene._smoke && frame % 2 === 0) {
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





    // Mist (every 3rd frame)
    if (scene._mist && frame % 3 === 2) { scene._mist.rotation.y = t * 0.002; scene._mist.position.y = Math.sin(t * 0.1) * 0.2; }

    // (Horizon billboards are pre-aimed at the world centre at build time —
    //  no per-frame re-facing loop needed.)

    // Planted trees grow in — ease-out with a small overshoot, like a sprout
    for (var pti = 0; pti < plantedTrees.length; pti++) {
      var pt = plantedTrees[pti];
      if (pt.grow >= 1) continue;
      if (pt.delay > 0) { pt.delay -= 1 / 60; continue; }
      pt.grow = Math.min(1, pt.grow + 1 / 90); // ~1.5s
      var gpr = pt.grow;
      var overshoot = 1 + Math.sin(gpr * Math.PI) * 0.12 * (1 - gpr);
      var eased = 1 - Math.pow(1 - gpr, 3);
      pt.group.scale.setScalar(Math.max(0.001, eased * overshoot));
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

    // (Chapter-crossing bursts and velocity-spawned fireflies removed — the
    //  ambient fireflies carry the atmosphere; particles now appear only when
    //  the visitor plants a tree. Quieter forest, clearer signature moment.)

    var shapeCount = lanterns.length + fireflies.length + spawned.length;
    if (shapeCount !== lastShapeCount) { canvas.setAttribute("data-shapes", shapeCount); lastShapeCount = shapeCount; }
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
    for (var k = plantedTrees.length - 1; k >= 0; k--) {
      scene.remove(plantedTrees[k].group);
    }
    plantedTrees = [];
    // Shared planted-tree geometry/material are disposed by the scene teardown
    // traverse in stop(); reset so the next entry rebuilds them fresh
    if (plantGeo) { plantGeo.dispose(); plantGeo = null; }
    if (plantMat) { plantMat.dispose(); plantMat = null; }
    instPropMat = null;
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
      setTimeout(restoreTrees, 500);
      // Try to auto-play audio immediately, retry on first interaction if blocked
      initAudio();
      var audioRetry = function () {
        if (forestAudio && forestAudio.paused) {
          forestAudio.play().catch(function () {});
        }
        document.removeEventListener("click", audioRetry);
        document.removeEventListener("touchstart", audioRetry);
        document.removeEventListener("scroll", audioRetry, { capture: true, passive: true });
      };
      document.addEventListener("click", audioRetry);
      document.addEventListener("touchstart", audioRetry);
      document.addEventListener("scroll", audioRetry, { capture: true, passive: true });
    },
    stop: function () {
      isActive = false; stopAudio();
      if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
      if (canvas) { canvas.style.display = "none"; canvas.style.pointerEvents = "none"; }
      saveTrees();
      cleanup();
      // Full teardown — free GPU memory + geometry so code mode stays smooth
      // after visiting the forest. Re-entering rebuilds via init().
      if (scene) {
        scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (var mi = 0; mi < mats.length; mi++) {
              if (mats[mi].map) mats[mi].map.dispose();
              mats[mi].dispose();
            }
          }
        });
        // scene.background is not part of the traverse — free it explicitly
        if (scene.background && scene.background.isTexture) scene.background.dispose();
        scene.background = null;
        if (scene.clear) scene.clear();
        scene = null;
      }
      // Keep the renderer (a canvas can't mint a second GL context) but drop
      // its cached render lists so the freed scene isn't retained.
      if (renderer && renderer.renderLists) renderer.renderLists.dispose();
      camera = null; clock = null;
      trees = []; lanterns = []; fireflies = []; wayLabels = [];
      perfFrames = 0; perfStart = 0; perfTier = 0;
    },
    isRunning: function () { return isActive; }
  };
})();
