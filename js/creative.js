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
  var PATH_LAMP_COUNT = isMobile ? 5 : 8;
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
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: "high-performance" });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.8;
      renderer.shadowMap.enabled = false;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.15));
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

    buildTerrain(); createDirtPath();
    plantForest();
    createCoreLantern();
    createCampCharacters();
    createProjectLanterns();
    createMilestones();
    createFireflies(); createMist();
    createRuins();
    createBillboardTrees(); createSky(); createSmoke(); createGroundDetails();
    createPathLamps(); createAmbientFireflies();

    // Bind input listeners once — init() can run again after a full teardown
    if (!listenersBound) {
      listenersBound = true;
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mousedown", function () { isMouseDown = true; });
      canvas.addEventListener("mouseup", function () { isMouseDown = false; });
      canvas.addEventListener("click", onClick);
      canvas.addEventListener("touchstart", onTouch, { passive: false });
      canvas.addEventListener("touchmove", onTouchDrag, { passive: false });
      canvas.addEventListener("touchend", function () { isMouseDown = false; });
      window.addEventListener("resize", onResize);
    }
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
    // Colour variety now rides on per-instance colour, so the forest needs only
    // one bark material and one leaf material (built below), not a pool.
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

    // === PLAN ALL TREES, THEN DRAW EACH SHAPE CLASS IN ONE CALL =============
    // Every trunk/cone/sphere used to be its own Mesh (hundreds of draw calls).
    // We now record each piece as a transform and upload them as InstancedMesh
    // batches: unit-sized base geometries, per-instance scale reproduces the
    // original dimensions exactly, per-instance colour keeps the palette.
    var planTrunk = [], planFlare = [], planDisc = [];
    var planCone = [], planSphere = [];
    var planSway = [];   // near canopies that breathe — kept in their own batch
                         // so the per-frame matrix upload stays tiny

    for (var i = 0; i < treePositions.length; i++) {
      var tp = treePositions[i];
      var x = tp.x, z = tp.z;
      var gY = getGroundY(x, z);
      var trunkColor = TRUNK_COLORS[i % TRUNK_COLORS.length];

      var distFromCenter = Math.sqrt(x * x + z * z);
      var isNear = distFromCenter < 22;
      var isFar = distFromCenter > 35;

      var isTall = tp.size === "tall";
      var height = isTall ? (6 + Math.random() * 4) : (3 + Math.random() * 4);
      var trunkH = height * (0.4 + Math.random() * 0.15);
      var canopyH = height * (0.5 + Math.random() * 0.2);
      var canopyR = isTall ? (1.5 + Math.random() * 2) : (1 + Math.random() * 1.5);
      var trunkR = isTall ? (0.12 + Math.random() * 0.15) : (0.08 + Math.random() * 0.1);
      var leanX = (Math.random() - 0.5) * 0.06;
      var leanZ = (Math.random() - 0.5) * 0.06;

      planTrunk.push({ p: [x, gY + trunkH / 2, z], r: [leanX, 0, leanZ], s: [trunkR, trunkH, trunkR], c: trunkColor });

      if (isNear) {
        planFlare.push({ p: [x, gY + trunkH * 0.06, z], r: [0, 0, 0], s: [trunkR, trunkH * 0.12, trunkR], c: trunkColor });
        var discR = trunkR * 2.5 + 0.1;
        planDisc.push({ p: [x, gY + 0.01, z], r: [-Math.PI / 2, 0, 0], s: [discR, discR, 1] });
      }

      if (tp.type === "pine") {
        var layers = isFar ? 1 : (isMobile ? 2 : 3);
        for (var j = 0; j < layers; j++) {
          var lr = canopyR * (1 - j * 0.2);
          var lh = canopyH * (0.5 + j * 0.1);
          var item = {
            p: [x, gY + trunkH + lh * 0.3 + j * canopyH * 0.22, z],
            r: [leanX, Math.random() * Math.PI, leanZ],
            s: [lr, lh, lr],
            c: CANOPY_COLORS[(i + j) % CANOPY_COLORS.length]
          };
          if (isNear && j === 0) { item.phase = Math.random() * Math.PI * 2; planSway.push(item); }
          else planCone.push(item);
        }
      } else if (tp.type === "round") {
        var count = isFar ? 1 : (isMobile ? 2 : 3);
        for (var j2 = 0; j2 < count; j2++) {
          var sr = canopyR * (isFar ? 0.6 : (0.4 + Math.random() * 0.3));
          var sx = isFar ? 1 : (0.8 + Math.random() * 0.3);
          var sy = isFar ? 1 : (0.6 + Math.random() * 0.3);
          var sz = isFar ? 1 : (0.8 + Math.random() * 0.3);
          planSphere.push({
            p: [
              x + (isFar ? 0 : (Math.random() - 0.5) * canopyR * 0.5),
              gY + trunkH + sr * 0.3 + j2 * sr * 0.4,
              z + (isFar ? 0 : (Math.random() - 0.5) * canopyR * 0.5)
            ],
            r: [0, 0, 0],
            s: [sr * sx, sr * sy, sr * sz],
            c: CANOPY_COLORS[(i + j2) % CANOPY_COLORS.length]
          });
        }
      } else {
        var slimH = canopyH * 1.3;
        var slimR = canopyR * 0.3;
        var slim = {
          p: [x, gY + trunkH + slimH * 0.4, z],
          r: [leanX, Math.random() * Math.PI, leanZ],
          s: [slimR, slimH, slimR],
          c: CANOPY_COLORS[i % CANOPY_COLORS.length]
        };
        if (isNear) { slim.phase = Math.random() * Math.PI * 2; planSway.push(slim); }
        else planCone.push(slim);
      }
      trees.push({ x: x, z: z });
    }

    // Unit base geometries — per-instance scale gives back the original sizes
    var trunkGeo  = new THREE.CylinderGeometry(0.5, 1.1, 1, segs);
    var flareGeo  = new THREE.CylinderGeometry(1.1, 1.6, 1, segs);
    var discGeo   = new THREE.CircleGeometry(1, 5);
    var coneGeo   = new THREE.ConeGeometry(1, 1, coneSegs);
    var sphereGeo = new THREE.SphereGeometry(1, sphereSegs, sphereSegs - 1);

    var barkMat   = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
    var leafMat   = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, flatShading: true });

    buildInstanced(trunkGeo,  barkMat,       planTrunk);
    buildInstanced(flareGeo,  barkMat,       planFlare);
    buildInstanced(discGeo,   groundDiscMat, planDisc);
    buildInstanced(coneGeo,   leafMat,       planCone);
    buildInstanced(sphereGeo, leafMat,       planSphere);

    // Swaying canopies live in one small batch we can re-upload cheaply
    var swayMesh = buildInstanced(coneGeo, leafMat, planSway);
    scene._sway = swayMesh ? { mesh: swayMesh, items: planSway } : null;

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

  // ======================== Forest ruins — weathered stone pillars + archway ========================
  function createRuins() {
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.9, flatShading: true });
    var vineMat = new THREE.MeshStandardMaterial({ color: 0x3A5A40, roughness: 0.8 });

    // Stone pillars around clearing edge
    var pillarPositions = [
      { x: 10, z: 3, h: 4, lean: 0.05 },
      { x: -9, z: -2, h: 3.5, lean: -0.08 },
      { x: 7, z: -6, h: 4.5, lean: 0.03 },
      { x: -8, z: 5, h: 3, lean: -0.1 },  // broken/shorter
      { x: 11, z: -4, h: 5, lean: 0.02 },
      { x: -10, z: -7, h: 2.5, lean: 0.12 }  // very broken
    ];

    pillarPositions.forEach(function (pp, i) {
      var gY = getGroundY(pp.x, pp.z);
      // Pillar
      var pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, pp.h, 6),
        stoneMat
      );
      pillar.position.set(pp.x, gY + pp.h / 2, pp.z);
      pillar.rotation.set(pp.lean, 0, pp.lean * 0.5);
      scene.add(pillar);

      // Mossy vine wrapping (desktop only)
      if (!isMobile && pp.h > 3) {
        var vine = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.02, 4, 12, Math.PI * 1.5),
          vineMat
        );
        vine.position.set(pp.x, gY + pp.h * 0.4, pp.z);
        vine.rotation.set(Math.random(), Math.random(), 0);
        scene.add(vine);
      }

      // Pillar base (wider stone)
      var base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.55, 0.2, 6),
        stoneMat
      );
      base.position.set(pp.x, gY + 0.1, pp.z);
      scene.add(base);
    });

    // (Stone archway removed — it framed the grove entrance like a gate and
    //  fought the open-trail feeling. The pillars alone carry the ruins.)

    // Wildflowers in the meadow
    for (var mfi = 0; mfi < (isMobile ? 15 : 30); mfi++) {
      var mfa = Math.random() * Math.PI * 2;
      var mfr = Math.random() * 8;
      var mfx = -3 + Math.cos(mfa) * mfr;
      var mfz = -36 + Math.sin(mfa) * mfr;
      var mfgy = getGroundY(mfx, mfz);
      var mfmat = [0xFFFFFF, 0xF0E68C, 0xE8E6DC, 0xC8D8A0][Math.floor(Math.random() * 4)];
      var mfSize = 0.05 + Math.random() * 0.05;
      var mf1 = new THREE.Mesh(
        new THREE.PlaneGeometry(mfSize, mfSize * 1.5),
        new THREE.MeshBasicMaterial({ color: mfmat, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
      );
      mf1.position.set(mfx, mfgy + mfSize, mfz);
      mf1.rotation.y = Math.random() * Math.PI;
      scene.add(mf1);
      var mf2 = new THREE.Mesh(
        new THREE.PlaneGeometry(mfSize, mfSize * 1.5),
        mf1.material
      );
      mf2.position.set(mfx, mfgy + mfSize, mfz);
      mf2.rotation.y = mf1.rotation.y + Math.PI / 2;
      scene.add(mf2);
    }

  }

  // ======================== Campsite — tent, campfire, seated figure ========================
  function createCoreLantern() {
    var gY = 0;
    var logMat = new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9 });
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.95, flatShading: true });

    // === Camp tent (teepee-style, entrance facing the fire) ===
    var shelterX = 2.5, shelterZ = -2.5;
    var sgY = getGroundY(shelterX, shelterZ);
    var tentMat = new THREE.MeshStandardMaterial({ color: 0x6E7A55, roughness: 0.92, flatShading: true });
    var tent = new THREE.Group();
    // Canvas — a fuller, slightly leaning teepee with visible facets
    var tentBody = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.95, 7), tentMat);
    tentBody.position.y = 0.975;
    tentBody.rotation.y = 0.4;      // facet edge faces the fire — reads hand-pitched
    tentBody.rotation.z = 0.04;     // gentle lean
    tent.add(tentBody);
    // Doorway — a dark wedge inset into the canvas, facing the campfire
    var tentDoor = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.95, 4),
      new THREE.MeshStandardMaterial({ color: 0x1B1C14, roughness: 1 })
    );
    tentDoor.position.set(0, 0.48, 0.62);
    tentDoor.rotation.y = Math.PI / 4;
    tent.add(tentDoor);
    // Frame poles — long, crossed above the apex like a real teepee
    var tentPoleMat = new THREE.MeshStandardMaterial({ color: 0x3B2A1A, roughness: 0.9 });
    for (var tp = 0; tp < 4; tp++) {
      var ta = (tp / 4) * Math.PI * 2 + 0.5;
      var tpole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 2.7, 4), tentPoleMat);
      tpole.position.set(Math.cos(ta) * 0.22, 1.32, Math.sin(ta) * 0.22);
      tpole.rotation.set(Math.sin(ta) * 0.22, 0, -Math.cos(ta) * 0.22);
      tent.add(tpole);
    }
    // Guy ropes staked to the ground — small detail, big "camp" read
    var ropeMat = new THREE.MeshBasicMaterial({ color: 0x5C4033 });
    var stakeMat = new THREE.MeshStandardMaterial({ color: 0x2A1F15, roughness: 0.9 });
    [[-1.35, 0.5], [1.05, -1.15]].forEach(function (gr) {
      var rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.15, 3), ropeMat);
      rope.position.set(gr[0] * 0.62, 0.62, gr[1] * 0.62);
      rope.lookAt(new THREE.Vector3(gr[0] * 1.15, 0, gr[1] * 1.15).add(tent.position));
      rope.rotateX(Math.PI / 2);
      tent.add(rope);
      var stake = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.16, 4), stakeMat);
      stake.position.set(gr[0] * 1.12, 0.06, gr[1] * 1.12);
      stake.rotation.z = 0.3;
      tent.add(stake);
    });
    tent.position.set(shelterX, sgY, shelterZ);
    scene.add(tent);

    // Bedroll just inside the tent
    var sleepBag = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4A3B2A, roughness: 0.8 }));
    sleepBag.position.set(shelterX + 0.3, sgY + 0.1, shelterZ - 0.3);
    sleepBag.rotation.set(0, 0.2, Math.PI / 2);
    scene.add(sleepBag);

    // === CAMPFIRE — more detailed ===
    // Fire ring (stones, varied)
    var stoneCount = isMobile ? 6 : 10;
    for (var si = 0; si < stoneCount; si++) {
      var stoneAngle = (si / 10) * Math.PI * 2;
      var sr = 0.08 + Math.random() * 0.08;
      var stone = new THREE.Mesh(new THREE.DodecahedronGeometry(sr, 0), stoneMat);
      stone.position.set(Math.cos(stoneAngle) * 0.85, gY + 0.06, Math.sin(stoneAngle) * 0.85 + 0.5);
      stone.scale.y = 0.5;
      stone.rotation.set(Math.random(), Math.random(), 0);
      scene.add(stone);
    }

    // Log teepee (3 logs leaning together)
    for (var li = 0; li < 3; li++) {
      var la = (li / 3) * Math.PI * 2;
      var log = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.9, 5), logMat);
      log.position.set(Math.cos(la) * 0.22, gY + 0.34, Math.sin(la) * 0.22 + 0.5);
      log.rotation.set(Math.cos(la) * 0.4, la, Math.sin(la) * 0.4);
      scene.add(log);
    }
    // Base logs (flat, under the teepee)
    var baseLog1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.8, 5), logMat);
    baseLog1.position.set(0, gY + 0.08, 0.5); baseLog1.rotation.set(0, 0.8, Math.PI / 2);
    scene.add(baseLog1);
    var baseLog2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.7, 5), logMat);
    baseLog2.position.set(0.08, gY + 0.08, 0.58); baseLog2.rotation.set(0, -0.5, Math.PI / 2);
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
    var awardLabel = makeLabel("2025 Productivity Olympics", {
      fontSize: 18, fontWeight: "700", color: "#FFD24A",
      sub: "National Winner — with the VINTAZK team", scale: 1.15, opacity: 0.75
    });
    awardLabel.position.set(cx, cgY + 1.7, cz);
    scene.add(awardLabel);

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
    var ffColors = [0xFFE066, 0xFFD24A, 0xC8E07A, 0xA9C46C, 0xE8C87A];
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
      // No per-firefly PointLights — the emissive-looking MeshBasic spheres
      // read as glowing on their own, and lights here were pure GPU cost.
      var label = makeLabel(name, { fontSize: 22, fontWeight: "600", color: "#DAD7CD", scale: 1.8, opacity: 0.01 });
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

    lampPositions.slice(0, PATH_LAMP_COUNT).forEach(function (lp, li) {
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

      // Real light on every OTHER lamp only (glow spheres carry the visual);
      // halves the lamp light count — a big per-pixel shading saving
      if (li % 2 === 0) {
        var light = new THREE.PointLight(0xE8C87A, 1.0, 14);
        light.position.set(lp.x, gY + 2.5, lp.z);
        scene.add(light);
      }
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
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 })
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
  function createBillboardTrees() {
    // Distant horizon silhouettes. They used to be 60 Groups (120 meshes) that
    // were re-aimed at the camera every frame. On a far ring, aiming them at
    // the centre once is visually identical and costs nothing per frame, so
    // they are now three static instanced batches. Depth is carried by
    // per-instance colour instead of three separate opacity materials.
    var silhouetteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.62
    });
    var LAYER_COLORS = [0x0A1A10, 0x0D1F14, 0x112218];

    var planTrunk = [], planTri = [], planCirc = [];
    var count = isMobile ? 30 : 60;

    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      var dist = 45 + Math.random() * 15;
      var x = Math.cos(angle) * dist;
      var z = Math.sin(angle) * dist;
      var gY = terrainHeight(x, z);
      var faceIn = Math.atan2(-x, -z); // turn to face the middle of the world
      var h = 5 + Math.random() * 8;
      var col = LAYER_COLORS[Math.floor(Math.random() * 3)];

      planTrunk.push({
        p: [x, gY + h * 0.25, z], r: [0, faceIn, 0],
        s: [0.15 + Math.random() * 0.1, h * 0.5, 1], c: col
      });

      if (Math.random() > 0.4) {
        planTri.push({
          p: [x, gY + h * 0.35, z], r: [0, faceIn, 0],
          s: [1.5 + Math.random() * 2, h * 0.6, 1], c: col
        });
      } else {
        var circR = 1 + Math.random() * 1.5;
        planCirc.push({
          p: [x, gY + h * 0.55, z], r: [0, faceIn, 0],
          s: [circR, circR, 1], c: col
        });
      }
    }

    // Unit shapes — per-instance scale restores the original proportions
    var planeGeo = new THREE.PlaneGeometry(1, 1);
    var triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      -0.5, 0, 0,   0.5, 0, 0,   0, 1, 0
    ]), 3));
    triGeo.computeVertexNormals();
    var circGeo = new THREE.CircleGeometry(1, 8);

    scene._billboards = [
      buildInstanced(planeGeo, silhouetteMat, planTrunk),
      buildInstanced(triGeo,   silhouetteMat, planTri),
      buildInstanced(circGeo,  silhouetteMat, planCirc)
    ].filter(Boolean);
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
    moonGlow.position.copy(moonMesh.position); // halo belongs ON the moon
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

    // Planned first, then uploaded as three instanced batches. (This used to
    // allocate a fresh material inside the bush and log loops — the exact
    // "no new materials in loops" rule the project sets.)
    var planRock = [], planBush = [], planLog = [];

    for (var i = 0; i < 30; i++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 3 + Math.random() * 35;
      var rx = Math.cos(angle) * dist;
      var rz = Math.sin(angle) * dist;
      if (Math.sqrt(rx * rx + rz * rz) < 14) continue;
      var rr = 0.1 + Math.random() * 0.25;
      planRock.push({
        p: [rx, getGroundY(rx, rz) + 0.1, rz],
        r: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
        s: [rr, rr * (0.5 + Math.random() * 0.5), rr]
      });
    }

    for (var j = 0; j < 20; j++) {
      var ba = Math.random() * Math.PI * 2;
      var bd = 4 + Math.random() * 30;
      var bx = Math.cos(ba) * bd;
      var bz = Math.sin(ba) * bd;
      if (Math.sqrt(bx * bx + bz * bz) < 14) continue;
      var bgy = getGroundY(bx, bz);
      var bushColor = bushColors[Math.floor(Math.random() * bushColors.length)];
      var clusterCount = 2 + Math.floor(Math.random() * 2);
      for (var k = 0; k < clusterCount; k++) {
        var br = 0.15 + Math.random() * 0.2;
        planBush.push({
          p: [bx + (Math.random() - 0.5) * 0.5, bgy + 0.15 + Math.random() * 0.15, bz + (Math.random() - 0.5) * 0.5],
          r: [0, Math.random() * Math.PI, 0],
          s: [br, br * (0.6 + Math.random() * 0.3), br],
          c: bushColor
        });
      }
    }

    for (var l = 0; l < 6; l++) {
      var la = Math.random() * Math.PI * 2;
      var ld = 6 + Math.random() * 25;
      var lx = Math.cos(la) * ld;
      var lz = Math.sin(la) * ld;
      if (Math.sqrt(lx * lx + lz * lz) < 14) continue;
      var lr = 0.1 + Math.random() * 0.1;
      planLog.push({
        p: [lx, getGroundY(lx, lz) + 0.1, lz],
        r: [0, Math.random() * Math.PI, Math.PI / 2],
        s: [lr, 1.5 + Math.random() * 2, lr]
      });
    }

    var bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    var logMat = new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9, flatShading: true });

    buildInstanced(new THREE.DodecahedronGeometry(1, 0), rockMat, planRock);
    buildInstanced(new THREE.SphereGeometry(1, 5, 4), bushMat, planBush);
    buildInstanced(new THREE.CylinderGeometry(1, 1.2, 1, 6), logMat, planLog);
  }

  // ======================== Pond ========================
  // ======================== Spawn ========================
  function spawnFirefly(x, y, z) {
    var color = [0xFFE066, 0xC8E07A, 0xA9C46C, 0xE8C87A][Math.floor(Math.random() * 4)];
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

  // ======================== Plant a tree — the signature interaction ========
  // Click the ground and a pine grows there. It persists: come back and your
  // tree is still standing. (Replaces the old ember-planting.)
  var plantBarkMat = null, plantLeafMats = null;
  function spawnTree(worldX, worldZ, instant, startDelay) {
    // Keep the campsite clear and stay inside the world
    if (worldX * worldX + worldZ * worldZ < 20) return null;
    if (Math.abs(worldX) > 50 || Math.abs(worldZ) > 52) return null;

    if (!plantBarkMat) {
      plantBarkMat = new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.85, flatShading: true });
      plantLeafMats = CANOPY_COLORS.map(function (c) {
        return new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true });
      });
    }

    var gY = getGroundY(worldX, worldZ);
    var g = new THREE.Group();
    var h = 2.6 + Math.random() * 1.6;
    var trunkH = h * 0.35;
    var leaf = plantLeafMats[Math.floor(Math.random() * plantLeafMats.length)];

    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, trunkH, 5), plantBarkMat);
    trunk.position.y = trunkH / 2;
    g.add(trunk);
    var c1 = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h * 0.5, 7), leaf);
    c1.position.y = trunkH + h * 0.22;
    g.add(c1);
    var c2 = new THREE.Mesh(new THREE.ConeGeometry(h * 0.2, h * 0.38, 7), leaf);
    c2.position.y = trunkH + h * 0.46;
    g.add(c2);

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
      scene.remove(old.group);
      old.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
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
  function onTouch(e) {
    e.preventDefault(); isMouseDown = true;
    var t = e.touches[0]; var wp = getWorldPos(t.clientX, t.clientY);
    if (spawnTree(wp.x, wp.z, false, 0)) { saveTrees(); }
    else spawnFirefly(wp.x, wp.y, wp.z);
    lastTouchSpawn = Date.now();
  }
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
            if (scene._billboards) {
              for (var pbi = 0; pbi < scene._billboards.length; pbi++) scene._billboards[pbi].visible = false;
            }
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
      var flicker = 2.5 + sinT8 * 0.6 + Math.sin(t * 13) * 0.3 + Math.sin(t * 21) * 0.15;
      scene._fireLight.intensity = flicker * cAmp;
      var colorShift = sinT3 * 0.5 + 0.5;
      scene._fireLight.color.setRGB(1.0, 0.45 + colorShift * 0.15, 0.15 + colorShift * 0.1);
    }
    if (scene._fireFill) {
      scene._fireFill.intensity = (0.9 + sinT6 * 0.3) * cAmp;
      scene._fireFill.color.setRGB(0.9, 0.35 + sinT2 * 0.1, 0.1);
    }
    if (scene._fireBounce) {
      scene._fireBounce.intensity = (0.7 + sinT4 * 0.2) * cAmp;
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

    // === Tree canopy wind sway (every 2nd frame) ===
    // Wind sway — one small instanced batch, re-uploaded every 2nd frame
    if (scene._sway && frame % 2 === 0) {
      var sw = scene._sway, swItems = sw.items, swDummy = scene._swayDummy;
      if (!swDummy) swDummy = scene._swayDummy = new THREE.Object3D();
      for (var ci = 0; ci < swItems.length; ci++) {
        var cp = swItems[ci];
        swDummy.position.set(cp.p[0], cp.p[1], cp.p[2]);
        swDummy.rotation.set(
          cp.r[0] + Math.sin(t * 0.8 + cp.phase) * 0.02,
          cp.r[1],
          cp.r[2] + Math.sin(t * 0.6 + cp.phase * 1.3) * 0.015
        );
        swDummy.scale.set(cp.s[0], cp.s[1], cp.s[2]);
        swDummy.updateMatrix();
        sw.mesh.setMatrixAt(ci, swDummy.matrix);
      }
      sw.mesh.instanceMatrix.needsUpdate = true;
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
      lan.light.intensity *= 0.95 + (sinT6 + Math.sin(li * 2) * 0.5) * 0.05;
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
      if (techProximity > 0.1) ff.mesh.material.opacity *= 0.85 + (sinT3 + Math.sin(fi * 2.5) * 0.5) * 0.15;
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

    // Stars twinkle — pulse opacity of individual stars
    if (scene._stars) {
      scene._stars.rotation.y = t * 0.001;
      scene._stars.material.opacity = 0.6 + Math.sin(t * 0.5) * 0.15;
    }

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
      plantedTrees[k].group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    }
    plantedTrees = [];
    plantBarkMat = null; plantLeafMats = null; // rebuilt on next planting
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
        if (scene.clear) scene.clear();
        scene = null;
      }
      // Keep the renderer (a canvas can't mint a second GL context) but drop
      // its cached render lists so the freed scene isn't retained.
      if (renderer && renderer.renderLists) renderer.renderLists.dispose();
      camera = null; clock = null;
      trees = []; lanterns = []; fireflies = [];
      perfFrames = 0; perfStart = 0; perfTier = 0;
    },
    isRunning: function () { return isActive; }
  };
})();
