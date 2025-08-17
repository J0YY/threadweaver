import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import * as CANNON from 'cannon-es';

// ---------- DOM ----------
const container = document.getElementById('scene');
const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');
const uiSky = document.getElementById('uiSky');
const uiMix = document.getElementById('uiMix');
const uiBuildings = document.getElementById('uiBuildings');
const uiTrees = document.getElementById('uiTrees');
const uiPeople = document.getElementById('uiPeople');
const uiCars = document.getElementById('uiCars');
const sidebarEl = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const rootHtml = document.documentElement;

// ---------- Three.js core ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffc6a8'); // light pink/orange
scene.fog = new THREE.FogExp2(0xffc6a8, 0.015);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 1.65, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
container.appendChild(renderer.domElement);

// ---------- Lights ----------
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
keyLight.position.set(5, 8, 5);
scene.add(keyLight);

// ---------- World: roads, buildings, trees ----------
const worldGroup = new THREE.Group();
scene.add(worldGroup);

// Physics world
const physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.allowSleep = true;

// Randomized world parameters
const WORLD = {
  extent: 240 + Math.floor(Math.random() * 160),
  roadStep: 20 + Math.floor(Math.random() * 10),
  laneHalf: 1.2 + Math.random() * 0.8,
  buildingDensity: 0.45 + Math.random() * 0.25,
  parkProbability: 0.25 + Math.random() * 0.2,
  baseTreeCount: 500 + Math.floor(Math.random() * 600)
};
WORLD.parks = [];

// Materials
const groundMat = new CANNON.Material('groundMat');
const playerMat = new CANNON.Material('playerMat');
physicsWorld.addContactMaterial(new CANNON.ContactMaterial(groundMat, playerMat, {
  friction: 0.2,
  restitution: 0.0
}));

// Ground
const groundGeo = new THREE.PlaneGeometry(WORLD.extent * 2, WORLD.extent * 2);
const groundMatVis = new THREE.MeshStandardMaterial({ color: 0x0a1426, roughness: 0.9, metalness: 0.05 });
const groundMesh = new THREE.Mesh(groundGeo, groundMatVis);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = false;
worldGroup.add(groundMesh);

const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: groundMat });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
physicsWorld.addBody(groundBody);

// World layer groups for re-render
let roadsGroup = new THREE.Group(); worldGroup.add(roadsGroup);
let lightsGroup = new THREE.Group(); worldGroup.add(lightsGroup);
let buildingsGroup = new THREE.Group(); worldGroup.add(buildingsGroup);
let treesGroup = new THREE.Group(); worldGroup.add(treesGroup);
let npcsGroup = new THREE.Group(); worldGroup.add(npcsGroup);

// Add roads (visual only)
addRoadGrid(roadsGroup);
addLaneStripes(roadsGroup);

// Buildings, street props, and trees are initialized after their functions are defined below

// (NPCs removed for voxel surface)
const pedestrians = [];
const cars = [];
const animals = [];

function createPedestrian() {
  const g = new THREE.Group();
  // Slightly smaller scale for more natural first-person proportion
  g.scale.set(0.85, 0.85, 0.85);

  // Palette
  const jacketColor = new THREE.Color().setHSL(Math.random(), 0.35, 0.45);
  const pantsColor = new THREE.Color().setHSL(Math.random(), 0.2, 0.25);
  const accentColor = new THREE.Color().setHSL(Math.random(), 0.6, 0.6);

  const torsoMat = new THREE.MeshStandardMaterial({ color: jacketColor, metalness: 0.2, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, metalness: 0.1, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe3d5c6, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.22), torsoMat);
  torso.position.y = 1.0;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 14), skinMat);
  head.position.y = 1.42;

  // Simple face: eyes + mouth
  const eyeGeo = new THREE.SphereGeometry(0.018, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.05, 1.45, 0.14);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.05, 1.45, 0.14);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.02), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  mouth.position.set(0, 1.39, 0.145);

  // Hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.158, 12, 12, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: accentColor }));
  hair.position.y = 1.43;

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), torsoMat); armL.position.set(-0.24, 1.1, 0);
  const armR = armL.clone(); armR.position.x = 0.24;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.12), pantsMat); legL.position.set(-0.12, 0.5, 0);
  const legR = legL.clone(); legR.position.x = 0.12;

  // Jacket stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.01), new THREE.MeshBasicMaterial({ color: accentColor }));
  stripe.position.set(0, 1.0, 0.115);

  g.add(torso, head, hair, eyeL, eyeR, mouth, armL, armR, legL, legR, stripe);
  g.userData.parts = { armL, armR, legL, legR };
  g.userData.type = 'pedestrian';
  return g;
}

function spawnPedestrians(count) {
  for (let i = 0; i < count; i++) {
    const g = createPedestrian();
    const lane = Math.round((Math.random() - 0.5) * 24) * WORLD.roadStep;
    const alongX = Math.random() > 0.5;
    const posX = alongX ? -WORLD.extent + Math.random() * (WORLD.extent * 2) : lane + (Math.random() - 0.5) * 6;
    const posZ = alongX ? lane + (Math.random() - 0.5) * 6 : -WORLD.extent + Math.random() * (WORLD.extent * 2);
    g.position.set(posX, 0, posZ);
    g.userData.v = new THREE.Vector3((alongX?1:0)*(0.6+Math.random()*0.8)*(Math.random()<0.5?-1:1), 0, (!alongX?1:0)*(0.6+Math.random()*0.8)*(Math.random()<0.5?-1:1));
    g.userData.walkPhase = Math.random() * Math.PI * 2;
    npcsGroup.add(g);
    pedestrians.push(g);
  }
}

function spawnCars(count) {
  for (let i = 0; i < count; i++) {
    const w = 1.6, h = 0.8, l = 3.2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.6, 0.5), metalness: 0.7, roughness: 0.3 }));
    body.position.y = 0.4;
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
    wheelGeo.rotateZ(Math.PI/2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const wheels = [
      new THREE.Mesh(wheelGeo, wheelMat), new THREE.Mesh(wheelGeo, wheelMat),
      new THREE.Mesh(wheelGeo, wheelMat), new THREE.Mesh(wheelGeo, wheelMat)
    ];
    wheels[0].position.set(-0.7, 0.2, -1.1);
    wheels[1].position.set(0.7, 0.2, -1.1);
    wheels[2].position.set(-0.7, 0.2, 1.1);
    wheels[3].position.set(0.7, 0.2, 1.1);
    const car = new THREE.Group();
    car.add(body, ...wheels);
    const alongX = Math.random() > 0.5;
    const lane = Math.round((Math.random() - 0.5) * 24) * WORLD.roadStep;
    if (alongX) {
      car.position.set(-WORLD.extent - 20, 0, lane + (Math.random() < 0.5 ? -WORLD.laneHalf : WORLD.laneHalf));
    } else {
      car.position.set(lane + (Math.random() < 0.5 ? -WORLD.laneHalf : WORLD.laneHalf), 0, -WORLD.extent - 20);
    }
    car.userData = { type: 'car', speed: 8 + Math.random() * 6, alongX, wheels };
    npcsGroup.add(car);
    cars.push(car);
  }
}

function spawnAnimals(count) {
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.9), new THREE.MeshStandardMaterial({ color: 0x996633, roughness: 0.8 }));
    body.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.25), new THREE.MeshStandardMaterial({ color: 0x8a5a2c }));
    head.position.set(0, 0.35, 0.45);
    g.add(body); g.add(head);
    g.userData.type = 'animal';
    let x = (Math.random() - 0.5) * WORLD.extent * 2;
    let z = (Math.random() - 0.5) * WORLD.extent * 2;
    g.position.set(x, 0, z);
    g.userData.v = new THREE.Vector3((Math.random()-0.5)*0.8, 0, (Math.random()-0.5)*0.8);
    g.userData.wander = 0;
    npcsGroup.add(g);
    animals.push(g);
  }
}

// spawn counts
spawnPedestrians(3000); // default very dense
spawnCars(20);
spawnAnimals(20);

// Live config and rebuild
const CONFIG = {
  sky: '#ffc6a8',
  mix: 0.5,
  buildings: 0.55,
  trees: 0.8,
  people: 0.6,
  cars: 0.5,
  fog: 0.02,
  ambient: 0.4,
  sun: 0.8,
  accent: '#37b7ff',
  lights: 0.8,
  roadSpacing: 0.4,
  world: 0.5
};

function lerp(a,b,t){ return a + (b-a)*t; }

function rebuildWorld() {
  // Sky color
  scene.background = new THREE.Color(CONFIG.sky);
  scene.fog.color = new THREE.Color(CONFIG.sky);
  scene.fog.density = CONFIG.fog;
  ambient.intensity = CONFIG.ambient;
  keyLight.intensity = CONFIG.sun;
  // Hide procedural sky so background color is visible
  if (sky) sky.visible = false;

  // Clear NPCs
  for (const arr of [pedestrians, cars, animals]) {
    for (const n of arr) npcsGroup.remove(n);
    arr.length = 0;
  }
  // Clear lights
  while (lightsGroup.children.length) lightsGroup.remove(lightsGroup.children[0]);
  // Clear trees
  while (treesGroup.children.length) treesGroup.remove(treesGroup.children[0]);
  // Clear buildings: remove physics bodies
  for (const child of buildingsGroup.children) {
    if (child.userData?.body) physicsWorld.removeBody(child.userData.body);
  }
  while (buildingsGroup.children.length) buildingsGroup.remove(buildingsGroup.children[0]);
  // Clear roads
  while (roadsGroup.children.length) roadsGroup.remove(roadsGroup.children[0]);

  // Map mix + sliders to world params
  WORLD.roadStep = Math.max(18, Math.round(18 + 12 * CONFIG.roadSpacing));
  const newExtent = Math.round(240 + 160 * CONFIG.world);
  if (newExtent !== WORLD.extent) {
    WORLD.extent = newExtent;
    // update ground size
    groundMesh.geometry.dispose();
    groundMesh.geometry = new THREE.PlaneGeometry(WORLD.extent * 2, WORLD.extent * 2);
    groundMesh.rotation.x = -Math.PI / 2;
  }
  WORLD.buildingDensity = Math.max(0, (0.75 - CONFIG.mix * 0.5) * CONFIG.buildings);
  WORLD.parkProbability = Math.min(0.8, 0.15 + CONFIG.mix * 0.5);
  WORLD.baseTreeCount = Math.floor(300 + CONFIG.trees * 1500);

  // Rebuild layers
  addRoadGrid(roadsGroup);
  addLaneStripes(roadsGroup);
  buildCityGrid(buildingsGroup, physicsWorld);
  addStreetLights(lightsGroup);
  plantTrees(treesGroup);

  // Respawn NPCs counts based on area
  const areaScale = (WORLD.extent * WORLD.extent) / (300*300);
  const CROWD_MULTIPLIER = 1000;
  const pedCount = Math.min(10000, Math.floor(30 * areaScale * CONFIG.people * CROWD_MULTIPLIER + 100));
  spawnPedestrians(pedCount);
  spawnCars(Math.floor(14 * areaScale * CONFIG.cars + 6));
  spawnAnimals(Math.floor(10 * areaScale * (1 - CONFIG.mix)));
}

uiSky?.addEventListener('input', (e) => { CONFIG.sky = e.target.value; rebuildWorld(); });
uiMix?.addEventListener('input', (e) => { CONFIG.mix = parseFloat(e.target.value); rebuildWorld(); });
uiBuildings?.addEventListener('input', (e) => { CONFIG.buildings = parseFloat(e.target.value); rebuildWorld(); });
uiTrees?.addEventListener('input', (e) => { CONFIG.trees = parseFloat(e.target.value); rebuildWorld(); });
uiPeople?.addEventListener('input', (e) => { CONFIG.people = parseFloat(e.target.value); rebuildWorld(); });
uiCars?.addEventListener('input', (e) => { CONFIG.cars = parseFloat(e.target.value); rebuildWorld(); });
document.getElementById('uiFog')?.addEventListener('input', (e) => { CONFIG.fog = parseFloat(e.target.value); rebuildWorld(); });
document.getElementById('uiAmbient')?.addEventListener('input', (e) => { CONFIG.ambient = parseFloat(e.target.value); rebuildWorld(); });
document.getElementById('uiSun')?.addEventListener('input', (e) => { CONFIG.sun = parseFloat(e.target.value); rebuildWorld(); });
document.getElementById('uiAccent')?.addEventListener('input', (e) => { CONFIG.accent = e.target.value; rebuildWorld(); });
document.getElementById('uiLights')?.addEventListener('input', (e) => { CONFIG.lights = parseFloat(e.target.value); rebuildWorld(); });
document.getElementById('uiRoad')?.addEventListener('input', (e) => { CONFIG.roadSpacing = parseFloat(e.target.value); rebuildWorld(); });
document.getElementById('uiWorld')?.addEventListener('input', (e) => { CONFIG.world = parseFloat(e.target.value); rebuildWorld(); });

// Sidebar toggle (button and hotkey H)
sidebarToggle?.addEventListener('click', () => {
  sidebarEl?.classList.toggle('collapsed');
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' && !((e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')))) {
    sidebarEl?.classList.toggle('collapsed');
  }
});

// (Removed pedestrian/car/animal spawners)

function addRoadGrid(group) {
  const roadMat = new THREE.MeshBasicMaterial({ color: 0x0d0f16 });
  const roadGeoX = new THREE.PlaneGeometry(WORLD.extent * 2, WORLD.laneHalf * 2 + 0.2);
  const roadGeoZ = new THREE.PlaneGeometry(WORLD.laneHalf * 2 + 0.2, WORLD.extent * 2);
  for (let i = -WORLD.extent; i <= WORLD.extent; i += WORLD.roadStep) {
    const r1 = new THREE.Mesh(roadGeoX, roadMat);
    r1.position.set(0, 0.001, i);
    r1.rotation.x = -Math.PI / 2;
    group.add(r1);

    const r2 = new THREE.Mesh(roadGeoZ, roadMat);
    r2.position.set(i, 0.001, 0);
    r2.rotation.x = -Math.PI / 2;
    group.add(r2);
  }
}

function addLaneStripes(group) {
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dashGeo = new THREE.PlaneGeometry(1.8, 0.12);
  for (let z = -WORLD.extent; z <= WORLD.extent; z += WORLD.roadStep) {
    for (let x = -WORLD.extent - 10; x <= WORLD.extent + 10; x += 4) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(x, 0.002, z - WORLD.laneHalf);
      dash.rotation.x = -Math.PI / 2;
      group.add(dash);
      const dash2 = dash.clone();
      dash2.position.z = z + WORLD.laneHalf;
      group.add(dash2);
    }
  }
  for (let x = -WORLD.extent; x <= WORLD.extent; x += WORLD.roadStep) {
    for (let z = -WORLD.extent - 10; z <= WORLD.extent + 10; z += 4) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = Math.PI / 2;
      dash.position.set(x - WORLD.laneHalf, 0.002, z);
      group.add(dash);
      const dash2 = dash.clone();
      dash2.position.x = x + WORLD.laneHalf;
      group.add(dash2);
    }
  }
}

// Procedural window texture cache
const windowTextureCache = new Map();
function getWindowTexture(cols, rows) {
  const key = `${cols}x${rows}`;
  if (windowTextureCache.has(key)) return windowTextureCache.get(key);
  const c = document.createElement('canvas');
  c.width = cols * 8; c.height = rows * 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c1726';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = Math.random() < 0.35;
      ctx.fillStyle = lit ? (Math.random() < 0.7 ? '#9ad7ff' : '#ffd27a') : '#0b1320';
      ctx.fillRect(x * 8 + 1, y * 8 + 1, 6, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  windowTextureCache.set(key, tex);
  return tex;
}

function makeBuilding(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const cols = Math.max(4, Math.round(w * 1.2));
  const rows = Math.max(6, Math.round(h * 0.9));
  const wnd = getWindowTexture(cols, rows);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x101b2d,
    metalness: 0.9,
    roughness: 0.28,
    map: wnd,
    emissive: 0x0a1730,
    emissiveMap: wnd,
    emissiveIntensity: 0.25
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Rooftop kitbash
  const roof = new THREE.Group();
  const ac = new THREE.Mesh(new THREE.BoxGeometry(w * (0.2 + Math.random()*0.2), 0.4, d * (0.2 + Math.random()*0.2)), new THREE.MeshStandardMaterial({ color: 0x1c2a3c, roughness: 0.8 }));
  ac.position.set((Math.random()-0.5)*w*0.3, h/2 + 0.25, (Math.random()-0.5)*d*0.3);
  roof.add(ac);
  if (Math.random() < 0.5) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x26384a }));
    antenna.position.set((Math.random()-0.5)*w*0.3, h/2 + 0.8, (Math.random()-0.5)*d*0.3);
    roof.add(antenna);
  }
  const group = new THREE.Group();
  mesh.position.y = h/2;
  group.add(mesh);
  group.add(roof);
  return group;
}

function buildCityGrid(group, world) {
  const accentMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.accent) });
  const cells = Math.floor((WORLD.extent * 2) / WORLD.roadStep);
  const maxBlocks = Math.floor(cells * cells * WORLD.buildingDensity);
  let count = 0;
  for (let x = -WORLD.extent; x <= WORLD.extent && count < maxBlocks; x += WORLD.roadStep) {
    for (let z = -WORLD.extent; z <= WORLD.extent && count < maxBlocks; z += WORLD.roadStep) {
      if (Math.random() < WORLD.parkProbability) {
        WORLD.parks.push({ x, z });
        continue;
      }
      const offsetX = x + (Math.random() * 10 - 5);
      const offsetZ = z + (Math.random() * 10 - 5);
      const w = 5 + Math.random() * 9;
      const d = 5 + Math.random() * 9;
      const h = 10 + Math.random() * 48;

      const b = makeBuilding(w, h, d);
      b.userData.type = 'building';
      b.position.set(offsetX, 0, offsetZ);
      group.add(b);

      const halfExtents = new CANNON.Vec3(w / 2, h / 2, d / 2);
      const shape = new CANNON.Box(halfExtents);
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(shape);
      body.position.set(offsetX, h / 2, offsetZ);
      world.addBody(body);
      b.userData.body = body;
      count++;

      if (Math.random() < 0.35) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.12, d * 1.02), accentMat);
        band.position.set(offsetX, h * (0.3 + Math.random() * 0.5), offsetZ);
        group.add(band);
      }
    }
  }
}

function addStreetLights(group) {
  const base = Math.floor((WORLD.extent / WORLD.roadStep) ** 2 * 16);
  const poleCount = Math.min(800, Math.max(0, Math.floor(base * CONFIG.lights)));
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1b2a3c, roughness: 0.8 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, poleCount);
  const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff });
  const heads = new THREE.InstancedMesh(headGeo, headMat, poleCount);
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let x = -WORLD.extent; x <= WORLD.extent; x += WORLD.roadStep) {
    for (let z = -WORLD.extent; z <= WORLD.extent; z += WORLD.roadStep) {
      if (i >= poleCount) break;
      // place at four corners near intersections offset to sidewalks
      const offsets = [
        [x - (WORLD.laneHalf + 1.8), z - (WORLD.laneHalf + 1.8)],
        [x + (WORLD.laneHalf + 1.8), z - (WORLD.laneHalf + 1.8)],
        [x - (WORLD.laneHalf + 1.8), z + (WORLD.laneHalf + 1.8)],
        [x + (WORLD.laneHalf + 1.8), z + (WORLD.laneHalf + 1.8)]
      ];
      for (const [px, pz] of offsets) {
        if (i >= poleCount) break;
        dummy.position.set(px, 1.6, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        poles.setMatrixAt(i, dummy.matrix);
        // head
        dummy.position.set(px, 3.2, pz);
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
  }
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  group.add(poles);
  group.add(heads);
}

function plantTrees(group) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9, metalness: 0.0 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x1a7c6c, emissive: 0x0a3c36, emissiveIntensity: 0.15 });
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.28, 1.4, 6);
  const crownGeo = new THREE.ConeGeometry(0.9, 1.6, 8);

  const nearRoad = (x, z) => (Math.abs(Math.round(x / WORLD.roadStep) * WORLD.roadStep - x) < (WORLD.laneHalf + 0.6)) || (Math.abs(Math.round(z / WORLD.roadStep) * WORLD.roadStep - z) < (WORLD.laneHalf + 0.6));

  let planted = 0;
  const total = WORLD.baseTreeCount;
  let tries = 0;
  while (planted < total && tries < total * 5) {
    tries++;
    const x = (Math.random() - 0.5) * WORLD.extent * 2;
    const z = (Math.random() - 0.5) * WORLD.extent * 2;
    if (nearRoad(x, z)) continue;
    const s = 0.6 + Math.random() * 1.6;
    const tree = new THREE.Group();
    tree.userData.type = 'tree';
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(0, 0.7 * s, 0);
    trunk.scale.set(0.7 * s, s, 0.7 * s);
    tree.add(trunk);
    const crowns = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < crowns; c++) {
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set((Math.random() - 0.5) * 0.3, 1.2 * s + c * 0.5 * s, (Math.random() - 0.5) * 0.3);
      crown.scale.setScalar(0.8 * s * (0.9 + Math.random() * 0.3));
      tree.add(crown);
    }
    tree.position.set(x, 0, z);
    group.add(tree);
    planted++;
  }

  for (const park of WORLD.parks) {
    const centerX = park.x + (Math.random() - 0.5) * 6;
    const centerZ = park.z + (Math.random() - 0.5) * 6;
    const radius = 4 + Math.random() * 8;
    const count = 20 + Math.floor(Math.random() * 40);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const x = centerX + Math.cos(a) * r;
      const z = centerZ + Math.sin(a) * r;
      if (nearRoad(x, z)) continue;
      const s = 0.8 + Math.random() * 1.4;
      const tree = new THREE.Group();
      tree.userData.type = 'tree';
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(0, 0.7 * s, 0);
      trunk.scale.set(0.7 * s, s, 0.7 * s);
      tree.add(trunk);
      const crowns = 1 + Math.floor(Math.random() * 3);
      for (let c = 0; c < crowns; c++) {
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set((Math.random() - 0.5) * 0.3, 1.2 * s + c * 0.5 * s, (Math.random() - 0.5) * 0.3);
        crown.scale.setScalar(0.8 * s * (0.9 + Math.random() * 0.3));
        tree.add(crown);
      }
      tree.position.set(x, 0, z);
      group.add(tree);
    }
  }
}

// Now that world builders are defined, create them
buildCityGrid(buildingsGroup, physicsWorld);
addStreetLights(lightsGroup);
plantTrees(treesGroup);

// ---------- Raycaster ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);

// ---------- Input ----------
// We retain raycasting for hovering over 3D choices when pointer is unlocked
renderer.domElement.addEventListener('pointermove', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
});
// no pointerup selection in city mode

// (hotbar removed)

// ---------- Player arm and punching (used for mining) ----------
const arm = createPlayerArm();
camera.add(arm);
let punchState = { active: false, t0: 0 };

renderer.domElement.addEventListener('click', (e) => {
  if (!isLocked) return;
  triggerPunch();
});
renderer.domElement.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

function createPlayerArm() {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a3a4a, metalness: 0.3, roughness: 0.7 }));
  upper.position.set(0.28, -0.28, -0.6);
  const fist = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0x364a5e, metalness: 0.3 }));
  fist.position.set(0.28, -0.28, -0.92);
  g.add(upper); g.add(fist);
  g.userData = { upper, fist, basePos: new THREE.Vector3(0.28, -0.28, -0.6), baseFist: new THREE.Vector3(0.28, -0.28, -0.92) };
  return g;
}

function triggerPunch() {
  if (punchState.active) return;
  punchState = { active: true, t0: performance.now() };
  // Perform hit test at mid-swing shortly after start
  setTimeout(() => doPunchHitTest(), 90);
}

function updateArm(dt) {
  if (!punchState.active) return;
  const elapsed = performance.now() - punchState.t0;
  const swingDuration = 280;
  const k = Math.min(1, elapsed / swingDuration);
  const ease = k < 0.5 ? (k * 2) : (1 - (k - 0.5) * 2);
  const up = arm.userData.upper; const fi = arm.userData.fist;
  up.position.set(0.28, -0.28, -0.6 - ease * 0.35);
  fi.position.set(0.28, -0.28, -0.92 - ease * 0.45);
  if (k >= 1) punchState.active = false;
}

function doPunchHitTest() {
  const dir = new THREE.Vector3();
  controls.getDirection(dir);
  raycaster.set(camera.position.clone(), dir.normalize());
  // Intersect everything in worldGroup
  const hits = raycaster.intersectObjects(worldGroup.children, true);
  if (!hits.length) return;
  const hit = hits[0].object;
  let node = hit;
  while (node && !node.userData?.type) node = node.parent;
  if (!node) return;
  const t = node.userData.type;
  if (t === 'pedestrian' || t === 'animal') {
    if (!node.userData.recoil) node.userData.recoil = new THREE.Vector3();
    node.userData.recoil.add(dir.clone().setLength(4.5));
  }
}

// ---------- Chat with NPCs ----------
const chatOverlay = document.getElementById('chatOverlay');
const chatNameEl = document.getElementById('chatName');
const chatLog = document.getElementById('chatLog');
const chatText = document.getElementById('chatText');
const chatSend = document.getElementById('chatSend');
const chatClose = document.getElementById('chatClose');
const chatHintEl = document.getElementById('chatHint');

let activeNPC = null;
let conversations = new Map();

function getLookAtPedestrian() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = raycaster.intersectObjects(npcsGroup.children, true);
  for (const h of hits) {
    let n = h.object;
    while (n && !n.userData?.type) n = n.parent;
    if (n && n.userData.type === 'pedestrian') return n;
  }
  return null;
}

function randomPersona(seed) {
  const names = ['Riven', 'Mara', 'Nyx', 'Juno', 'Kade', 'Ori', 'Vex', 'Sol', 'Lumen', 'Echo'];
  const roles = ['data courier', 'street artist', 'tower analyst', 'market broker', 'drone wrangler', 'sound designer'];
  const quirks = ['collects obsolete chips', 'speaks in haikus', 'never rides elevators', 'tracks sunsets', 'sketches strangers', 'counts footsteps'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return { name: pick(names), role: pick(roles), quirk: pick(quirks), seed };
}

function openChat(npc) {
  if (!npc) return;
  activeNPC = npc;
  controls.unlock();
  if (!npc.userData.persona) npc.userData.persona = randomPersona(Math.floor(Math.random() * 1e9));
  chatNameEl.textContent = `${npc.userData.persona.name} — ${npc.userData.persona.role}`;
  chatOverlay.style.display = 'grid';
  chatLog.innerHTML = '';
  const npcId = npc.uuid;
  if (!conversations.has(npcId)) conversations.set(npcId, []);
  requestChat(npcId, npc.userData.persona, conversations.get(npcId)).then(text => {
    appendMsg('npc', text);
  });
  setTimeout(() => chatText?.focus(), 50);
}

function closeChat() {
  chatOverlay.style.display = 'none';
  activeNPC = null;
  if (!isLocked) controls.lock();
}

function appendMsg(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role === 'user' ? 'me' : 'npc'}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function requestChat(npcId, persona, history, userText) {
  const messages = history.slice();
  if (userText) messages.push({ role: 'user', content: userText });
  const res = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npcId, personaSeed: JSON.stringify(persona), messages })
  });
  const data = await res.json();
  const reply = data?.text || '...';
  if (userText) messages.push({ role: 'assistant', content: reply });
  conversations.set(npcId, messages);
  return reply;
}

chatClose?.addEventListener('click', closeChat);
chatSend?.addEventListener('click', async () => {
  if (!activeNPC) return;
  const txt = chatText.value.trim();
  if (!txt) return;
  chatText.value = '';
  appendMsg('user', txt);
  const npcId = activeNPC.uuid;
  const reply = await requestChat(npcId, activeNPC.userData.persona, conversations.get(npcId), txt);
  appendMsg('npc', reply);
});

window.addEventListener('keydown', (e) => {
  const chatOpen = chatOverlay && chatOverlay.style.display !== 'none';
  const isTyping = chatOpen || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable));
  if (e.code === 'KeyE' && !chatOpen) {
    let npc = getLookAtPedestrian();
    if (!npc) npc = findNearbyPedestrian();
    if (npc) openChat(npc);
  } else if (e.code === 'Escape' && chatOpen) {
    closeChat();
  } else if (e.code === 'Enter' && chatOpen) {
    chatSend.click();
  } else if (isTyping) {
    // Do not capture movement keys while typing
    return;
  }
});

function findNearbyPedestrian() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  let best = null; let bestScore = Infinity;
  for (const p of pedestrians) {
    const to = new THREE.Vector3().subVectors(p.position, camera.position);
    const dist = to.length();
    if (dist > 6 || dist < 0.4) continue; // within 0.4-6m
    to.y = 0; to.normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(forward.dot(to), -1, 1));
    if (angle < (25 * Math.PI / 180)) {
      const score = dist + angle * 2;
      if (score < bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}

// ---------- Resize ----------
window.addEventListener('resize', onResize);
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------- First-person controls + physics ----------
const controls = new PointerLockControls(camera, renderer.domElement);
let isLocked = false;
controls.addEventListener('lock', () => { isLocked = true; rootHtml.classList.add('locked'); });
controls.addEventListener('unlock', () => { isLocked = false; rootHtml.classList.remove('locked'); });

startBtn?.addEventListener('click', () => {
  controls.lock();
});
// Also lock on canvas click
renderer.domElement.addEventListener('mousedown', () => {
  if (!isLocked) controls.lock();
});

// Player physics body
const playerRadius = 0.5;
const eyeHeight = 1.65;
const playerBody = new CANNON.Body({ mass: 1, material: playerMat, angularDamping: 1.0 });
playerBody.addShape(new CANNON.Sphere(playerRadius));
playerBody.position.set(0, eyeHeight, 8);
playerBody.fixedRotation = true;
playerBody.updateMassProperties();
physicsWorld.addBody(playerBody);

let onGround = false;
playerBody.addEventListener('collide', (e) => {
  // Check if we hit ground-ish by normal direction
  const contact = e.contact;
  if (!contact) return;
  const normal = contact.ni.clone();
  // Contact normal is from bi to bj; flip if needed
  if (contact.bi.id === playerBody.id) normal.negate(normal);
  if (normal.y > 0.5) onGround = true;
});

const keyState = { forward: false, backward: false, left: false, right: false, jump: false };
window.addEventListener('keydown', (e) => {
  const chatOpen = chatOverlay && chatOverlay.style.display !== 'none';
  const isTyping = chatOpen || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable));
  const isMoveKey = ['KeyW','ArrowUp','KeyA','ArrowLeft','KeyS','ArrowDown','KeyD','ArrowRight','Space'].includes(e.code);

  // If typing in any input, ignore all gameplay keys entirely
  if (isTyping) return;

  if (!isLocked) {
    // Auto-lock on movement intent only when not typing
    if (isMoveKey) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      controls.lock();
    }
  }
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keyState.forward = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keyState.backward = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keyState.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keyState.right = true;
  if (e.code === 'Space') keyState.jump = true;
});
window.addEventListener('keyup', (e) => {
  const chatOpen = chatOverlay && chatOverlay.style.display !== 'none';
  const isTyping = chatOpen || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable));
  if (isTyping) return;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keyState.forward = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keyState.backward = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keyState.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keyState.right = false;
  if (e.code === 'Space') keyState.jump = false;
});

function updatePlayerPhysics(dt) {
  const speed = 7.2;
  const vxz = new THREE.Vector3();
  const dir = new THREE.Vector3();

  // Camera orientation gives movement direction
  controls.getDirection(dir);
  dir.y = 0;
  dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();

  if (keyState.forward) vxz.add(dir);
  if (keyState.backward) vxz.sub(dir);
  if (keyState.left) vxz.sub(right);
  if (keyState.right) vxz.add(right);
  if (vxz.lengthSq() > 0) vxz.normalize().multiplyScalar(speed);

  // Apply desired velocity on XZ, keep Y from physics
  playerBody.velocity.x = vxz.x;
  playerBody.velocity.z = vxz.z;

  if (keyState.jump && onGround) {
    playerBody.velocity.y = 6.5;
    onGround = false;
  }
}

// (voxel surface removed; restoring city environment)

// ---------- Render loop ----------
const clock = new THREE.Clock();
function render() {
  const dt = clock.getDelta();

  if (isLocked) {
    updatePlayerPhysics(dt);
    physicsWorld.step(1 / 60, dt, 8);
    // Sync camera to player body
    const pos = playerBody.position;
    camera.position.set(pos.x, pos.y, pos.z);
  }

  // NPC updates
  updatePedestrians(dt);
  updateCars(dt);
  updateAnimals(dt);
  // Arm update
  updateArm(dt);

  // Rain update
  if (rainSystem) {
    const pos = rainSystem.geometry.attributes.position;
    const speed = rainSystem.geometry.attributes.speed;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] -= speed.array[i] * dt;
      if (pos.array[i * 3 + 1] < 0) {
        pos.array[i * 3 + 1] = 60 + Math.random() * 20;
        pos.array[i * 3 + 0] = camera.position.x + (Math.random() - 0.5) * 200;
        pos.array[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * 200;
      }
    }
    pos.needsUpdate = true;
  }

  // no camera tween

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

// (chat hint and duplicate modal handlers removed - using main chat overlay handlers above)

function updatePedestrians(dt) {
  for (const p of pedestrians) {
    const v = p.userData.v;
    p.position.x += v.x * dt;
    p.position.z += v.z * dt;
    // Wrap around city bounds and randomly change direction
    if (p.position.x < -300 || p.position.x > 300) v.x *= -1;
    if (p.position.z < -300 || p.position.z > 300) v.z *= -1;
    if (Math.random() < 0.003) {
      v.x = (Math.random() - 0.5) * 1.2;
      v.z = (Math.random() - 0.5) * 1.2;
    }
    // Face movement direction
    if (v.lengthSq() > 0.001) p.rotation.y = Math.atan2(v.x, v.z);
    // Walk cycle
    p.userData.walkPhase = (p.userData.walkPhase || 0) + dt * 6 * (0.5 + v.length());
    const s = Math.sin(p.userData.walkPhase) * 0.4;
    const c = Math.cos(p.userData.walkPhase) * 0.4;
    const parts = p.userData.parts;
    if (parts) {
      parts.legL.rotation.x = s * 0.5;
      parts.legR.rotation.x = -s * 0.5;
      parts.armL.rotation.x = -c * 0.4;
      parts.armR.rotation.x = c * 0.4;
    }
    // Simple hit recoil decay
    if (p.userData.recoil) {
      p.position.addScaledVector(p.userData.recoil, dt);
      p.userData.recoil.multiplyScalar(0.9);
      if (p.userData.recoil.length() < 0.05) p.userData.recoil = null;
    }
  }
}

function updateCars(dt) {
  for (const c of cars) {
    if (c.userData.alongX) {
      c.position.x += c.userData.speed * dt * (c.userData.dir || 1);
      c.rotation.y = c.userData.dir === -1 ? Math.PI : 0;
      if (c.position.x > 320) { c.position.x = -320; c.userData.dir = 1; }
      if (c.position.x < -320) { c.position.x = 320; c.userData.dir = -1; }
    } else {
      c.position.z += c.userData.speed * dt * (c.userData.dir || 1);
      c.rotation.y = c.userData.dir === -1 ? -Math.PI/2 : Math.PI/2;
      if (c.position.z > 320) { c.position.z = -320; c.userData.dir = 1; }
      if (c.position.z < -320) { c.position.z = 320; c.userData.dir = -1; }
    }
    // Wheel spin
    if (c.userData.wheels) {
      const spin = c.userData.speed * dt * 2.5;
      for (const w of c.userData.wheels) w.rotation.x += spin;
    }
  }
}

function updateAnimals(dt) {
  for (const a of animals) {
    const v = a.userData.v;
    a.userData.wander += dt;
    if (a.userData.wander > 2.5) {
      a.userData.wander = 0;
      v.x = (Math.random() - 0.5) * 1.2;
      v.z = (Math.random() - 0.5) * 1.2;
    }
    a.position.x += v.x * dt;
    a.position.z += v.z * dt;
    if (a.position.x < -300 || a.position.x > 300) v.x *= -1;
    if (a.position.z < -300 || a.position.z > 300) v.z *= -1;
    if (v.lengthSq() > 0.001) a.rotation.y = Math.atan2(v.x, v.z);
    if (a.userData.recoil) {
      a.position.addScaledVector(a.userData.recoil, dt);
      a.userData.recoil.multiplyScalar(0.9);
      if (a.userData.recoil.length() < 0.05) a.userData.recoil = null;
    }
  }
}

function setHover(mesh, isHover) {
  if (!mesh || interactiveLocked) return;
  const group = mesh.parent?.userData?.mesh ? mesh.parent : mesh;
  const labelMesh = group.userData.mesh || group;
  const mat = labelMesh.material;
  if (mat && 'emissiveIntensity' in mat) {
    mat.emissiveIntensity = isHover ? 0.5 : 0.18;
  }
  const targetScale = isHover ? 1.15 : 1.0;
  group.scale.set(targetScale, targetScale, targetScale);
  if (isHover) showChoiceTooltip(group); else hideChoiceTooltip();
}

function showChoiceTooltip(targetGroup) {
  const choice = targetGroup.userData.choice;
  if (!choice) return;
  const title = choice.text;
  const desc = choice.desc || choice.text;
  tooltipEl.innerHTML = `<h4>${title}</h4><p>${desc}</p>`;
  tooltipEl.style.display = 'block';
  updateTooltipPosition(targetGroup);
}
function hideChoiceTooltip() {
  tooltipEl.style.display = 'none';
}
function updateTooltipPosition(targetGroup) {
  if (tooltipEl.style.display === 'none') return;
  const target = (hoverTarget?.object?.parent?.userData?.mesh ? hoverTarget.object.parent : hoverTarget?.object) || targetGroup;
  if (!target) return;
  const pos = new THREE.Vector3();
  target.getWorldPosition(pos);
  pos.y += 0.5;
  pos.project(camera);
  const sx = (pos.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-pos.y * 0.5 + 0.5) * window.innerHeight;
  tooltipEl.style.left = `${sx + 12}px`;
  tooltipEl.style.top = `${sy - 12}px`;
}

requestAnimationFrame(render);


// ---------- Dynamic Environment: time-of-day & weather ----------
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 8;
skyUniforms['rayleigh'].value = 1.2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

const weatherPresets = ['day_clear', 'dusk_overcast', 'night_clear', 'night_rain', 'morning_fog'];
const chosenPreset = weatherPresets[Math.floor(Math.random() * weatherPresets.length)];
let rainSystem = null;
applyWeatherPreset(chosenPreset);

function applyWeatherPreset(preset) {
  // Remove rain if present
  if (rainSystem) {
    scene.remove(rainSystem);
    rainSystem.geometry.dispose();
    rainSystem.material.dispose();
    rainSystem = null;
  }
  switch (preset) {
    case 'day_clear': {
      const phi = THREE.MathUtils.degToRad(90 - 60);
      const theta = THREE.MathUtils.degToRad(180 * 0.2);
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(sun);
      ambient.intensity = 0.5;
      keyLight.intensity = 1.0;
      scene.fog.density = 0.012;
      break;
    }
    case 'dusk_overcast': {
      skyUniforms['turbidity'].value = 12;
      skyUniforms['rayleigh'].value = 0.6;
      skyUniforms['mieCoefficient'].value = 0.02;
      const phi = THREE.MathUtils.degToRad(90 - 20);
      const theta = THREE.MathUtils.degToRad(180 * 0.8);
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(sun);
      ambient.intensity = 0.35;
      keyLight.intensity = 0.6;
      scene.fog.density = 0.02;
      break;
    }
    case 'night_clear': {
      skyUniforms['rayleigh'].value = 0.2;
      skyUniforms['mieCoefficient'].value = 0.003;
      const phi = THREE.MathUtils.degToRad(90 - 5);
      const theta = THREE.MathUtils.degToRad(180 * 0.05);
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(sun);
      ambient.intensity = 0.18;
      keyLight.intensity = 0.15;
      scene.fog.density = 0.03;
      break;
    }
    case 'night_rain': {
      skyUniforms['rayleigh'].value = 0.15;
      skyUniforms['mieCoefficient'].value = 0.02;
      const phi = THREE.MathUtils.degToRad(90 - 8);
      const theta = THREE.MathUtils.degToRad(180 * 0.1);
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(sun);
      ambient.intensity = 0.22;
      keyLight.intensity = 0.1;
      scene.fog.density = 0.048;
      rainSystem = createRain();
      scene.add(rainSystem);
      break;
    }
    case 'morning_fog': {
      skyUniforms['rayleigh'].value = 1.6;
      const phi = THREE.MathUtils.degToRad(90 - 12);
      const theta = THREE.MathUtils.degToRad(180 * 0.25);
      const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
      skyUniforms['sunPosition'].value.copy(sun);
      ambient.intensity = 0.42;
      keyLight.intensity = 0.55;
      scene.fog.density = 0.06;
      break;
    }
  }
}

function createRain() {
  const count = 4000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = Math.random() * 60 + 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    speeds[i] = 30 + Math.random() * 40;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
  const mat = new THREE.PointsMaterial({ color: 0x9ecbff, size: 0.05, transparent: true, opacity: 0.8 });
  return new THREE.Points(geo, mat);
}
