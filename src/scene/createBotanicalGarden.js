import * as THREE from 'three';
import { Tree, BarkType, Billboard, LeafType, TreeType } from '@dgreenheck/ez-tree';
import {
  sharedUniforms,
  createBroadleafSprayTexture,
  createConiferSprayTexture,
  createFernFrondTexture,
  createHydrangeaClusterTexture,
  createFlowerSpikeTexture,
  createIvySprigTexture,
  createContactShadowMaterial,
} from '../materials/studioMaterials.js';

function createRng(seed = 707070) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Broadleaf tree canopy material using alpha-cutout compound leaf sprays,
 * volumetric vertex shading, and gentle breeze sway.
 */
function createBroadleafMaterial(leafTex) {
  const mat = new THREE.MeshStandardMaterial({
    map: leafTex,
    color: new THREE.Color('#ffffff'),
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest: 0.36,
    roughness: 0.76,
    metalness: 0.0,
    envMapIntensity: 0.34,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 lw = modelMatrix * vec4( transformed, 1.0 );
        float hW = clamp( ( lw.y - 1.5 ) / 7.5, 0.0, 1.0 );
        float ph = lw.x * 0.65 + lw.z * 0.55 + lw.y * 0.35;
        float sway = sin( uTime * 1.25 + ph ) * 0.65 + sin( uTime * 2.15 + ph * 1.5 ) * 0.35;
        transformed.x += sway * 0.085 * hW;
        transformed.z += cos( uTime * 1.05 + ph ) * 0.065 * hW;`
      );
  };

  return mat;
}

/**
 * Rewrites ez-tree leaf normals toward a soft sculptural canopy sphere & applies
 * deep inner shadow -> vibrant outer sunlit foliage colors.
 */
function applyCanopyVolumeColors(geometry, rng, outerHex = '#cdf058', midHex = '#6fb639', deepHex = '#234a1f') {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = box.getSize(new THREE.Vector3());
  const normalOrigin = center.clone().add(new THREE.Vector3(0, -size.y * 0.14, 0));
  const maxR = Math.max(0.8, size.length() * 0.45);

  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const colors = new Float32Array(pos.count * 3);

  const outerBright = new THREE.Color(outerHex);
  const midTone = new THREE.Color(midHex);
  const innerDeep = new THREE.Color(deepHex);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 4) {
    v.set(0, 0, 0);
    for (let k = 0; k < 4 && i + k < pos.count; k++) {
      v.x += pos.getX(i + k);
      v.y += pos.getY(i + k);
      v.z += pos.getZ(i + k);
    }
    v.multiplyScalar(0.25);

    dir.subVectors(v, normalOrigin);
    const distNorm = THREE.MathUtils.clamp(dir.length() / (maxR * 0.85), 0.0, 1.0);
    const hNorm = THREE.MathUtils.clamp((v.y - box.min.y) / Math.max(0.4, size.y), 0.0, 1.0);

    if (dir.lengthSq() > 0.0001) dir.normalize();
    else dir.set(0, 1, 0);
    dir.y = dir.y * 0.62 + 0.48;
    dir.normalize();

    const lum = THREE.MathUtils.clamp(distNorm * 0.54 + hNorm * 0.46, 0.0, 1.0);
    if (lum < 0.45) {
      c.lerpColors(innerDeep, midTone, lum / 0.45);
    } else {
      c.lerpColors(midTone, outerBright, (lum - 0.45) / 0.55);
    }

    c.offsetHSL((rng() - 0.5) * 0.035, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.07);

    for (let k = 0; k < 4 && i + k < pos.count; k++) {
      norm.setXYZ(i + k, dir.x, dir.y, dir.z);
      colors[(i + k) * 3] = c.r;
      colors[(i + k) * 3 + 1] = c.g;
      colors[(i + k) * 3 + 2] = c.b;
    }
  }

  norm.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function upgradeBarkMaterial(oldMat) {
  return new THREE.MeshStandardMaterial({
    map: oldMat.map || null,
    normalMap: oldMat.normalMap || null,
    aoMap: oldMat.aoMap || null,
    color: new THREE.Color('#745840'),
    roughness: 0.90,
    metalness: 0.02,
    envMapIntensity: 0.25,
  });
}

function isInsideBuildingInteriorCorridor(wp) {
  const in1FOrLeft =
    wp.x > -4.65 && wp.x < 4.20 && wp.z > -4.15 && wp.z < 1.35 && wp.y < 3.25;
  const in2FLeft =
    wp.x > -3.70 && wp.x < -0.55 && wp.z > -4.05 && wp.z < -0.20 && wp.y < 5.75;
  const in2FRight =
    wp.x > -0.85 && wp.x < 4.25 && wp.z > -3.90 && wp.z < 1.40 && wp.y < 6.25;
  return in1FOrLeft || in2FLeft || in2FRight;
}

/**
 * Ensures NO stray branch triangles poke through the transparent interior showroom windows.
 */
function pruneBranchesInsideBuilding(tree) {
  const geo = tree.branchesMesh.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index;
  if (!idx) return;

  const invWorld = tree.branchesMesh.matrixWorld.clone().invert();
  const safeLocal = new THREE.Vector3(tree.position.x, tree.position.y, tree.position.z).applyMatrix4(invWorld);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const mid = new THREE.Vector3();

  for (let i = 0; i < idx.count; i += 3) {
    const i0 = idx.getX(i);
    const i1 = idx.getX(i + 1);
    const i2 = idx.getX(i + 2);
    a.fromBufferAttribute(pos, i0).applyMatrix4(tree.branchesMesh.matrixWorld);
    b.fromBufferAttribute(pos, i1).applyMatrix4(tree.branchesMesh.matrixWorld);
    c.fromBufferAttribute(pos, i2).applyMatrix4(tree.branchesMesh.matrixWorld);
    mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);

    if (
      isInsideBuildingInteriorCorridor(mid) ||
      isInsideBuildingInteriorCorridor(a) ||
      isInsideBuildingInteriorCorridor(b) ||
      isInsideBuildingInteriorCorridor(c)
    ) {
      // Redirect degenerate triangle to itself cleanly so no mesh splits or ghosts appear
      idx.setX(i + 1, i0);
      idx.setX(i + 2, i0);
      if (pos.getY(i0) < -1000) pos.setXYZ(i0, safeLocal.x, safeLocal.y, safeLocal.z);
    }
  }
  idx.needsUpdate = true;
}

/**
 * Builds a layered natural spruce/pine conifer (not a solid geometric cone) using radiating pine needle bough fans.
 */
function createConiferSpruceTree(needleTex, barkMat, height = 6.2, baseRadius = 1.45, seed = 101) {
  const g = new THREE.Group();
  const rng = createRng(seed);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, height * 0.92, 8), barkMat);
  trunk.position.y = height * 0.46;
  trunk.castShadow = true;
  g.add(trunk);

  const layerMat = new THREE.MeshStandardMaterial({
    map: needleTex,
    color: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
    alphaTest: 0.34,
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.26,
  });

  const tiers = 16;
  const fanGeo = new THREE.PlaneGeometry(1, 1);
  const count = tiers * 7 + 8;
  const inst = new THREE.InstancedMesh(fanGeo, layerMat, count);
  inst.castShadow = true;
  inst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  let idx = 0;

  for (let t = 0; t < tiers; t++) {
    const f = THREE.MathUtils.clamp(t / (tiers - 1), 0, 1);
    const y = THREE.MathUtils.lerp(height * 0.11, height * 0.98, f);
    const tierR = baseRadius * (1.0 - Math.pow(f, 0.92) * 0.88);
    const fansInTier = 7;

    for (let k = 0; k < fansInTier; k++) {
      const ang = (k / fansInTier) * Math.PI * 2 + t * 0.55 + (rng() - 0.5) * 0.25;
      const dist = tierR * (0.42 + rng() * 0.16);
      dummy.position.set(Math.cos(ang) * dist, y, Math.sin(ang) * dist);
      dummy.rotation.set(0, -ang + Math.PI * 0.5, 0);
      dummy.rotateX(0.45 + f * 0.25 + (rng() - 0.5) * 0.18);
      dummy.rotateZ((rng() - 0.5) * 0.35);
      const sc = THREE.MathUtils.lerp(1.32, 0.42, f) * (0.85 + rng() * 0.3);
      dummy.scale.set(sc * 1.12, sc * 1.16, sc);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);

      c.set('#244920').lerp(new THREE.Color('#5f9436'), f * 0.72 + rng() * 0.28);
      inst.setColorAt(idx, c);
      idx++;
    }
  }

  for (let k = 0; k < count - idx; k++) {
    dummy.position.set((rng() - 0.5) * 0.12, height * 0.99 + k * 0.04, (rng() - 0.5) * 0.12);
    dummy.rotation.set(0, k * 0.9, 0);
    dummy.scale.set(0.42, 0.52, 0.42);
    dummy.updateMatrix();
    inst.setMatrixAt(idx + k, dummy.matrix);
    inst.setColorAt(idx + k, new THREE.Color('#66943c'));
  }

  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);

  return g;
}

/**
 * Builds a sleek tapered columnar evergreen cypress spire (`柱形常绿植物`).
 */
function createColumnarCypress(needleTex, barkMat, height = 4.2, maxR = 0.48, seed = 202) {
  const g = new THREE.Group();
  const rng = createRng(seed);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, height * 0.88, 6), barkMat);
  trunk.position.y = height * 0.44;
  g.add(trunk);

  const mat = new THREE.MeshStandardMaterial({
    map: needleTex,
    color: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
    alphaTest: 0.36,
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 0.28,
  });

  const rings = 22;
  const perRing = 6;
  const count = rings * perRing;
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, count);
  inst.castShadow = true;
  inst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  let idx = 0;

  for (let r = 0; r < rings; r++) {
    const f = THREE.MathUtils.clamp(r / (rings - 1), 0, 1);
    const y = THREE.MathUtils.lerp(0.32, height * 0.98, f);
    const rem = Math.max(0, 1.0 - (f - 0.22) / 0.78);
    const profile = f < 0.22
      ? THREE.MathUtils.lerp(0.55, 1.0, f / 0.22)
      : Math.pow(rem, 0.78);
    const ringR = maxR * profile;

    for (let k = 0; k < perRing; k++) {
      const ang = (k / perRing) * Math.PI * 2 + r * 0.62;
      const dist = ringR * (0.45 + rng() * 0.25);
      dummy.position.set(Math.cos(ang) * dist, y, Math.sin(ang) * dist);
      dummy.rotation.set(0, -ang + Math.PI * 0.5, 0);
      dummy.rotateX(-0.18 + (rng() - 0.5) * 0.16);
      const sc = THREE.MathUtils.lerp(0.68, 0.26, f) * (0.88 + rng() * 0.24);
      dummy.scale.set(sc * 0.78, sc * 1.28, sc);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);

      c.set('#2e521e').lerp(new THREE.Color('#6a9838'), f * 0.55 + rng() * 0.45);
      inst.setColorAt(idx, c);
      idx++;
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);

  return g;
}

/**
 * Builds an arching fern cluster rosette (`蕨类植物`) using pinnately divided alpha-cutout fronds.
 */
function createFernClump(fernTex, scale = 1.0, seed = 301) {
  const g = new THREE.Group();
  const rng = createRng(seed);
  const frondMat = new THREE.MeshStandardMaterial({
    map: fernTex,
    color: new THREE.Color('#ffffff'),
    alphaTest: 0.36,
    roughness: 0.72,
    side: THREE.DoubleSide,
    envMapIntensity: 0.30,
  });

  // Safe arched plane geometry with clamped parameter (zero NaN risk!)
  const frondGeo = new THREE.PlaneGeometry(0.36, 0.85, 2, 6);
  const pos = frondGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + 0.425) / 0.85, 0.0, 1.0);
    pos.setY(i, Math.sin(t * 2.15) * 0.44);
    pos.setZ(i, t * 0.68);
  }
  frondGeo.computeVertexNormals();

  const fronds = 12;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + (rng() - 0.5) * 0.24;
    const isInner = i % 3 === 0;
    const f = new THREE.Mesh(frondGeo, frondMat);
    f.rotation.y = a;
    f.rotation.x = isInner ? -0.30 : 0.08 + rng() * 0.14;
    const sc = (isInner ? 0.70 : 0.94 + rng() * 0.22) * scale;
    f.scale.setScalar(sc);
    f.castShadow = true;
    f.receiveShadow = true;
    g.add(f);
  }
  return g;
}

/**
 * Builds the signature variegated hosta (`玉簪`) with arched cream-edged elliptical blades.
 */
function createVariegatedHosta(scale = 1.0) {
  const g = new THREE.Group();

  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#e7efbf';
  ctx.beginPath();
  ctx.ellipse(64, 64, 34, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4e7e34';
  ctx.beginPath();
  ctx.ellipse(64, 64, 24, 44, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.62,
    envMapIntensity: 0.35,
  });

  const leafGeo = new THREE.PlaneGeometry(0.42, 0.62, 2, 5);
  const pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + 0.31) / 0.62, 0.0, 1.0);
    pos.setY(i, Math.sin(t * 2.25) * 0.24);
    pos.setZ(i, t * 0.48);
  }
  leafGeo.computeVertexNormals();

  for (let ring = 0; ring < 2; ring++) {
    const count = ring === 0 ? 11 : 7;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(leafGeo, mat);
      m.rotation.y = (i / count) * Math.PI * 2 + ring * 0.38;
      m.rotation.x = ring === 0 ? 0.12 : -0.32;
      m.scale.setScalar((ring === 0 ? 1.05 : 0.74) * scale);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
  }
  return g;
}

/**
 * Builds lacy botanical flowering shrubs (crossed leaf sprays + frothy floral floret clouds or spiky lavender racemes)
 * with ZERO ugly polygon balls!
 */
function createBotanicalFlowerShrub(
  leafTex,
  hydrangeaTex,
  spikeTex,
  {
    width = 0.9,
    height = 0.65,
    foliageColor = '#5d8e35',
    bloomColor = '#faf5ea',
    spikes = false,
    seed = 404,
  } = {}
) {
  const g = new THREE.Group();
  const rng = createRng(seed);

  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    color: new THREE.Color(foliageColor),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.78,
    envMapIntensity: 0.28,
  });

  // Layered basal botanical leaf cards radiating outward
  const leafPlane = new THREE.PlaneGeometry(width * 0.72, width * 0.72);
  const leafCount = 9;
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2 + rng() * 0.35;
    const dist = width * (0.12 + rng() * 0.14);
    const lCard = new THREE.Mesh(leafPlane, leafMat);
    lCard.position.set(Math.cos(a) * dist, height * (0.28 + rng() * 0.16), Math.sin(a) * dist);
    lCard.rotation.set(-0.65 + (rng() - 0.5) * 0.35, a + rng() * 0.5, (rng() - 0.5) * 0.4);
    lCard.castShadow = true;
    lCard.receiveShadow = true;
    g.add(lCard);
  }

  if (spikes) {
    // Tall crossed botanical raceme spikes (purple lavender / salvia)
    const spikeMat = new THREE.MeshStandardMaterial({
      map: spikeTex,
      color: new THREE.Color(bloomColor),
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.72,
    });
    const spikeGeo = new THREE.PlaneGeometry(0.24, height * 0.92);
    const sCount = 12;
    for (let i = 0; i < sCount; i++) {
      const a = rng() * Math.PI * 2;
      const dist = rng() * width * 0.32;
      const sx = Math.cos(a) * dist;
      const sz = Math.sin(a) * dist;
      const sy = height * (0.48 + rng() * 0.16);
      const tiltX = (rng() - 0.5) * 0.28;
      const tiltZ = (rng() - 0.5) * 0.28;
      const sc = 0.78 + rng() * 0.38;

      for (let cross = 0; cross < 2; cross++) {
        const sp = new THREE.Mesh(spikeGeo, spikeMat);
        sp.position.set(sx, sy, sz);
        sp.rotation.set(tiltX, a + cross * (Math.PI * 0.5), tiltZ);
        sp.scale.setScalar(sc);
        sp.castShadow = true;
        g.add(sp);
      }
    }
  } else {
    // Frothy crossed hydrangea/daisy floral floret umbels (`绣球花花簇`)
    const bloomMat = new THREE.MeshStandardMaterial({
      map: hydrangeaTex,
      color: new THREE.Color(bloomColor),
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.74,
    });
    const flPlane = new THREE.PlaneGeometry(0.36 * width, 0.36 * width);
    const clusterCount = 10;
    for (let i = 0; i < clusterCount; i++) {
      const a = (i / clusterCount) * Math.PI * 2 + rng() * 0.4;
      const dist = i < 2 ? rng() * width * 0.10 : width * (0.16 + rng() * 0.18);
      const cx = Math.cos(a) * dist;
      const cz = Math.sin(a) * dist;
      const cy = height * (0.48 + (i < 2 ? 0.22 : rng() * 0.16));

      // Three intersecting angled floret cards per umbel = 3D volumetric bloom spray from every orbit angle!
      for (let p = 0; p < 3; p++) {
        const card = new THREE.Mesh(flPlane, bloomMat);
        card.position.set(cx, cy, cz);
        card.rotation.set((p - 1) * 0.48, a + p * (Math.PI / 3), (rng() - 0.5) * 0.3);
        card.castShadow = true;
        g.add(card);
      }
    }
  }

  return g;
}

export function createBotanicalGarden() {
  const group = new THREE.Group();
  group.name = 'FourSeasonsBotanicalGarden';

  const rng = createRng(882244);
  const leafTex = createBroadleafSprayTexture();
  const coniferTex = createConiferSprayTexture();
  const fernTex = createFernFrondTexture();
  const hydrangeaTex = createHydrangeaClusterTexture();
  const spikeTex = createFlowerSpikeTexture();
  const ivyTex = createIvySprigTexture();

  const sharedBroadleafMat = createBroadleafMaterial(leafTex);

  const barkGenericMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6a4e37'),
    roughness: 0.92,
  });

  // ==========================================================
  // 1. HERO & FRAMING BROADLEAF TREES (@dgreenheck/ez-tree)
  // ==========================================================
  const treeSpecs = [
    // 1. Left Hero Broadleaf Tree (Arching gracefully over 1F left roof with intact headroom)
    {
      seed: 61802,
      pos: [-5.75, 0.22, -0.35],
      rotY: 0.34,
      tiltX: 0.03,
      tiltZ: -0.14,
      scale: 0.168,
      trunkLen: 26,
      boughLen: 21.5,
      children0: 6,
      gnarl0: 0.15,
      forceDir: { x: 0.26, y: 1.0, z: 0.04 },
      forceStr: -0.005,
      leafSize: 4.55,
      leafCount: 9,
    },
    // 2. Rear-Right Framing Broadleaf Tree (Cleanly behind 2F right corner so slot windows read clearly)
    {
      seed: 44711,
      pos: [5.45, 0.22, -3.55],
      rotY: 0.35,
      tiltX: -0.04,
      tiltZ: -0.08,
      scale: 0.136,
      trunkLen: 29,
      boughLen: 16.5,
      children0: 6,
      gnarl0: 0.09,
      forceDir: { x: 0.15, y: 1, z: -0.15 },
      forceStr: -0.005,
      leafSize: 4.0,
      leafCount: 8,
    },
    // 3. Mid-Right Courtyard Tree behind Umbrella
    {
      seed: 19283,
      pos: [6.45, 0.22, -1.15],
      rotY: 0.25,
      tiltX: 0.02,
      tiltZ: -0.09,
      scale: 0.116,
      trunkLen: 24,
      boughLen: 14.5,
      children0: 5,
      gnarl0: 0.10,
      forceDir: { x: 0.22, y: 1, z: -0.05 },
      forceStr: -0.004,
      leafSize: 3.8,
      leafCount: 7,
    },
    // 4. Rear-Center Right Accent Canopy safely behind rear wall (`Z = -5.55`, leaning gently -Z)
    {
      seed: 93841,
      pos: [1.85, 0.22, -5.55],
      rotY: 2.15,
      tiltX: -0.08,
      tiltZ: 0,
      scale: 0.138,
      trunkLen: 29,
      boughLen: 15.0,
      children0: 6,
      gnarl0: 0.08,
      forceDir: { x: 0, y: 1, z: -0.2 },
      forceStr: -0.005,
      leafSize: 3.9,
      leafCount: 8,
    },
    // 5. Far-Left Edge Sapling (`基准图.png` low foliage left of main trunk)
    {
      seed: 33109,
      pos: [-7.05, 0.22, -1.55],
      rotY: 1.9,
      tiltX: 0.03,
      tiltZ: 0.09,
      scale: 0.105,
      trunkLen: 20,
      boughLen: 13.0,
      children0: 5,
      gnarl0: 0.11,
      forceDir: { x: 0, y: 1, z: 0 },
      forceStr: -0.004,
      leafSize: 3.5,
      leafCount: 6,
    },
  ];

  treeSpecs.forEach((s) => {
    const tree = new Tree();
    tree.options.seed = s.seed;
    tree.options.type = TreeType.Deciduous;
    tree.options.bark.type = BarkType.Oak;
    tree.options.bark.tint = 0x6a503b;
    tree.options.bark.textured = true;
    tree.options.bark.textureScale = { x: 0.9, y: 6 };

    tree.options.branch.levels = 3;
    tree.options.branch.angle = { 1: 48, 2: 39, 3: 40 };
    tree.options.branch.children = { 0: s.children0, 1: 3, 2: 3 };
    tree.options.branch.force = { direction: s.forceDir, strength: s.forceStr };
    tree.options.branch.gnarliness = { 0: s.gnarl0, 1: 0.18, 2: 0.22, 3: 0.12 };
    tree.options.branch.length = { 0: s.trunkLen, 1: s.boughLen, 2: 11.5, 3: 4.5 };
    tree.options.branch.radius = { 0: 2.35, 1: 0.62, 2: 0.72, 3: 0.88 };
    tree.options.branch.sections = { 0: 12, 1: 8, 2: 6, 3: 3 };
    tree.options.branch.segments = { 0: 8, 1: 6, 2: 4, 3: 3 };
    tree.options.branch.start = { 1: 0.44, 2: 0.26, 3: 0.15 };
    tree.options.branch.taper = { 0: 0.70, 1: 0.56, 2: 0.68, 3: 0.52 };
    tree.options.branch.twist = { 0: 0.10, 1: -0.10, 2: 0.06, 3: 0 };

    tree.options.leaves.type = LeafType.Ash;
    tree.options.leaves.billboard = Billboard.Double;
    tree.options.leaves.angle = 30;
    tree.options.leaves.count = s.leafCount;
    tree.options.leaves.start = 0.14;
    tree.options.leaves.size = s.leafSize;
    tree.options.leaves.sizeVariance = 0.52;
    tree.options.leaves.tint = 0xffffff;
    tree.options.leaves.alphaTest = 0.36;

    tree.generate();

    applyCanopyVolumeColors(tree.leavesMesh.geometry, rng);

    const oldLeafMat = tree.leavesMesh.material;
    tree.leavesMesh.material = sharedBroadleafMat;
    oldLeafMat.dispose();

    const oldBarkMat = tree.branchesMesh.material;
    tree.branchesMesh.material = upgradeBarkMaterial(oldBarkMat);
    oldBarkMat.dispose();

    tree.branchesMesh.castShadow = true;
    tree.branchesMesh.receiveShadow = true;
    tree.leavesMesh.castShadow = true;
    tree.leavesMesh.receiveShadow = true;

    tree.position.set(s.pos[0], s.pos[1], s.pos[2]);
    tree.rotation.set(s.tiltX, s.rotY, s.tiltZ);
    tree.scale.setScalar(s.scale);
    tree.updateMatrixWorld(true);

    // Prune both stray branches AND leaf quads from piercing building interior/windows!
    pruneBranchesInsideBuilding(tree);

    const lPos = tree.leavesMesh.geometry.attributes.position;
    const invWorld = tree.leavesMesh.matrixWorld.clone().invert();
    const quadCenter = new THREE.Vector3();
    for (let i = 0; i < lPos.count; i += 4) {
      quadCenter.set(0, 0, 0);
      for (let k = 0; k < 4 && i + k < lPos.count; k++) {
        quadCenter.x += lPos.getX(i + k);
        quadCenter.y += lPos.getY(i + k);
        quadCenter.z += lPos.getZ(i + k);
      }
      quadCenter.multiplyScalar(0.25).applyMatrix4(tree.leavesMesh.matrixWorld);

      if (isInsideBuildingInteriorCorridor(quadCenter)) {
        const zeroLocal = new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]).applyMatrix4(invWorld);
        for (let k = 0; k < 4 && i + k < lPos.count; k++) {
          lPos.setXYZ(i + k, zeroLocal.x, zeroLocal.y, zeroLocal.z);
        }
      }
    }
    lPos.needsUpdate = true;

    group.add(tree);

    const rootShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      createContactShadowMaterial({ opacity: 0.40, roundness: 0.9 })
    );
    rootShadow.rotation.x = -Math.PI / 2;
    rootShadow.position.set(s.pos[0], s.pos[1] + 0.015, s.pos[2]);
    group.add(rootShadow);
  });

  // ==========================================================
  // 2. REAR CONIFERS (3 Evergreen Spruces behind 2F roofline, clear of rear door!)
  // ==========================================================
  const coniferSpecs = [
    { x: -0.35, z: -5.55, h: 7.45, r: 1.38, seed: 501 },
    { x: 0.85, z: -5.75, h: 8.15, r: 1.48, seed: 502 },
    { x: 2.05, z: -5.45, h: 7.15, r: 1.30, seed: 503 },
  ];
  coniferSpecs.forEach((c) => {
    const spruce = createConiferSpruceTree(coniferTex, barkGenericMat, c.h, c.r, c.seed);
    spruce.position.set(c.x, 0.24, c.z);
    group.add(spruce);
  });

  // ==========================================================
  // 3. COLUMNAR CYPRESS SPIRES (`柱形常绿植物`, matching 基准图.png)
  // ==========================================================
  const cypressSpecs = [
    { x: -3.72, z: 1.85, h: 4.55, r: 0.46, seed: 601 },
    { x: -4.65, z: 2.35, h: 2.85, r: 0.36, seed: 602 },
    { x: 7.05, z: 1.45, h: 4.15, r: 0.44, seed: 603 },
  ];
  cypressSpecs.forEach((cp) => {
    const cy = createColumnarCypress(coniferTex, barkGenericMat, cp.h, cp.r, cp.seed);
    cy.position.set(cp.x, 0.22, cp.z);
    group.add(cy);
  });

  // ==========================================================
  // 4. FOREGROUND & COURTYARD UNDERSTORY FLORA
  // ==========================================================

  const fernCoords = [
    [-6.05, 0.24, 1.45, 1.25, 701],
    [-7.05, 0.24, 0.55, 1.05, 702],
    [-4.95, 0.24, 2.20, 0.92, 703],
    [3.05, 0.24, 1.15, 0.85, 704],
    [6.15, 0.24, 0.85, 0.95, 705],
    [6.65, 0.24, 1.55, 0.88, 706],
  ];
  fernCoords.forEach(([x, y, z, s, seed]) => {
    const f = createFernClump(fernTex, s, seed);
    f.position.set(x, y, z);
    group.add(f);
  });

  // Signature Front-Left & Courtyard Variegated Hosta Rosettes
  const hostaLeft = createVariegatedHosta(1.22);
  hostaLeft.position.set(-4.02, 0.22, 4.15);
  group.add(hostaLeft);

  const hostaRight = createVariegatedHosta(0.95);
  hostaRight.position.set(5.65, 0.22, 3.85);
  group.add(hostaRight);

  const shrubSpecs = [
    { x: -4.95, z: 2.95, w: 1.12, h: 0.84, bloom: '#fcf7ec', spikes: false, seed: 801 },
    { x: -3.55, z: 2.55, w: 0.92, h: 0.72, bloom: '#9872dc', spikes: true, seed: 816 },
    { x: -3.15, z: 3.45, w: 1.02, h: 0.96, bloom: '#825ad6', spikes: true, seed: 802 },
    { x: -2.35, z: 3.85, w: 0.88, h: 0.65, bloom: '#eda2be', spikes: false, seed: 803 },
    { x: -6.15, z: 2.95, w: 0.80, h: 0.54, bloom: '#d8de58', spikes: false, seed: 804 },
    { x: -2.08, z: 1.45, w: 0.86, h: 0.68, bloom: '#f7f1e3', spikes: false, seed: 805 },

    { x: 2.95, z: 2.05, w: 1.04, h: 0.82, bloom: '#faf6ec', spikes: false, seed: 806 },
    { x: 3.35, z: 4.10, w: 1.16, h: 0.98, bloom: '#845cd8', spikes: true, seed: 807 },
    { x: 4.12, z: 4.55, w: 0.90, h: 0.62, bloom: '#e898ba', spikes: false, seed: 808 },
    { x: 2.25, z: 4.65, w: 0.86, h: 0.56, bloom: '#fcf8ee', spikes: false, seed: 809 },
    { x: 6.85, z: 2.25, w: 0.98, h: 0.84, bloom: '#865fda', spikes: true, seed: 810 },
    { x: 7.25, z: 1.95, w: 0.82, h: 0.58, bloom: '#fcf8ee', spikes: false, seed: 817 },

    { x: 5.05, z: -1.45, w: 0.95, h: 0.74, bloom: '#f8f4ea', spikes: false, seed: 812 },
    { x: 5.15, z: -2.65, w: 0.92, h: 0.72, bloom: '#f8f4ea', spikes: false, seed: 813 },

    { x: -2.55, z: -4.95, w: 1.10, h: 0.78, bloom: '#f8f4ea', spikes: false, seed: 814 },
    { x: 1.95, z: -4.65, w: 1.00, h: 0.78, bloom: '#8b65dc', spikes: true, seed: 815 },
  ];

  shrubSpecs.forEach((s) => {
    const mound = createBotanicalFlowerShrub(leafTex, hydrangeaTex, spikeTex, {
      width: s.w,
      height: s.h,
      foliageColor: s.foliage || '#5c9335',
      bloomColor: s.bloom,
      spikes: s.spikes,
      seed: s.seed,
    });
    mound.position.set(s.x, 0.21, s.z);
    group.add(mound);
  });

  // ==========================================================
  // 5. 2F PLANTER BOX FROTHY BLOOMS & ORGANIC TRAILING IVY SWAGS
  // ==========================================================
  const planterLeafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    color: new THREE.Color('#6ca83b'),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.75,
  });
  const planterBloomMat = new THREE.MeshStandardMaterial({
    map: hydrangeaTex,
    color: new THREE.Color('#fcf9ef'),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.74,
  });
  const vineMat = new THREE.MeshStandardMaterial({
    map: ivyTex,
    color: new THREE.Color('#b6e074'),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.72,
  });

  const planterLeafGeo = new THREE.PlaneGeometry(0.44, 0.44);
  const planterBloomGeo = new THREE.PlaneGeometry(0.36, 0.36);
  const vineGeo = new THREE.PlaneGeometry(0.26, 0.46);

  for (let i = 0; i < 24; i++) {
    const x = THREE.MathUtils.lerp(-0.18, 3.54, i / 23) + (rng() - 0.5) * 0.05;

    for (let c = 0; c < 2; c++) {
      const lm = new THREE.Mesh(planterLeafGeo, planterLeafMat);
      lm.position.set(x, 3.88 + rng() * 0.06, 1.24 + (rng() - 0.5) * 0.06);
      lm.rotation.set(-0.35 + rng() * 0.65, c * Math.PI * 0.5 + rng() * 0.45, (rng() - 0.5) * 0.35);
      group.add(lm);
    }

    for (let b = 0; b < 2; b++) {
      const bm = new THREE.Mesh(planterBloomGeo, planterBloomMat);
      bm.position.set(x + (rng() - 0.5) * 0.06, 3.94 + rng() * 0.09, 1.32 + rng() * 0.05);
      bm.rotation.set(0.18 + rng() * 0.48, b * 1.25 + rng() * 0.45, (rng() - 0.5) * 0.42);
      group.add(bm);
    }
  }

  // Natural grouped trailing ivy cascades (`基准图.png` clustered spilling swags, no picket fence look)
  const swagCenters = [-0.04, 0.56, 1.26, 2.02, 2.76, 3.36];
  swagCenters.forEach((cx, sIdx) => {
    const tendrils = sIdx === 0 || sIdx === 5 ? 4 : 3;
    for (let k = 0; k < tendrils; k++) {
      const offset = (k - (tendrils - 1) * 0.5) * 0.14 + (rng() - 0.5) * 0.05;
      const dropScaleY = (0.58 + rng() * 0.72) * (k === Math.floor(tendrils / 2) ? 1.22 : 0.82);
      const leanZ = (k - (tendrils - 1) * 0.5) * 0.24 + (rng() - 0.5) * 0.14;

      const vm = new THREE.Mesh(vineGeo, vineMat);
      vm.position.set(cx + offset, 3.70 - dropScaleY * 0.16, 1.445 + rng() * 0.03);
      vm.rotation.set(0.18 + rng() * 0.14, (rng() - 0.5) * 0.55, leanZ);
      vm.scale.set(0.95 + rng() * 0.35, dropScaleY, 1.0);
      group.add(vm);

      const vmCross = new THREE.Mesh(vineGeo, vineMat);
      vmCross.position.copy(vm.position);
      vmCross.rotation.set(0.20, 0.95 + rng() * 0.4, leanZ * 0.85);
      vmCross.scale.copy(vm.scale);
      group.add(vmCross);
    }
  });

  return { group };
}
