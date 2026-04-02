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
  // 10 chapters — campsite centered, clear sightlines
  var CAMERA_PATH = [
    { at: 0.00, pos: [0, 8, 40],      look: [0, 0, 0] },     // Ch0: High above, looking down into clearing
    { at: 0.05, pos: [0, 6, 34],      look: [0, 0.3, 0] },   // Gentle descent
    { at: 0.10, pos: [0, 4.5, 24],    look: [0, 0.5, 0] },   // Ch1: The path — inside the tree ring
    { at: 0.16, pos: [1, 3, 16],      look: [0, 0.5, 0] },   // Approaching campsite
    { at: 0.22, pos: [3, 2, 8],       look: [0, 0.5, -0.5] },// Ch2: Campsite — clear wide view
    { at: 0.28, pos: [2, 1.8, 5],     look: [0, 0.6, 0] },   // Closer — fire and figure visible
    { at: 0.33, pos: [-0.5, 1.8, 4],  look: [0, 0.5, -0.3] },// Ch3: Orbit left — other side of fire
    { at: 0.38, pos: [-2, 2.2, 2],    look: [0, 0.5, -1] },  // Transitioning out
    { at: 0.42, pos: [-1.5, 2.8, 0],  look: [2, 1, -6] },    // Smooth bridge to lanterns
    { at: 0.47, pos: [0, 3, -4],      look: [6, 2, -14] },   // Ch4: Turning toward lanterns
    { at: 0.52, pos: [3, 3.2, -8],    look: [8, 2.5, -18] }, // Walking to lanterns
    { at: 0.57, pos: [7, 3.5, -13],   look: [8, 3, -20] },   // Ch5: Among lanterns
    { at: 0.63, pos: [5, 3.5, -18],   look: [0, 3, -24] },   // Into deep woods
    { at: 0.69, pos: [0, 3.2, -22],   look: [-6, 3, -28] },  // Ch6: Fireflies
    { at: 0.75, pos: [-6, 3.5, -20],  look: [-4, 4, -14] },  // Ch7: The award
    { at: 0.81, pos: [-5, 5, -12],    look: [-2, 2, -4] },   // Ascending
    { at: 0.87, pos: [-3, 7, -2],     look: [0, 1, 0] },     // Ch8: Rising above canopy
    { at: 0.93, pos: [4, 8, 8],       look: [0, 0.5, 0] },   // Wide view
    { at: 0.97, pos: [12, 7, 5],      look: [0, 0.5, 0] },   // Settling into a tree
    { at: 1.00, pos: [14, 6.5, 4],    look: [0, 0.5, 0] }    // Ch9: Nested in the branches
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
    // Quintic smoothstep — much smoother than cubic
    t = t * t * t * (t * (t * 6 - 15) + 10);
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
    scene.fog = new THREE.Fog(0x0C1210, 18, 75);
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 8, 40);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    renderer.shadowMap.enabled = !isMobile;
    if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    raycaster = new THREE.Raycaster(); mouseVec = new THREE.Vector2();

    // Lighting — moonlit forest with visible depth
    scene.add(new THREE.AmbientLight(0x2A4E3A, 1.2));
    var moon = new THREE.DirectionalLight(0xAABBCC, 1.0);
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
    createSky(); createSmoke(); createGroundDetails();
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
      if (d < 14) h *= d / 14;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    var terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1A2E1C, roughness: 0.95, flatShading: true }));
    terrain.rotation.x = -Math.PI / 2; terrain.receiveShadow = true;
    scene.add(terrain); scene._terrain = terrain;
  }

  // ======================== Forest ========================
  function getGroundY(x, z) {
    var h = noise2D(x, z) * 1.2;
    var d = Math.sqrt(x * x + z * z);
    if (d < 14) h *= d / 14;
    return h;
  }

  function plantForest() {
    for (var i = 0; i < TREE_COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var dist = 14 + Math.random() * 45;
      var x = Math.cos(angle) * dist;
      var z = Math.sin(angle) * dist;
      if (Math.abs(x) > 55 || Math.abs(z) > 55) continue;

      var height = 3 + Math.random() * 7;
      var trunkH = height * (0.4 + Math.random() * 0.2);
      var canopyH = height * (0.5 + Math.random() * 0.3);
      var canopyR = 1.2 + Math.random() * 2.5;
      var trunkR = 0.1 + Math.random() * 0.2;
      var gY = getGroundY(x, z);

      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, 6),
        new THREE.MeshStandardMaterial({ color: TRUNK_COLORS[i % 4], roughness: 0.9 })
      );
      trunk.position.set(x, gY + trunkH / 2, z); trunk.castShadow = true;
      scene.add(trunk);

      var isRoundTree = Math.random() > 0.6;
      if (isRoundTree) {
        // Round / deciduous canopy
        var sphereCount = 2 + Math.floor(Math.random() * 2);
        for (var j = 0; j < sphereCount; j++) {
          var sr = canopyR * (0.5 + Math.random() * 0.4);
          var canopy = new THREE.Mesh(
            new THREE.SphereGeometry(sr, 7, 6),
            new THREE.MeshStandardMaterial({ color: CANOPY_COLORS[Math.floor(Math.random() * 6)], roughness: 0.8, flatShading: true })
          );
          canopy.position.set(
            x + (Math.random() - 0.5) * canopyR * 0.5,
            gY + trunkH + sr * 0.5 + j * sr * 0.5,
            z + (Math.random() - 0.5) * canopyR * 0.5
          );
          canopy.scale.y = 0.7 + Math.random() * 0.3;
          canopy.castShadow = true;
          scene.add(canopy);
        }
      } else {
        // Conifer / pine tree (original)
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
      }
      trees.push({ x: x, z: z });
    }
  }

  // ======================== Campsite — tent, campfire, seated figure ========================
  function createCoreLantern() {
    var gY = 0; // clearing is flat

    // === Tent — proper A-frame with ridge pole, guy ropes, ground sheet ===
    var tentFabric = new THREE.MeshStandardMaterial({ color: 0x4A6B3F, roughness: 0.75, flatShading: true, side: THREE.DoubleSide });
    var tentFabricInner = new THREE.MeshStandardMaterial({ color: 0x3D5C35, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x6B5B4B, roughness: 0.7 });

    // Ground sheet
    var tX = 1.0, tZ = -1.2; // tent center offset
    var groundSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x3A5A40, roughness: 0.9 })
    );
    groundSheet.rotation.x = -Math.PI / 2;
    groundSheet.position.set(tX, gY + 0.02, tZ);
    scene.add(groundSheet);

    // Left panel
    var panelGeo = new THREE.PlaneGeometry(1.1, 2.0);
    var tentL = new THREE.Mesh(panelGeo, tentFabric);
    tentL.position.set(tX - 0.45, gY + 0.55, tZ);
    tentL.rotation.set(0, 0, 0.6);
    scene.add(tentL);

    // Right panel
    var tentR = new THREE.Mesh(panelGeo.clone(), tentFabric);
    tentR.position.set(tX + 0.45, gY + 0.55, tZ);
    tentR.rotation.set(0, 0, -0.6);
    scene.add(tentR);

    // Front flap (slightly open)
    var flapGeo = new THREE.PlaneGeometry(0.6, 1.0);
    var flapL = new THREE.Mesh(flapGeo, tentFabricInner);
    flapL.position.set(tX - 0.2, gY + 0.4, tZ + 0.9);
    flapL.rotation.set(0.15, 0.35, 0.45);
    scene.add(flapL);
    var flapR = new THREE.Mesh(flapGeo.clone(), tentFabricInner);
    flapR.position.set(tX + 0.2, gY + 0.4, tZ + 0.9);
    flapR.rotation.set(0.15, -0.35, -0.45);
    scene.add(flapR);

    // Back wall (triangle)
    var backGeo = new THREE.BufferGeometry();
    var backVerts = new Float32Array([
      tX - 0.55, gY, tZ - 0.95,  tX + 0.55, gY, tZ - 0.95,  tX, gY + 1.0, tZ - 0.95
    ]);
    backGeo.setAttribute("position", new THREE.BufferAttribute(backVerts, 3));
    backGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(backGeo, tentFabricInner));

    // Ridge pole
    var ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.0, 4), poleMat);
    ridge.position.set(tX, gY + 1.0, tZ);
    ridge.rotation.x = Math.PI / 2;
    scene.add(ridge);

    // Front A-frame poles
    var poleGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.2, 4);
    var poleFL = new THREE.Mesh(poleGeo, poleMat);
    poleFL.position.set(tX - 0.25, gY + 0.5, tZ + 0.9);
    poleFL.rotation.z = 0.5;
    scene.add(poleFL);
    var poleFR = new THREE.Mesh(poleGeo.clone(), poleMat);
    poleFR.position.set(tX + 0.25, gY + 0.5, tZ + 0.9);
    poleFR.rotation.z = -0.5;
    scene.add(poleFR);

    // === Campfire ===
    // Fire ring (stones)
    for (var si = 0; si < 8; si++) {
      var stoneAngle = (si / 8) * Math.PI * 2;
      var stone = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 + Math.random() * 0.06, 5, 4),
        new THREE.MeshStandardMaterial({ color: 0x555555 + Math.floor(Math.random() * 0x222222), roughness: 0.95, flatShading: true })
      );
      stone.position.set(Math.cos(stoneAngle) * 0.5, gY + 0.08, Math.sin(stoneAngle) * 0.5 + 0.5);
      stone.scale.y = 0.6;
      scene.add(stone);
    }
    // Logs
    var logMat = new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9 });
    var log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 5), logMat);
    log1.position.set(0, gY + 0.15, 0.5); log1.rotation.z = 0.3; log1.rotation.y = 0.5;
    scene.add(log1);
    var log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 5), logMat);
    log2.position.set(0.1, gY + 0.15, 0.45); log2.rotation.z = -0.25; log2.rotation.y = -0.4;
    scene.add(log2);

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

    // === Seated figure — Kent, by the fire ===
    var skinColor = 0xC4956A;
    var skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
    var shirtMat = new THREE.MeshStandardMaterial({ color: 0x344E41, roughness: 0.75 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x2A2A3A, roughness: 0.85 });
    var shoeMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.9 });
    var hairMat = new THREE.MeshStandardMaterial({ color: 0x1A1008, roughness: 0.9 });

    var figX = -0.6, figZ = 0.9;

    // Torso (slightly leaning forward toward fire)
    var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), shirtMat);
    torso.position.set(figX, gY + 0.6, figZ);
    torso.rotation.set(0.2, 0.3, 0);
    scene.add(torso);

    // Head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), skinMat);
    head.position.set(figX + 0.04, gY + 1.08, figZ - 0.06);
    scene.add(head);

    // Hair
    var hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
      hairMat
    );
    hair.position.set(figX + 0.04, gY + 1.14, figZ - 0.04);
    hair.rotation.x = -0.15;
    scene.add(hair);

    // Neck
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 6), skinMat);
    neck.position.set(figX + 0.02, gY + 0.9, figZ - 0.03);
    scene.add(neck);

    // Left arm (resting on knee)
    var armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 3, 6), shirtMat);
    armL.position.set(figX - 0.22, gY + 0.48, figZ + 0.05);
    armL.rotation.set(0.4, 0, -0.6);
    scene.add(armL);
    // Left hand
    var handL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), skinMat);
    handL.position.set(figX - 0.35, gY + 0.3, figZ + 0.15);
    scene.add(handL);

    // Right arm (holding stick toward fire)
    var armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 3, 6), shirtMat);
    armR.position.set(figX + 0.22, gY + 0.5, figZ - 0.1);
    armR.rotation.set(0.6, 0, 0.5);
    scene.add(armR);
    // Right forearm
    var forearmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 3, 6), skinMat);
    forearmR.position.set(figX + 0.35, gY + 0.38, figZ - 0.2);
    forearmR.rotation.set(0.8, 0, 0.3);
    scene.add(forearmR);
    // Stick in hand (poking the fire)
    var stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.01, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.9 })
    );
    stick.position.set(figX + 0.3, gY + 0.35, figZ - 0.35);
    stick.rotation.set(0.9, 0.2, 0.4);
    scene.add(stick);

    // Upper legs (sitting, bent at knees)
    var thighL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.35, 3, 6), pantsMat);
    thighL.position.set(figX - 0.12, gY + 0.28, figZ + 0.12);
    thighL.rotation.set(0.1, 0.3, Math.PI / 2 - 0.2);
    scene.add(thighL);
    var thighR = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.35, 3, 6), pantsMat);
    thighR.position.set(figX + 0.1, gY + 0.28, figZ - 0.05);
    thighR.rotation.set(-0.2, -0.2, Math.PI / 2 + 0.1);
    scene.add(thighR);

    // Lower legs (crossed / tucked)
    var shinL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 3, 6), pantsMat);
    shinL.position.set(figX - 0.05, gY + 0.15, figZ + 0.3);
    shinL.rotation.set(0.3, 0.5, 0.1);
    scene.add(shinL);
    var shinR = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 3, 6), pantsMat);
    shinR.position.set(figX + 0.15, gY + 0.15, figZ + 0.08);
    shinR.rotation.set(-0.2, -0.3, 0.2);
    scene.add(shinR);

    // Shoes
    var shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), shoeMat);
    shoeL.position.set(figX + 0.05, gY + 0.05, figZ + 0.42);
    scene.add(shoeL);
    var shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), shoeMat);
    shoeR.position.set(figX + 0.25, gY + 0.05, figZ + 0.18);
    shoeR.rotation.y = -0.3;
    scene.add(shoeR);

    // Log seat (sitting on a fallen log)
    var seatLog = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x3B2314, roughness: 0.9 })
    );
    seatLog.position.set(figX, gY + 0.12, figZ + 0.05);
    seatLog.rotation.z = Math.PI / 2;
    seatLog.rotation.y = 0.3;
    scene.add(seatLog);

    // Backpack leaning against the log
    var backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.4, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x344E41, roughness: 0.8 })
    );
    backpack.position.set(figX - 0.5, gY + 0.2, figZ + 0.3);
    backpack.rotation.set(0, 0.3, -0.2);
    scene.add(backpack);
    // Backpack flap
    var flap = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x3A5A40, roughness: 0.75 })
    );
    flap.position.set(figX - 0.5, gY + 0.42, figZ + 0.28);
    flap.rotation.set(-0.15, 0.3, -0.2);
    scene.add(flap);

    // Mug on the ground near the fire
    var mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B8B8B, roughness: 0.4, metalness: 0.3 })
    );
    mug.position.set(figX + 0.4, gY + 0.05, figZ + 0.35);
    scene.add(mug);

    // Laptop — glowing screen, developer even while camping
    var laptopBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.02, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x2A2A2A, roughness: 0.3, metalness: 0.6 })
    );
    laptopBase.position.set(figX + 0.55, gY + 0.22, figZ + 0.1);
    laptopBase.rotation.y = 0.4;
    scene.add(laptopBase);

    // Screen (angled up)
    var screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.33, 0.22, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.2, emissive: 0x2244AA, emissiveIntensity: 0.3 })
    );
    screen.position.set(figX + 0.48, gY + 0.34, figZ - 0.02);
    screen.rotation.set(-0.4, 0.4, 0);
    scene.add(screen);

    // Screen glow light
    var screenLight = new THREE.PointLight(0x4466CC, 0.4, 3);
    screenLight.position.set(figX + 0.5, gY + 0.4, figZ);
    scene.add(screenLight);
    scene._screenLight = screenLight;

    // Code lines on screen (tiny green sprites)
    var codeLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.005),
      new THREE.MeshBasicMaterial({ color: 0xA3B18A, transparent: true, opacity: 0.6 })
    );
    codeLine.position.set(figX + 0.48, gY + 0.38, figZ - 0.01);
    codeLine.rotation.set(-0.4, 0.4, 0);
    scene.add(codeLine);
    var codeLine2 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x5C7650, transparent: true, opacity: 0.5 })
    );
    codeLine2.position.set(figX + 0.47, gY + 0.36, figZ - 0.01);
    codeLine2.rotation.set(-0.4, 0.4, 0);
    scene.add(codeLine2);
    var codeLine3 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.005),
      new THREE.MeshBasicMaterial({ color: 0xA3B18A, transparent: true, opacity: 0.4 })
    );
    codeLine3.position.set(figX + 0.46, gY + 0.34, figZ - 0.01);
    codeLine3.rotation.set(-0.4, 0.4, 0);
    scene.add(codeLine3);

    // === Brand label floats above the campsite ===
    var brand = makeLabel("//kent.dev", { fontSize: 28, fontWeight: "700", color: "#A3B18A", scale: 1.8, opacity: 0.6 });
    brand.position.set(0, gY + 3.2, 0); scene.add(brand); scene._brandLabel = brand;
    var sub = makeLabel("Senior Software Developer", { fontSize: 13, fontWeight: "400", color: "rgba(163,177,138,0.4)", scale: 1.4, opacity: 0.35 });
    sub.position.set(0, gY + 2.5, 0); scene.add(sub); scene._brandSub = sub;
  }

  // ======================== Project Lanterns ========================
  function createProjectLanterns() {
    var positions = [{ x: 12, z: -18 }, { x: 8, z: -25 }, { x: 16, z: -22 }, { x: 5, z: -20 }, { x: 10, z: -28 }];
    PROJECTS.forEach(function (proj, i) {
      var p = positions[i], y = 3 + Math.random() * 2;
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhysicalMaterial({
        color: proj.color, emissive: proj.color, emissiveIntensity: 0.1, transparent: true, opacity: 0.3,
        roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05
      }));
      mesh.position.set(p.x, y, p.z); scene.add(mesh);
      var light = new THREE.PointLight(proj.color, 0.6, 8); light.position.set(p.x, y, p.z); scene.add(light);
      var label = makeLabel(proj.name, { fontSize: 20, fontWeight: "600", color: "#DAD7CD", sub: proj.sub, scale: 1.4, opacity: 0.01 });
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
      var label = makeLabel(name, { fontSize: 14, fontWeight: "500", color: "rgba(218,215,205,0.6)", scale: 0.9, opacity: 0.01 });
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

  // ======================== Sky — Stars + Moon ========================
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

    // Moon — simple glowing disc
    var moonGeo = new THREE.SphereGeometry(3, 16, 16);
    var moonMat = new THREE.MeshBasicMaterial({ color: 0xDDE8F0, transparent: true, opacity: 0.25 });
    var moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(-30, 50, -40);
    scene.add(moonMesh);
    // Moon glow
    var glowGeo = new THREE.SphereGeometry(5, 16, 16);
    var glowMat = new THREE.MeshBasicMaterial({ color: 0xAABBCC, transparent: true, opacity: 0.06 });
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
    var fogNearTarget = lerp(12, 6, Math.min(1, scrollProgress * 1.2));
    var fogFarTarget = lerp(70, 90, scrollProgress);
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
    var cAmp = scrollProgress < 0.22 ? Math.min(1, scrollProgress / 0.12) : (scrollProgress < 0.48 ? 1.0 : Math.max(0.25, 1 - (scrollProgress - 0.48) * 1.2));
    if (scene._fireLight) {
      var flicker = 2.5 + Math.sin(t * 8) * 0.6 + Math.sin(t * 13) * 0.3 + Math.sin(t * 21) * 0.15;
      scene._fireLight.intensity = flicker * cAmp;
    }
    if (scene._fireFill) {
      scene._fireFill.intensity = (0.9 + Math.sin(t * 6) * 0.3) * cAmp;
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
    if (scene._brandLabel) scene._brandLabel.position.y = 4.5 + Math.sin(t * 0.4) * 0.1;
    if (scene._brandSub) scene._brandSub.position.y = 3.5 + Math.sin(t * 0.4 + 0.5) * 0.08;

    // Lanterns
    var inProj = scrollProgress > 0.45 && scrollProgress < 0.65;
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
    var inTech = scrollProgress > 0.64 && scrollProgress < 0.78;
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

    // Stars twinkle
    if (scene._stars) scene._stars.rotation.y = t * 0.001;

    // Smoke rises from campfire
    if (scene._smoke) {
      for (var si = 0; si < scene._smoke.length; si++) {
        var sm = scene._smoke[si], sd = sm.userData;
        var cycle = ((t * sd.speed + sd.phase) % sd.maxH) / sd.maxH;
        var h = cycle * sd.maxH;
        sm.position.set(
          sd.drift * cycle + Math.sin(t * 0.5 + sd.phase) * 0.2 * cycle,
          0.5 + h,
          0.5 + Math.cos(t * 0.3 + sd.phase) * 0.1 * cycle
        );
        sm.material.opacity = Math.sin(cycle * Math.PI) * 0.12 * cAmp;
        var scale = 0.3 + cycle * sd.growRate;
        sm.scale.setScalar(scale);
      }
    }



    // Laptop screen flicker
    if (scene._screenLight) {
      scene._screenLight.intensity = 0.3 + Math.sin(t * 2) * 0.1;
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
