import * as THREE from 'three';
import {
  createGravelTextures,
  createSandstoneTextures,
  createBoulderTextures,
  createContactShadowMaterial,
} from '../materials/studioMaterials.js';

function createRng(seed = 88421) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Defines an asymmetric, organic pebble-island perimeter contour matching 基准图.png.
 * Coordinates are (x, z) in world space with +Z facing camera.
 */
export function getIslandOutlineCurve() {
  const pts = [
    new THREE.Vector3(-0.65, 0, 6.45),   // front foreground stepping-stone cove
    new THREE.Vector3(2.25, 0, 6.20),
    new THREE.Vector3(5.05, 0, 5.15),    // front-right boulder bend
    new THREE.Vector3(7.35, 0, 3.35),    // right patio/cypress corner
    new THREE.Vector3(8.25, 0, 1.15),
    new THREE.Vector3(7.70, 0, -1.65),
    new THREE.Vector3(6.65, 0, -4.35),
    new THREE.Vector3(4.15, 0, -5.85),   // rear-right trees
    new THREE.Vector3(0.40, 0, -6.45),   // rear conifers
    new THREE.Vector3(-3.85, 0, -6.15),
    new THREE.Vector3(-6.85, 0, -4.55),  // rear-left flank
    new THREE.Vector3(-8.20, 0, -1.75),
    new THREE.Vector3(-8.15, 0, 1.35),   // left hero tree bed
    new THREE.Vector3(-6.75, 0, 3.65),
    new THREE.Vector3(-4.65, 0, 5.25),   // front-left rock/fern cove
    new THREE.Vector3(-2.65, 0, 6.05),
  ];
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.45);
}

/**
 * Generates an organic multi-ring island mound mesh with beveled soil/gravel perimeter
 * tapering softly to y = 0.0 (no blocky rectangular plinth).
 */
function buildOrganicIslandGeometry(curve) {
  const angSegs = 180;
  const radSegs = 18;
  const outlinePts = curve.getSpacedPoints(angSegs);

  const center = new THREE.Vector3(0.0, 0.0, 0.0);
  for (let i = 0; i < angSegs; i++) {
    center.add(outlinePts[i]);
  }
  center.divideScalar(angSegs);
  center.y = 0;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r <= radSegs; r++) {
    const t = r / radSegs; // 0 at center, 1 at perimeter
    for (let a = 0; a <= angSegs; a++) {
      const idx = a % angSegs;
      const p = outlinePts[idx];
      const ang = (idx / angSegs) * Math.PI * 2;

      // Subtle organic scallop perturbation along perimeter
      const edgeWobble =
        Math.sin(ang * 11.0 + 0.5) * 0.14 +
        Math.cos(ang * 19.0 - 0.8) * 0.08;
      const edgeScale = 1.0 + edgeWobble * t * 0.45;

      const x = THREE.MathUtils.lerp(center.x, p.x * edgeScale, t);
      const z = THREE.MathUtils.lerp(center.z, p.z * edgeScale, t);

      // Gentle architectural mound: flatter under building/courtyard, rising subtly in rear/side garden beds
      const baseHeight = 0.21;
      const gardenLift =
        Math.max(0, -z * 0.025) +
        (Math.abs(x) > 4.3 ? (Math.abs(x) - 4.3) * 0.045 : 0);
      const ripple =
        Math.sin(x * 0.85 + z * 0.65) * 0.022 +
        Math.cos(x * 1.4 - z * 1.1) * 0.015;

      // Smooth edge bevel tapering down to y = 0.005 on outer 14%
      const rimFalloff = t > 0.86 ? 1.0 - THREE.MathUtils.smoothstep(t, 0.86, 1.0) : 1.0;
      const edgeLip = t > 0.86 && t < 0.99 ? Math.sin(((t - 0.86) / 0.13) * Math.PI) * 0.03 : 0.0;
      const y = Math.max(0.004, (baseHeight + gardenLift * (1.0 - t * 0.45) + ripple * (1.0 - t * 0.7)) * rimFalloff + edgeLip);

      positions.push(x, y, z);
      // Planar top UVs avoid polar pinching
      uvs.push(x * 0.12 + 0.5, z * 0.12 + 0.5);
    }
  }

  const stride = angSegs + 1;
  for (let r = 0; r < radSegs; r++) {
    for (let a = 0; a < angSegs; a++) {
      const i0 = r * stride + a;
      const i1 = i0 + 1;
      const i2 = (r + 1) * stride + a;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an organic faceted boulder geometry with flattened bottom & sedimentary creases.
 */
function createBoulderGeometry(radius, seed) {
  const geo = new THREE.IcosahedronGeometry(radius, 3);
  const pos = geo.attributes.position;
  const rng = createRng(seed);
  const p1 = rng() * 10;
  const p2 = rng() * 10;
  const sx = 1.08 + rng() * 0.42;
  const sy = 0.56 + rng() * 0.26;
  const sz = 0.88 + rng() * 0.36;

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n1 = Math.sin(v.x * 2.1 + p1) * Math.cos(v.z * 2.3 + p2);
    const n2 = Math.sin(v.y * 3.8 - p1) * Math.sin((v.x + v.z) * 2.1);
    const strata = Math.abs(Math.sin(v.y * 5.2 + p2)) * -0.055;
    const disp = 1.0 + n1 * 0.18 + n2 * 0.10 + strata;
    v.multiplyScalar(disp);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    if (v.y < -radius * 0.18) {
      v.y = -radius * 0.18 + (v.y + radius * 0.18) * 0.22;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an irregular beveled oval/organic stepping stone slab.
 */
function createSteppingStoneMesh(rx, rz, height, seed, material) {
  const rng = createRng(seed);
  const shape = new THREE.Shape();
  const segs = 28;
  const phase = rng() * Math.PI * 2;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const wobble = 1.0 + Math.sin(a * 3 + phase) * 0.075 + Math.cos(a * 5 - phase) * 0.04;
    const x = Math.cos(a) * rx * wobble;
    const y = Math.sin(a) * rz * wobble;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.rotateX(-Math.PI / 2);

  // Planar stone UVs
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) * 0.45 + 0.5, pos.getZ(i) * 0.45 + 0.5);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates a sleek architectural warm wooden/bronze bollard garden light.
 */
function createGardenBollard(bronzeMat, bulbMat, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Plinth & lower body
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.16), bronzeMat);
  lower.position.y = 0.14;
  lower.castShadow = true;
  lower.receiveShadow = true;
  g.add(lower);

  // Frosted glowing amber lantern core
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.22, 0.125), bulbMat);
  core.position.y = 0.38;
  g.add(core);

  // Four slim vertical corner ribs
  for (const sx of [-0.072, 0.072]) {
    for (const sz of [-0.072, 0.072]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.018), bronzeMat);
      post.position.set(sx, 0.38, sz);
      g.add(post);
    }
  }

  // Top overhang cap
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.038, 0.18), bronzeMat);
  cap.position.y = 0.51;
  cap.castShadow = true;
  g.add(cap);

  // Subtle warm local bounce light on surrounding gravel/leaves
  const light = new THREE.PointLight('#ffac48', 2.2, 4.4, 1.55);
  light.position.set(0, 0.40, 0);
  g.add(light);

  return g;
}

export function createIslandBase() {
  const group = new THREE.Group();
  group.name = 'OrganicIslandBase';

  const outlineCurve = getIslandOutlineCurve();

  // 1. Studio Ground Contact Shadow Ellipse under the whole island
  const islandShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(21.5, 18.0),
    createContactShadowMaterial({ opacity: 0.30, roundness: 0.78 })
  );
  islandShadow.rotation.x = -Math.PI / 2;
  islandShadow.position.set(0, 0.002, 0.1);
  group.add(islandShadow);

  // 2. Organic Crushed Gravel Island Bed
  const gravelTex = createGravelTextures();
  const gravelMat = new THREE.MeshStandardMaterial({
    map: gravelTex.map,
    bumpMap: gravelTex.bumpMap,
    bumpScale: 0.045,
    color: new THREE.Color('#c8ccd2'),
    roughness: 0.90,
    metalness: 0.05,
    envMapIntensity: 0.35,
  });

  const islandGeo = buildOrganicIslandGeometry(outlineCurve);
  const islandMesh = new THREE.Mesh(islandGeo, gravelMat);
  islandMesh.receiveShadow = true;
  islandMesh.castShadow = true;
  group.add(islandMesh);

  // 3. Sculpted Perimeter Boulders framing the organic border
  const boulderTex = createBoulderTextures();
  const boulderMat = new THREE.MeshStandardMaterial({
    map: boulderTex.map,
    bumpMap: boulderTex.bumpMap,
    bumpScale: 0.04,
    color: new THREE.Color('#b6aba0'),
    roughness: 0.88,
    metalness: 0.03,
    envMapIntensity: 0.32,
  });

  // Curated hero & accent boulders placed cleanly along edge contour (matching 基准图.png foreground boulders!)
  const boulderSpecs = [
    // Prominent foreground boulders
    { pos: [-4.45, 0.16, 4.95], r: 0.68, rotY: 0.4, seed: 101 },
    { pos: [-5.75, 0.15, 4.05], r: 0.56, rotY: 1.2, seed: 102 },
    { pos: [-7.05, 0.18, 2.55], r: 0.72, rotY: 2.1, seed: 103 },
    { pos: [-7.85, 0.19, 0.95], r: 0.62, rotY: 0.8, seed: 104 },
    { pos: [-7.95, 0.21, -0.75], r: 0.52, rotY: 1.9, seed: 105 },
    { pos: [-7.45, 0.21, -2.55], r: 0.60, rotY: 2.7, seed: 106 },

    // Front center-left / center-right framing stones
    { pos: [-2.70, 0.15, 4.35], r: 0.32, rotY: 0.5, seed: 107 },
    { pos: [1.75, 0.14, 5.75], r: 0.58, rotY: -0.4, seed: 108 },
    { pos: [4.75, 0.16, 4.75], r: 0.65, rotY: 0.9, seed: 109 },
    { pos: [6.45, 0.17, 3.65], r: 0.58, rotY: 1.7, seed: 110 },
    { pos: [7.65, 0.18, 2.15], r: 0.54, rotY: -1.1, seed: 111 },
    { pos: [7.85, 0.19, 0.15], r: 0.48, rotY: 0.3, seed: 112 },
    { pos: [7.15, 0.20, -2.25], r: 0.52, rotY: 2.2, seed: 113 },

    // Side courtyard accent stones + rear perimeter stones
    { pos: [3.45, 0.24, 1.55], r: 0.36, rotY: 0.6, seed: 114 },
    { pos: [-6.15, 0.22, -4.45], r: 0.54, rotY: 1.4, seed: 115 },
    { pos: [-3.95, 0.24, -5.65], r: 0.58, rotY: 2.8, seed: 116 },
    { pos: [-1.45, 0.24, -6.05], r: 0.50, rotY: 0.9, seed: 117 },
    { pos: [1.35, 0.24, -6.05], r: 0.52, rotY: 1.9, seed: 118 },
    { pos: [3.95, 0.24, -5.45], r: 0.55, rotY: 0.4, seed: 119 },
    { pos: [5.95, 0.22, -4.15], r: 0.50, rotY: 2.5, seed: 120 },
  ];

  boulderSpecs.forEach((b) => {
    const geo = createBoulderGeometry(b.r, b.seed);
    const rock = new THREE.Mesh(geo, boulderMat);
    rock.position.set(b.pos[0], b.pos[1], b.pos[2]);
    rock.rotation.y = b.rotY;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });

  // 4. Instanced 3D Crushed Edge Pebbles (~900 actual mini-stones along border & beds)
  const pebbleGeo = new THREE.IcosahedronGeometry(0.085, 0);
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4d535c'),
    roughness: 0.85,
    metalness: 0.06,
    envMapIntensity: 0.35,
  });
  const pebbleCount = 950;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  pebbles.castShadow = true;
  pebbles.receiveShadow = true;

  const rng = createRng(55109);
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const centerVec = new THREE.Vector3(0, 0, 0);

  for (let i = 0; i < pebbleCount; i++) {
    const u = rng();
    const edgePt = outlineCurve.getPointAt(u);
    // Concentrate pebbles around rim (t ~ 0.78..0.98) and central path vicinity
    const radialT = i < 700 ? 0.76 + rng() * 0.23 : 0.22 + rng() * 0.65;
    const px = THREE.MathUtils.lerp(centerVec.x, edgePt.x, radialT) + (rng() - 0.5) * 0.35;
    const pz = THREE.MathUtils.lerp(centerVec.z, edgePt.z, radialT) + (rng() - 0.5) * 0.35;
    const py = radialT > 0.88 ? THREE.MathUtils.lerp(0.20, 0.04, (radialT - 0.88) / 0.12) : 0.22;

    dummy.position.set(px, py, pz);
    dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    const sc = 0.65 + rng() * 1.15;
    dummy.scale.set(sc * (0.9 + rng() * 0.4), sc * (0.42 + rng() * 0.3), sc * (0.85 + rng() * 0.4));
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);

    const shade = 0.48 + rng() * 0.55;
    cTmp.setRGB(shade * 0.88, shade * 0.92, shade);
    pebbles.setColorAt(i, cTmp);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  group.add(pebbles);

  // 5. Curved Warm Sandstone Stepping Stones & Entrance Steps
  const sandstoneTex = createSandstoneTextures();
  const sandstoneMat = new THREE.MeshStandardMaterial({
    map: sandstoneTex.map,
    bumpMap: sandstoneTex.bumpMap,
    bumpScale: 0.025,
    color: new THREE.Color('#eae0cd'),
    roughness: 0.82,
    metalness: 0.02,
    envMapIntensity: 0.36,
  });

  // 3 Wide Architectural Limestone Entrance Steps in front of storefront doors
  const stepSpecs = [
    { x: 0.42, y: 0.24, z: 1.05, w: 2.35, h: 0.10, d: 1.05 },
    { x: 0.42, y: 0.33, z: 0.88, w: 2.25, h: 0.10, d: 0.72 },
    { x: 0.42, y: 0.42, z: 0.70, w: 2.15, h: 0.10, d: 0.42 },
  ];
  stepSpecs.forEach((st) => {
    const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.d), sandstoneMat);
    stepMesh.position.set(st.x, st.y, st.z);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    group.add(stepMesh);
  });

  // 7 Winding Stepping Stones tapering from big foreground oval stone up to steps
  const stones = [
    { x: -0.75, z: 5.25, rx: 1.06, rz: 0.66, rot: 0.08, seed: 201 },
    { x: 0.08, z: 4.18, rx: 0.84, rz: 0.52, rot: -0.06, seed: 202 },
    { x: 0.62, z: 3.30, rx: 0.76, rz: 0.46, rot: 0.12, seed: 203 },
    { x: 0.88, z: 2.52, rx: 0.68, rz: 0.42, rot: -0.05, seed: 204 },
    { x: 0.52, z: 1.88, rx: 0.62, rz: 0.38, rot: 0.04, seed: 205 },
  ];
  stones.forEach((s) => {
    const mesh = createSteppingStoneMesh(s.rx, s.rz, 0.075, s.seed, sandstoneMat);
    mesh.position.set(s.x, 0.215, s.z);
    mesh.rotation.y = s.rot;
    group.add(mesh);
  });

  // 6. Subtle Dark Slate Patio Terrace Pad beneath outdoor bistro umbrella/table
  const patioGeo = new THREE.CylinderGeometry(1.75, 1.85, 0.08, 32);
  const patioMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4f535a'),
    bumpMap: sandstoneTex.bumpMap,
    bumpScale: 0.015,
    roughness: 0.85,
    metalness: 0.04,
    envMapIntensity: 0.32,
  });
  const patioPad = new THREE.Mesh(patioGeo, patioMat);
  patioPad.position.set(5.15, 0.22, 2.35);
  patioPad.scale.set(1.08, 1.0, 0.94);
  patioPad.receiveShadow = true;
  group.add(patioPad);

  // 7. Four Warm Rectangular Timber/Bronze Path Bollards
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3a3029'),
    roughness: 0.48,
    metalness: 0.42,
    envMapIntensity: 0.75,
  });
  const bollardBulbMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff5dc'),
    emissive: new THREE.Color('#ffb54d'),
    emissiveIntensity: 6.2,
    roughness: 0.22,
  });

  const bollardCoords = [
    [-4.85, 0.22, 3.85],   // Front-left fern/hosta rock
    [-1.42, 0.22, 1.95],   // Left entrance step guard
    [2.18, 0.22, 1.90],    // Right entrance step guard
    [6.65, 0.22, 2.95],    // Near right boulder/patio edge (tucked naturally)
  ];
  bollardCoords.forEach(([x, y, z]) => {
    group.add(createGardenBollard(bronzeMat, bollardBulbMat, x, y, z));
  });

  return {
    group,
    outlineCurve,
  };
}
