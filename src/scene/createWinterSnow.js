import * as THREE from 'three';
import { createSnowTextures } from '../materials/studioMaterials.js';

function createRng(seed = 20261201) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash2D(x, z, seed = 13.7) {
  return (
    Math.sin(x * 1.43 + z * 1.91 + seed) * 0.55 +
    Math.cos(x * 2.71 - z * 2.13 + seed * 1.7) * 0.30 +
    Math.sin(x * 4.35 + z * 3.87 - seed * 0.9) * 0.15
  );
}

/**
 * Ensures a triangle index triple produces an outward/upward (+Y) normal in Y-up coordinates.
 */
function pushOrientedTri(verts, indices, ia, ib, ic, desiredSignY = 1) {
  const ax = verts[ia * 3];
  const ay = verts[ia * 3 + 1];
  const az = verts[ia * 3 + 2];
  const bx = verts[ib * 3];
  const by = verts[ib * 3 + 1];
  const bz = verts[ib * 3 + 2];
  const cx = verts[ic * 3];
  const cy = verts[ic * 3 + 1];
  const cz = verts[ic * 3 + 2];

  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  const ny = uz * vx - ux * vz;

  if (ny * desiredSignY >= 0) {
    indices.push(ia, ib, ic);
  } else {
    indices.push(ia, ic, ib);
  }
  void uy;
  void vy;
}

/**
 * Builds a single organic quilted snow pillow geometry whose local Y=0 rests cleanly on a horizontal
 * surface while upper undulating snow mounds and scalloped overhanging rims curve softly downward.
 */
function createPillowedSlabGeometry({
  width,
  depth,
  thickness = 0.28,
  overhang = 0.08,
  nx = 26,
  nz = 22,
  droop = 0.12,
  seed = 11,
}) {
  const fullW = width + overhang * 2;
  const fullD = depth + overhang * 2;
  const geo = new THREE.BoxGeometry(fullW, thickness, fullD, nx, 5, nz);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const halfW = fullW * 0.5;
  const halfD = fullD * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const nxu = THREE.MathUtils.clamp(vx / halfW, -1, 1);
    const nzu = THREE.MathUtils.clamp(vz / halfD, -1, 1);
    const ty = THREE.MathUtils.clamp((vy + thickness * 0.5) / thickness, 0, 1);

    const edgeDist = Math.min(1 - Math.abs(nxu), 1 - Math.abs(nzu));
    const cx = Math.max(0, Math.abs(nxu) - 0.78) / 0.22;
    const cz = Math.max(0, Math.abs(nzu) - 0.78) / 0.22;
    const cornerPull = Math.sqrt(cx * cx + cz * cz);
    if (cornerPull > 1) {
      const pull = 1 / (1 + (cornerPull - 1) * 0.28);
      vx *= pull;
      vz *= pull;
    }

    const rimNoise = hash2D(vx * 1.8, vz * 1.8, seed);
    const edgeWeight = 1 - THREE.MathUtils.smoothstep(edgeDist, 0.0, 0.22);
    const belly = Math.sin(ty * Math.PI) * 0.068 * (0.4 + 0.6 * edgeWeight);
    const angle = Math.atan2(vz, vx);
    vx += Math.cos(angle) * (belly + rimNoise * 0.048 * edgeWeight);
    vz += Math.sin(angle) * (belly + rimNoise * 0.048 * edgeWeight);

    const centerCrown = THREE.MathUtils.smoothstep(edgeDist, 0.0, 0.26);
    const moundWave = (0.5 + 0.5 * hash2D(vx * 0.9, vz * 0.9, seed + 5)) * 0.10;
    const topTarget = thickness * (0.55 + 0.52 * centerCrown) + moundWave * centerCrown;
    const bottomDroop = -droop * (0.45 + 0.55 * (0.5 + 0.5 * rimNoise)) * edgeWeight;

    vy = THREE.MathUtils.lerp(bottomDroop, topTarget, ty);
    if (ty < 0.15) {
      vy = THREE.MathUtils.lerp(bottomDroop, 0.015, THREE.MathUtils.smoothstep(edgeDist, 0.0, 0.18));
    }

    pos.setXYZ(i, vx, vy, vz);
    uv.setXY(i, vx * 0.35 + 0.5, vz * 0.35 + 0.5);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an irregular sculpted multi-lobe tufted snow mound so tree clouds, shrubs,
 * boulders, and spruce snow clumps read as lush overlapping snow pillows rather than flat discs.
 */
function createSnowCloudMoundGeometry({
  rx = 0.8,
  ry = 0.42,
  rz = 0.8,
  seed = 41,
  skirt = 0.08,
  detail = 16,
  lobeStrength = 0.22,
}) {
  const geo = new THREE.SphereGeometry(1, detail, Math.max(9, Math.floor(detail * 0.70)));
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const n = hash2D(x * 2.2, z * 2.2, seed);
    const lobe3 = Math.cos(Math.atan2(z, x) * 3.0 + seed * 0.7) * lobeStrength;
    const rad = Math.hypot(x, z);

    const rMod = 1 + n * 0.15 + lobe3 * THREE.MathUtils.smoothstep(rad, 0.25, 0.95);
    x *= rx * rMod;
    z *= rz * rMod;

    if (y >= 0) {
      const tuft = 1 + n * 0.18 + Math.max(0, lobe3) * 0.25;
      y = Math.pow(y, 0.78) * ry * tuft;
    } else {
      const edgeSwell = THREE.MathUtils.smoothstep(rad, 0.32, 1.0);
      y = y * (ry * 0.26) - skirt * edgeSwell * (0.55 + 0.45 * n);
    }

    pos.setXYZ(i, x, y, z);
    uv.setXY(i, x * 0.5 + 0.5, z * 0.5 + 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Merges a small cluster of non-indexed Geometries into a single BufferGeometry for fast rendering.
 */
function mergeSimpleGeometries(parts) {
  const nonIdx = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let totalVerts = 0;
  nonIdx.forEach((g) => {
    totalVerts += g.attributes.position.count;
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  let offset = 0;
  nonIdx.forEach((g) => {
    const pos = g.attributes.position.array;
    const norm = g.attributes.normal.array;
    const uv = g.attributes.uv.array;
    positions.set(pos, offset * 3);
    normals.set(norm, offset * 3);
    uvs.set(uv, offset * 2);
    offset += g.attributes.position.count;
    g.dispose();
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return merged;
}

/**
 * Creates a plush 3-lobe organic cloud pillow unit for instancing across broadleaf crowns & evergreens.
 */
function createMultiLobeCanopyPillowGeometry() {
  const lobes = [
    { offset: [0, 0.04, 0], rx: 0.78, ry: 0.58, rz: 0.78, seed: 617, skirt: 0.14 },
    { offset: [-0.36, -0.02, 0.22], rx: 0.56, ry: 0.46, rz: 0.52, seed: 631, skirt: 0.12 },
    { offset: [0.34, -0.03, -0.20], rx: 0.54, ry: 0.44, rz: 0.54, seed: 643, skirt: 0.12 },
  ];

  const geos = lobes.map((l) => {
    const g = createSnowCloudMoundGeometry({
      rx: l.rx,
      ry: l.ry,
      rz: l.rz,
      seed: l.seed,
      skirt: l.skirt,
      detail: 15,
      lobeStrength: 0.14,
    });
    g.translate(l.offset[0], l.offset[1], l.offset[2]);
    return g;
  });

  // Preserve indexed smooth normals copied during mergeSimpleGeometries (do NOT recompute on non-indexed buffer)
  return mergeSimpleGeometries(geos);
}

/**
 * Builds the continuous sculpted ground snow blanket matching the exact island outline curve,
 * enforcing upward (+Y) face winding, sculpted pillow collars around stepping stones,
 * clear doorway threshold, and softly bevelled borders.
 */
function createContinuousGroundSnowGeometry({ outlineCurve, stones, patioOrigin }) {
  const angularSegs = 96;
  const radialRings = 30;
  const contour = [];
  for (let i = 0; i < angularSegs; i++) {
    const p = outlineCurve.getPointAt(i / angularSegs);
    contour.push(new THREE.Vector2(p.x * 0.945, p.z * 0.945));
  }

  function boxExclusion(x, z, x0, x1, z0, z1, feather = 0.40) {
    const dx = Math.max(x0 - x, 0, x - x1);
    const dz = Math.max(z0 - z, 0, z - z1);
    const dist = Math.hypot(dx, dz);
    return 1 - THREE.MathUtils.smoothstep(dist, 0, feather);
  }

  const verts = [];
  const uvs = [];
  const indices = [];

  // Center vertex (inside boutique floor exclusion, safely below warm floor)
  verts.push(0, 0.15, 0);
  uvs.push(0.5, 0.5);

  function evalSnowTop(x, z, rFrac) {
    const n1 = hash2D(x * 0.55, z * 0.55, 71);
    const n2 = hash2D(x * 1.15, z * 1.15, 29);
    let top = 0.39 + n1 * 0.055 + n2 * 0.025;

    // Gentle dome swell away from edges, soft rolled snow edge plunging cleanly at gravel curb
    const rimTaper = 1 - THREE.MathUtils.smoothstep(rFrac, 0.87, 0.985);
    const curbCrest = Math.sin(THREE.MathUtils.clamp((rFrac - 0.72) / 0.22, 0, 1) * Math.PI) * 0.042;
    top = THREE.MathUtils.lerp(0.185, top + curbCrest, rimTaper);

    // 1. Keep boutique interior floor & foundation wall apron completely snow-free
    const buildingMask = boxExclusion(x, z, -3.95, 3.82, -3.68, 0.62, 0.36);
    top = THREE.MathUtils.lerp(top, 0.15, buildingMask);

    // 2. Keep center walkway & entrance step treads navigable (`x in [-0.60..1.44], z in [0.55..1.85]`)
    const entryWalkMask = boxExclusion(x, z, -0.60, 1.44, 0.55, 1.85, 0.32);
    top = THREE.MathUtils.lerp(top, 0.155, entryWalkMask);

    // 3. Carve crisp oval pockets around each sandstone stepping stone + plump snow collar
    let maxStoneClear = 0;
    let stoneCollar = 0;
    for (let s = 0; s < stones.length; s++) {
      const st = stones[s];
      const dx = x - st.x;
      const dz = z - st.z;
      const cs = Math.cos(-st.rot);
      const sn = Math.sin(-st.rot);
      const lx = dx * cs - dz * sn;
      const lz = dx * sn + dz * cs;
      const normDist = Math.hypot(lx / (st.rx * 1.14), lz / (st.rz * 1.14));
      if (normDist < 1.38) {
        const clear = 1 - THREE.MathUtils.smoothstep(normDist, 0.82, 1.14);
        if (clear > maxStoneClear) maxStoneClear = clear;
        const rimBump = Math.exp(-Math.pow((normDist - 1.24) / 0.22, 2)) * 0.045;
        if (rimBump > stoneCollar) stoneCollar = rimBump;
      }
    }
    top = THREE.MathUtils.lerp(top + stoneCollar * (1 - maxStoneClear), 0.16, maxStoneClear);

    // 4. Gently thin snow under the market umbrella shelter (`(5.18, 2.38)`)
    const patioDist = Math.hypot(x - patioOrigin.x, z - patioOrigin.z);
    if (patioDist < 1.72) {
      const shelterMask = 1 - THREE.MathUtils.smoothstep(patioDist, 0.72, 1.52);
      top = THREE.MathUtils.lerp(top, 0.265, shelterMask * 0.82);
    }

    return top;
  }

  for (let r = 1; r <= radialRings; r++) {
    const t = r / radialRings;
    const isSkirtRing = r === radialRings;
    const radScale = isSkirtRing ? 1.0 : t * 0.988;

    for (let a = 0; a < angularSegs; a++) {
      const p = contour[a];
      const x = p.x * radScale;
      const z = p.y * radScale;
      const y = isSkirtRing ? 0.175 : evalSnowTop(x, z, radScale);
      verts.push(x, y, z);
      uvs.push(x * 0.24 + 0.5, z * 0.24 + 0.5);
    }
  }

  // Wind ALL surface triangles upward (+Y) dynamically so BackSide culling never hides the snow carpet!
  for (let a = 0; a < angularSegs; a++) {
    const nextA = (a + 1) % angularSegs;
    pushOrientedTri(verts, indices, 0, 1 + a, 1 + nextA, 1);
  }

  for (let r = 1; r < radialRings; r++) {
    const ringStart = 1 + (r - 1) * angularSegs;
    const nextRingStart = 1 + r * angularSegs;
    for (let a = 0; a < angularSegs; a++) {
      const nextA = (a + 1) % angularSegs;
      const i00 = ringStart + a;
      const i01 = ringStart + nextA;
      const i10 = nextRingStart + a;
      const i11 = nextRingStart + nextA;
      pushOrientedTri(verts, indices, i00, i10, i11, 1);
      pushOrientedTri(verts, indices, i00, i11, i01, 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an octagonal thick puffy snow cap draping the outdoor market umbrella with guaranteed
 * upward-facing dome normals and closed thick scalloped brim.
 */
function createUmbrellaSnowDomeGeometry(radius = 1.54, eaveY = 2.18, apexY = 2.66) {
  const segs = 8;
  const subPerSeg = 3;
  const angCount = segs * subPerSeg;
  const rings = 9;
  const thickness = 0.16;

  const verts = [];
  const uvs = [];
  const indices = [];

  for (let pass = 0; pass < 2; pass++) {
    const isTop = pass === 0;
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const octR = t * radius * (isTop ? 1.0 : 0.96);
      const baseSurfY = THREE.MathUtils.lerp(apexY, eaveY, Math.pow(t, 1.06));
      const domeOffset = isTop
        ? thickness * (1 - 0.36 * Math.pow(t, 1.8)) * (1 - 0.12 * Math.pow(t, 6))
        : -0.028 * THREE.MathUtils.smoothstep(t, 0.72, 1.0);

      for (let a = 0; a <= angCount; a++) {
        const ang = (a / angCount) * Math.PI * 2;
        const facetStep = (Math.PI * 2) / segs;
        const localAng = ((ang % facetStep) + facetStep) % facetStep - facetStep * 0.5;
        const polyScale = Math.cos(facetStep * 0.5) / Math.max(0.45, Math.cos(localAng));
        const px = Math.cos(ang) * octR * polyScale;
        const pz = Math.sin(ang) * octR * polyScale;

        const ribProximity = 1 - Math.abs(localAng) / (facetStep * 0.5);
        const sag = -0.030 * Math.sin(ribProximity * Math.PI) * t;
        const eaveCurl = -0.062 * THREE.MathUtils.smoothstep(t, 0.84, 1.0);
        const py = baseSurfY + domeOffset + sag + eaveCurl - eaveY;

        verts.push(px, py, pz);
        uvs.push(px * 0.4 + 0.5, pz * 0.4 + 0.5);
      }
    }
  }

  const stride = angCount + 1;
  const passStride = (rings + 1) * stride;

  // Enforce upward (+Y) orientation for top dome quads
  for (let r = 0; r < rings; r++) {
    for (let a = 0; a < angCount; a++) {
      const i00 = r * stride + a;
      const i01 = r * stride + a + 1;
      const i10 = (r + 1) * stride + a;
      const i11 = (r + 1) * stride + a + 1;
      pushOrientedTri(verts, indices, i00, i01, i11, 1);
      pushOrientedTri(verts, indices, i00, i11, i10, 1);
    }
  }

  // Rim skirt bridging top eave down to underside edge (outward normal)
  const topRim = rings * stride;
  const botRim = passStride + rings * stride;
  for (let a = 0; a < angCount; a++) {
    const t0 = topRim + a;
    const t1 = topRim + a + 1;
    const b0 = botRim + a;
    const b1 = botRim + a + 1;
    indices.push(t0, t1, b1);
    indices.push(t0, b1, b0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates all sculpted 3D thick marshmallow winter snow pillows across roofs, canopies,
 * island ground blanket, boulders, steps, bollards, tree crowns, spruce/cypress boughs,
 * garden flora, and patio umbrella/furniture.
 */
export function createWinterSnow({ island, botanical, patio }) {
  const group = new THREE.Group();
  group.name = 'WinterSnowSystem';
  group.visible = false;

  const { map: snowMap, bumpMap: snowBump } = createSnowTextures();
  const snowMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f6f9fe'),
    emissive: new THREE.Color('#dbe6f4'),
    emissiveIntensity: 0.045,
    map: snowMap,
    bumpMap: snowBump,
    bumpScale: 0.022,
    roughness: 0.76,
    metalness: 0.0,
    sheen: 0.38,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color('#ffffff'),
    envMapIntensity: 0.48,
  });

  const groundCarrier = new THREE.Group();
  groundCarrier.name = 'SnowGroundAndGardenCarrier';
  const building1FCarrier = new THREE.Group();
  building1FCarrier.name = 'SnowBuilding1FCarrier';
  const building2FCarrier = new THREE.Group();
  building2FCarrier.name = 'SnowBuilding2FCarrier';
  const treesPatioCarrier = new THREE.Group();
  treesPatioCarrier.name = 'SnowTreesPatioCarrier';

  group.add(groundCarrier, building1FCarrier, building2FCarrier, treesPatioCarrier);

  const puffTargets = [];
  function registerPuff(mesh, minXZ = 0.78) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    puffTargets.push({ mesh, baseScale: mesh.scale.clone(), minXZ });
    return mesh;
  }

  // ==========================================================
  // 1. 2F ROOFTOPS & 2F PLANTER PILLOWS (`building2FCarrier`)
  // ==========================================================
  const mainRoofGeo = createPillowedSlabGeometry({
    width: 4.86,
    depth: 5.04,
    thickness: 0.39,
    overhang: 0.13,
    droop: 0.21,
    nx: 32,
    nz: 32,
    seed: 101,
  });
  const mainRoofSnow = new THREE.Mesh(mainRoofGeo, snowMat);
  mainRoofSnow.position.set(1.70, 6.06, -1.27);
  building2FCarrier.add(registerPuff(mainRoofSnow, 0.90));

  const leftRoofGeo = createPillowedSlabGeometry({
    width: 2.96,
    depth: 3.64,
    thickness: 0.35,
    overhang: 0.12,
    droop: 0.19,
    nx: 24,
    nz: 24,
    seed: 102,
  });
  const leftRoofSnow = new THREE.Mesh(leftRoofGeo, snowMat);
  leftRoofSnow.position.set(-2.13, 5.59, -2.11);
  building2FCarrier.add(registerPuff(leftRoofSnow, 0.90));

  const planterSnowGeo = createPillowedSlabGeometry({
    width: 3.92,
    depth: 0.36,
    thickness: 0.26,
    overhang: 0.07,
    droop: 0.11,
    nx: 28,
    nz: 10,
    seed: 103,
  });
  const planterSnow = new THREE.Mesh(planterSnowGeo, snowMat);
  planterSnow.position.set(1.68, 3.86, 1.25);
  building2FCarrier.add(registerPuff(planterSnow, 0.85));

  // ==========================================================
  // 2. 1F EXPOSED CANOPY L-SHAPED & REAR BLANKETS (`building1FCarrier`)
  // ==========================================================
  const canopyLeftWingGeo = createPillowedSlabGeometry({
    width: 1.06,
    depth: 5.00,
    thickness: 0.32,
    overhang: 0.11,
    droop: 0.17,
    nx: 12,
    nz: 28,
    seed: 104,
  });
  const canopyLeftWing = new THREE.Mesh(canopyLeftWingGeo, snowMat);
  canopyLeftWing.position.set(-4.06, 3.07, -1.60);
  building1FCarrier.add(registerPuff(canopyLeftWing, 0.88));

  const canopyFrontLeftGeo = createPillowedSlabGeometry({
    width: 2.98,
    depth: 1.26,
    thickness: 0.33,
    overhang: 0.11,
    droop: 0.18,
    nx: 22,
    nz: 12,
    seed: 105,
  });
  const canopyFrontLeft = new THREE.Mesh(canopyFrontLeftGeo, snowMat);
  canopyFrontLeft.position.set(-2.16, 3.07, 0.27);
  building1FCarrier.add(registerPuff(canopyFrontLeft, 0.88));

  const canopyRearEdgeGeo = createPillowedSlabGeometry({
    width: 7.58,
    depth: 0.40,
    thickness: 0.21,
    overhang: 0.06,
    droop: 0.10,
    nx: 26,
    nz: 6,
    seed: 106,
  });
  const canopyRearEdge = new THREE.Mesh(canopyRearEdgeGeo, snowMat);
  canopyRearEdge.position.set(0.21, 3.07, -3.92);
  building1FCarrier.add(registerPuff(canopyRearEdge, 0.88));

  // ==========================================================
  // 3. CONTINUOUS GROUND SNOW BLANKET, BOULDERS, BOLLARDS, STEPS & SHRUB CROWNS (`groundCarrier`)
  // ==========================================================
  const groundBlanketGeo = createContinuousGroundSnowGeometry({
    outlineCurve: island.outlineCurve,
    stones: island.stones,
    patioOrigin: patio.worldOrigin,
  });
  const groundBlanket = new THREE.Mesh(groundBlanketGeo, snowMat);
  groundBlanket.position.y = 0;
  groundCarrier.add(registerPuff(groundBlanket, 0.99));

  // Entrance steps, boulders, bollards, shrubs, ferns & hostas consolidated into ONE InstancedMesh
  const groundMoundGeo = createSnowCloudMoundGeometry({ rx: 1.0, ry: 0.44, rz: 1.0, skirt: 0.11, detail: 16, seed: 309, lobeStrength: 0.20 });
  const groundMoundData = [];
  const gmDummy = new THREE.Object3D();

  // Entrance step side pillows (leaving warm beige center walking tread clear!)
  island.stepSpecs.forEach((st, idx) => {
    [-1, 1].forEach((side) => {
      groundMoundData.push({
        x: st.x + side * (st.w * 0.40),
        y: st.y + st.h * 0.45,
        z: st.z,
        rotX: 0,
        rotY: (idx * 0.7 + side) * 1.1,
        rotZ: 0,
        rx: 0.27 * (0.92 + (idx % 2) * 0.16),
        ry: (0.14 / 0.44) * (0.92 + (side > 0 ? 0.10 : 0)),
        rz: 0.22 * 0.92,
      });
    });
  });

  // Perimeter boulder snow caps
  island.boulderSpecs.forEach((b) => {
    groundMoundData.push({
      x: b.pos[0],
      y: b.pos[1] + b.r * 0.32,
      z: b.pos[2],
      rotX: 0,
      rotY: b.rotY,
      rotZ: 0,
      rx: b.r * 0.94,
      ry: b.r * 0.82,
      rz: b.r * 0.92,
    });
  });

  // Bollard lantern mushroom snow hats
  island.bollardCoords.forEach(([bx, by, bz], i) => {
    groundMoundData.push({
      x: bx,
      y: by + 0.52,
      z: bz,
      rotX: 0,
      rotY: i * 1.2,
      rotZ: 0,
      rx: 0.135,
      ry: 0.088 / 0.44,
      rz: 0.135,
    });
  });

  // Irregular multi-lobe tufted shrub, fern & hosta snow caps (tips & lavender peek cleanly!)
  botanical.shrubSpecs.forEach((s, i) => {
    const crownY = 0.21 + s.h * (s.spikes ? 0.44 : 0.58);
    groundMoundData.push({
      x: s.x,
      y: crownY,
      z: s.z,
      rotX: ((i % 3) - 1) * 0.10,
      rotY: i * 0.92,
      rotZ: ((i % 2) - 0.5) * 0.12,
      rx: 0.46 * s.w * (s.spikes ? 0.64 : 0.90),
      ry: (0.22 / 0.44) * (0.78 + (i % 3) * 0.14),
      rz: 0.46 * s.w * (s.spikes ? 0.64 : 0.86),
    });
  });

  botanical.fernCoords.forEach(([fx, fy, fz, sc], i) => {
    groundMoundData.push({
      x: fx,
      y: fy + 0.30 * sc,
      z: fz,
      rotX: 0,
      rotY: i * 1.05,
      rotZ: 0,
      rx: 0.34 * sc * 0.86,
      ry: (0.14 / 0.44) * sc * 0.86,
      rz: 0.34 * sc * 0.86,
    });
  });

  botanical.hostaItems.forEach((hi, i) => {
    groundMoundData.push({
      x: hi.pos[0],
      y: hi.pos[1] + 0.24 * hi.scale,
      z: hi.pos[2],
      rotX: 0,
      rotY: i * 1.4,
      rotZ: 0,
      rx: 0.34 * hi.scale * 1.02,
      ry: (0.14 / 0.44) * hi.scale * 0.78,
      rz: 0.34 * hi.scale * 0.98,
    });
  });

  const groundMoundInst = new THREE.InstancedMesh(groundMoundGeo, snowMat, groundMoundData.length);
  groundMoundInst.castShadow = true;
  groundMoundInst.receiveShadow = true;
  groundMoundData.forEach((d, idx) => {
    gmDummy.position.set(d.x, d.y, d.z);
    gmDummy.rotation.set(d.rotX, d.rotY, d.rotZ);
    gmDummy.scale.set(d.rx, d.ry, d.rz);
    gmDummy.updateMatrix();
    groundMoundInst.setMatrixAt(idx, gmDummy.matrix);
  });
  groundMoundInst.instanceMatrix.needsUpdate = true;
  groundCarrier.add(groundMoundInst);

  // ==========================================================
  // 4. TREE CROWNS, SPRUCE & CYPRESS TUFTED SNOW CLUMPS, AND PATIO (`treesPatioCarrier`)
  // ==========================================================
  // Multi-lobe plush organic cloud clusters (`canopySnowInst`) hugging twigs & foliage
  const clusters = botanical.canopySnowClusters;
  const cloudPillowGeo = createMultiLobeCanopyPillowGeometry();
  const canopySnowInst = new THREE.InstancedMesh(cloudPillowGeo, snowMat, Math.max(1, clusters.length));
  canopySnowInst.castShadow = true;
  canopySnowInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const rng = createRng(62849);
  const canopyBaseData = [];

  clusters.forEach((cl, idx) => {
    const posY = cl.y - cl.radius * 0.02;
    const rotX = (rng() - 0.5) * 0.24;
    const rotY = rng() * Math.PI * 2;
    const rotZ = (rng() - 0.5) * 0.24;
    const rx = cl.radius * (1.02 + rng() * 0.20);
    const ry = cl.radius * (0.68 + rng() * 0.20);
    const rz = cl.radius * (1.00 + rng() * 0.20);

    canopyBaseData.push({ x: cl.x, y: posY, z: cl.z, rotX, rotY, rotZ, rx, ry, rz });
    dummy.position.set(cl.x, posY, cl.z);
    dummy.rotation.set(rotX, rotY, rotZ);
    dummy.scale.set(rx, ry, rz);
    dummy.updateMatrix();
    canopySnowInst.setMatrixAt(idx, dummy.matrix);
  });
  canopySnowInst.instanceMatrix.needsUpdate = true;
  if (clusters.length === 0) canopySnowInst.visible = false;
  treesPatioCarrier.add(canopySnowInst);

  // Soft cotton-tuft clumps (unit XZ radius) hugging rear spruces & foreground columnar cypresses
  const evergreenTuftGeo = createSnowCloudMoundGeometry({ rx: 1.0, ry: 0.65, rz: 1.0, skirt: 0.14, detail: 10, seed: 655, lobeStrength: 0.24 });
  const evergreenBaseData = [];

  botanical.coniferSpecs.forEach((c) => {
    evergreenBaseData.push({
      x: c.x,
      y: 0.24 + c.h * 0.95,
      z: c.z,
      rx: c.r * 0.24,
      ry: c.r * 0.38,
      rz: c.r * 0.24,
      rotX: 0,
      rotY: c.seed,
      rotZ: 0,
    });
    const tiers = 7;
    for (let t = 0; t < tiers; t++) {
      const f = t / (tiers - 1);
      const yBase = 0.24 + THREE.MathUtils.lerp(c.h * 0.20, c.h * 0.86, f);
      const tierR = c.r * THREE.MathUtils.lerp(0.82, 0.28, f);
      const tuftCount = Math.max(4, Math.round(8 - f * 4));
      for (let k = 0; k < tuftCount; k++) {
        const ang = (k / tuftCount) * Math.PI * 2 + t * 0.85 + c.seed * 0.1;
        const rad = tierR * (0.62 + (k % 2) * 0.14);
        evergreenBaseData.push({
          x: c.x + Math.cos(ang) * rad,
          y: yBase + Math.sin(k + t) * 0.08,
          z: c.z + Math.sin(ang) * rad,
          rx: tierR * 0.42,
          ry: tierR * 0.28,
          rz: tierR * 0.40,
          rotX: Math.sin(ang) * 0.28,
          rotY: -ang,
          rotZ: -Math.cos(ang) * 0.28,
        });
      }
    }
  });

  botanical.cypressSpecs.forEach((cp, idx) => {
    evergreenBaseData.push({
      x: cp.x,
      y: 0.22 + cp.h * 0.96,
      z: cp.z,
      rx: cp.r * 0.34,
      ry: cp.r * 0.48,
      rz: cp.r * 0.34,
      rotX: 0,
      rotY: idx * 0.8,
      rotZ: 0,
    });
    const levels = 8;
    for (let l = 0; l < levels; l++) {
      const f = l / (levels - 1);
      const yL = 0.22 + THREE.MathUtils.lerp(cp.h * 0.16, cp.h * 0.86, f);
      const rL = cp.r * THREE.MathUtils.lerp(0.84, 0.34, f);
      const around = 4;
      for (let k = 0; k < around; k++) {
        const ang = (k / around) * Math.PI * 2 + l * 1.15 + idx;
        evergreenBaseData.push({
          x: cp.x + Math.cos(ang) * rL * 0.68,
          y: yL,
          z: cp.z + Math.sin(ang) * rL * 0.68,
          rx: rL * 0.48,
          ry: rL * 0.38,
          rz: rL * 0.48,
          rotX: Math.sin(ang) * 0.22,
          rotY: -ang,
          rotZ: -Math.cos(ang) * 0.22,
        });
      }
    }
  });

  const evergreenSnowInst = new THREE.InstancedMesh(
    evergreenTuftGeo,
    snowMat,
    Math.max(1, evergreenBaseData.length)
  );
  evergreenSnowInst.castShadow = true;
  evergreenSnowInst.receiveShadow = true;
  evergreenBaseData.forEach((d, idx) => {
    dummy.position.set(d.x, d.y, d.z);
    dummy.rotation.set(d.rotX, d.rotY, d.rotZ);
    dummy.scale.set(d.rx, d.ry, d.rz);
    dummy.updateMatrix();
    evergreenSnowInst.setMatrixAt(idx, dummy.matrix);
  });
  evergreenSnowInst.instanceMatrix.needsUpdate = true;
  treesPatioCarrier.add(evergreenSnowInst);

  // Outdoor Patio Umbrella Snow Dome, Tabletop Pillow & 3 Chair Cushions
  const pOrg = patio.worldOrigin;
  const umbrellaSnowGeo = createUmbrellaSnowDomeGeometry(1.55, 2.18, 2.66);
  const umbrellaSnow = new THREE.Mesh(umbrellaSnowGeo, snowMat);
  umbrellaSnow.position.set(pOrg.x, pOrg.y + 2.18, pOrg.z);
  treesPatioCarrier.add(registerPuff(umbrellaSnow, 0.85));

  const tableSnowGeo = createSnowCloudMoundGeometry({ rx: 0.56, ry: 0.12, rz: 0.56, skirt: 0.03, detail: 14, seed: 701 });
  const tableSnow = new THREE.Mesh(tableSnowGeo, snowMat);
  tableSnow.position.set(pOrg.x, pOrg.y + 0.74, pOrg.z);
  treesPatioCarrier.add(registerPuff(tableSnow, 0.72));

  const seatSnowGeo = createSnowCloudMoundGeometry({ rx: 0.23, ry: 0.07, rz: 0.23, skirt: 0.015, detail: 10, seed: 702 });
  const backSnowGeo = createPillowedSlabGeometry({
    width: 0.36,
    depth: 0.068,
    thickness: 0.06,
    overhang: 0.014,
    droop: 0.016,
    nx: 8,
    nz: 4,
    seed: 703,
  });

  patio.chairSpots.forEach((ch) => {
    const chGroup = new THREE.Group();
    chGroup.position.set(pOrg.x + ch.x, pOrg.y, pOrg.z + ch.z);
    chGroup.rotation.y = ch.rotY;

    const seatPad = new THREE.Mesh(seatSnowGeo, snowMat);
    seatPad.position.set(0, 0.455, 0);
    chGroup.add(registerPuff(seatPad, 0.72));

    const backPad = new THREE.Mesh(backSnowGeo, snowMat);
    backPad.position.set(0, 0.855, -0.205);
    chGroup.add(registerPuff(backPad, 0.72));

    treesPatioCarrier.add(chGroup);
  });

  // Smooth seasonal snow growth / shrink in-place (`0 -> 1`)
  let lastSnowWeight = -1;
  function setSnowWeight(w) {
    if (Math.abs(w - lastSnowWeight) < 0.004) return;
    lastSnowWeight = w;

    if (w <= 0.006) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const easeY = THREE.MathUtils.smoothstep(w, 0.02, 0.96);
    const scaleYFactor = Math.max(0.05, easeY);

    for (let i = 0; i < puffTargets.length; i++) {
      const p = puffTargets[i];
      const xz = THREE.MathUtils.lerp(p.minXZ, 1.0, easeY);
      p.mesh.scale.set(p.baseScale.x * xz, p.baseScale.y * scaleYFactor, p.baseScale.z * xz);
    }

    if (clusters.length > 0) {
      const xz = THREE.MathUtils.lerp(0.55, 1.0, easeY);
      for (let i = 0; i < canopyBaseData.length; i++) {
        const d = canopyBaseData[i];
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.set(d.rotX, d.rotY, d.rotZ);
        dummy.scale.set(d.rx * xz, d.ry * scaleYFactor, d.rz * xz);
        dummy.updateMatrix();
        canopySnowInst.setMatrixAt(i, dummy.matrix);
      }
      canopySnowInst.instanceMatrix.needsUpdate = true;
    }

    const evXZ = THREE.MathUtils.lerp(0.55, 1.0, easeY);
    for (let i = 0; i < evergreenBaseData.length; i++) {
      const d = evergreenBaseData[i];
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(d.rotX, d.rotY, d.rotZ);
      dummy.scale.set(d.rx * evXZ, d.ry * scaleYFactor, d.rz * evXZ);
      dummy.updateMatrix();
      evergreenSnowInst.setMatrixAt(i, dummy.matrix);
    }
    evergreenSnowInst.instanceMatrix.needsUpdate = true;

    const gmXZ = THREE.MathUtils.lerp(0.65, 1.0, easeY);
    for (let i = 0; i < groundMoundData.length; i++) {
      const d = groundMoundData[i];
      gmDummy.position.set(d.x, d.y, d.z);
      gmDummy.rotation.set(d.rotX, d.rotY, d.rotZ);
      gmDummy.scale.set(d.rx * gmXZ, d.ry * scaleYFactor, d.rz * gmXZ);
      gmDummy.updateMatrix();
      groundMoundInst.setMatrixAt(i, gmDummy.matrix);
    }
    groundMoundInst.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    assemblyCarriers: {
      groundCarrier,
      building1FCarrier,
      building2FCarrier,
      treesPatioCarrier,
    },
    setSnowWeight,
  };
}
