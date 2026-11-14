import * as THREE from 'three';
import { Tree, BarkType, Billboard, LeafType, TreeType } from '@dgreenheck/ez-tree';
import { mergeTransformedGeometry } from '../core/geometryUtils.js';
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
 * Injects GPU-driven gentle wind sway into botanical foliage/vine materials without extra draw calls.
 * Respects shared `uWindStrength` (attenuated in winter snow) and supports both merged and instanced meshes.
 */
function applyVertexBreeze(
  mat,
  {
    cacheKey,
    anchorY = 0.24,
    spanY = 4.0,
    ampX = 0.04,
    ampZ = 0.03,
    speed = 1.25,
    invertHang = false,
  }
) {
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWindStrength = sharedUniforms.uWindStrength;
    const heightExpr = invertHang
      ? `clamp( ( ${anchorY.toFixed(3)} - lw.y ) / ${spanY.toFixed(3)}, 0.0, 1.0 )`
      : `clamp( ( lw.y - ${anchorY.toFixed(3)} ) / ${spanY.toFixed(3)}, 0.0, 1.0 )`;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindStrength;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 lw = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
        #else
          vec4 lw = modelMatrix * vec4( transformed, 1.0 );
        #endif
        float hW = pow( ${heightExpr}, 1.35 ) * uWindStrength;
        float ph = lw.x * 0.72 + lw.z * 0.62 + lw.y * 0.35;
        float sway = sin( uTime * ${speed.toFixed(3)} + ph ) * 0.65 + sin( uTime * ${(speed * 1.72).toFixed(3)} + ph * 1.5 ) * 0.35;
        transformed.x += sway * ${ampX.toFixed(4)} * hW;
        transformed.z += cos( uTime * ${(speed * 0.84).toFixed(3)} + ph ) * ${ampZ.toFixed(4)} * hW;`
      );
  };
  return mat;
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

  return applyVertexBreeze(mat, {
    cacheKey: 'breeze_broadleaf_v2',
    anchorY: 1.5,
    spanY: 7.5,
    ampX: 0.085,
    ampZ: 0.065,
    speed: 1.25,
  });
}

/**
 * Rewrites ez-tree leaf normals toward a soft sculptural canopy sphere & caches per-quad
 * luminance/jitter factors so seasons crossfade cleanly without rebuilding tree geometry.
 */
function applyCanopyVolumeColors(
  geometry,
  rng,
  outerHex = '#cdf058',
  midHex = '#6fb639',
  deepHex = '#234a1f'
) {
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
  const quadCount = Math.ceil(pos.count / 4);
  const colorData = new Float32Array(quadCount * 4);

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
    const qIdx = (i / 4) * 4;
    colorData[qIdx] = lum;
    colorData[qIdx + 1] = (rng() - 0.5) * 0.035;
    colorData[qIdx + 2] = (rng() - 0.5) * 0.06;
    colorData[qIdx + 3] = (rng() - 0.5) * 0.07;

    for (let k = 0; k < 4 && i + k < pos.count; k++) {
      norm.setXYZ(i + k, dir.x, dir.y, dir.z);
    }
  }

  norm.needsUpdate = true;
  geometry.userData.colorData = colorData;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pal = { outer: outerHex, mid: midHex, deep: deepHex };
  blendCanopyGeometryColors(geometry, pal, pal, 1);
}

const _oA = new THREE.Color();
const _mA = new THREE.Color();
const _dA = new THREE.Color();
const _oB = new THREE.Color();
const _mB = new THREE.Color();
const _dB = new THREE.Color();
const _cA = new THREE.Color();
const _cB = new THREE.Color();

function blendCanopyGeometryColors(geometry, palA, palB, blend) {
  const colorData = geometry.userData.colorData;
  const colAttr = geometry.attributes.color;
  if (!colorData || !colAttr) return;

  _oA.set(palA.outer);
  _mA.set(palA.mid);
  _dA.set(palA.deep);
  _oB.set(palB.outer);
  _mB.set(palB.mid);
  _dB.set(palB.deep);

  const arr = colAttr.array;
  const count = colAttr.count;
  for (let i = 0; i < count; i += 4) {
    const qIdx = (i / 4) * 4;
    const lum = colorData[qIdx];
    const jH = colorData[qIdx + 1];
    const jS = colorData[qIdx + 2];
    const jL = colorData[qIdx + 3];

    if (lum < 0.45) {
      const f = lum / 0.45;
      _cA.lerpColors(_dA, _mA, f);
      _cB.lerpColors(_dB, _mB, f);
    } else {
      const f = (lum - 0.45) / 0.55;
      _cA.lerpColors(_mA, _oA, f);
      _cB.lerpColors(_mB, _oB, f);
    }

    _cA.lerp(_cB, blend);
    _cA.offsetHSL(jH, jS, jL);

    for (let k = 0; k < 4 && i + k < count; k++) {
      const base = (i + k) * 3;
      arr[base] = _cA.r;
      arr[base + 1] = _cA.g;
      arr[base + 2] = _cA.b;
    }
  }
  colAttr.needsUpdate = true;
}

/**
 * Extracts sky-exposed world-space foliage clusters from actual ez-tree geometry
 * so winter snow cushions sit right on real canopy crowns.
 */
function extractCanopySnowClusters(trees) {
  const cellX = 0.64;
  const cellY = 0.48;
  const cellZ = 0.64;
  const columns = new Map();
  const qCenter = new THREE.Vector3();

  trees.forEach((tree) => {
    tree.updateMatrixWorld(true);
    const pos = tree.leavesMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 4) {
      qCenter.set(0, 0, 0);
      for (let k = 0; k < 4 && i + k < pos.count; k++) {
        qCenter.x += pos.getX(i + k);
        qCenter.y += pos.getY(i + k);
        qCenter.z += pos.getZ(i + k);
      }
      qCenter.multiplyScalar(0.25).applyMatrix4(tree.leavesMesh.matrixWorld);
      if (qCenter.y < 2.25) continue;

      const gx = Math.round(qCenter.x / cellX);
      const gy = Math.round(qCenter.y / cellY);
      const gz = Math.round(qCenter.z / cellZ);
      const colKey = `${gx}:${gz}`;
      if (!columns.has(colKey)) columns.set(colKey, new Map());
      const yMap = columns.get(colKey);
      if (!yMap.has(gy)) {
        yMap.set(gy, { sx: 0, sy: 0, sz: 0, maxY: -Infinity, count: 0 });
      }
      const cell = yMap.get(gy);
      cell.sx += qCenter.x;
      cell.sy += qCenter.y;
      cell.sz += qCenter.z;
      cell.maxY = Math.max(cell.maxY, qCenter.y);
      cell.count++;
    }
  });

  const clusters = [];
  for (const yMap of columns.values()) {
    const ys = [...yMap.keys()].sort((a, b) => b - a);
    const topGy = ys[0];
    const topCell = yMap.get(topGy);
    if (topCell.count >= 3) {
      clusters.push({
        x: topCell.sx / topCell.count,
        y: topCell.maxY * 0.62 + (topCell.sy / topCell.count) * 0.38,
        z: topCell.sz / topCell.count,
        radius: THREE.MathUtils.clamp(0.48 + Math.sqrt(topCell.count) * 0.085, 0.56, 1.05),
      });
    }
    if (ys.length > 1) {
      const subCell = yMap.get(ys[1]);
      if (subCell.count >= 6 && topGy - ys[1] >= 2) {
        clusters.push({
          x: subCell.sx / subCell.count,
          y: subCell.maxY * 0.62 + (subCell.sy / subCell.count) * 0.38,
          z: subCell.sz / subCell.count,
          radius: THREE.MathUtils.clamp(0.42 + Math.sqrt(subCell.count) * 0.065, 0.5, 0.88),
        });
      }
    }
  }
  return clusters;
}

function upgradeBarkMaterial(oldMat) {
  return new THREE.MeshStandardMaterial({
    map: oldMat.map || null,
    normalMap: oldMat.normalMap || null,
    aoMap: oldMat.aoMap || null,
    color: new THREE.Color('#c2a488'),
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.34,
  });
}

function isInsideBuildingInteriorCorridor(wp) {
  const in1FOrLeft = wp.x > -4.65 && wp.x < 4.2 && wp.z > -4.15 && wp.z < 1.35 && wp.y < 3.25;
  const in2FLeft = wp.x > -3.7 && wp.x < -0.55 && wp.z > -4.05 && wp.z < -0.2 && wp.y < 5.75;
  const in2FRight = wp.x > -0.85 && wp.x < 4.25 && wp.z > -3.9 && wp.z < 1.4 && wp.y < 6.25;
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
  const safeLocal = new THREE.Vector3(
    tree.position.x,
    tree.position.y,
    tree.position.z
  ).applyMatrix4(invWorld);

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
    mid
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);

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

  const layerMat = applyVertexBreeze(
    new THREE.MeshStandardMaterial({
      map: needleTex,
      color: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide,
      alphaTest: 0.34,
      roughness: 0.82,
      metalness: 0.0,
      envMapIntensity: 0.26,
    }),
    {
      cacheKey: 'breeze_conifer_v1',
      anchorY: 0.35,
      spanY: height,
      ampX: 0.036,
      ampZ: 0.026,
      speed: 1.08,
    }
  );

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
  g.userData.needleMat = layerMat;

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

  const mat = applyVertexBreeze(
    new THREE.MeshStandardMaterial({
      map: needleTex,
      color: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide,
      alphaTest: 0.36,
      roughness: 0.78,
      metalness: 0.0,
      envMapIntensity: 0.28,
    }),
    {
      cacheKey: 'breeze_cypress_v1',
      anchorY: 0.32,
      spanY: height,
      ampX: 0.032,
      ampZ: 0.024,
      speed: 1.15,
    }
  );

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
    const profile = f < 0.22 ? THREE.MathUtils.lerp(0.55, 1.0, f / 0.22) : Math.pow(rem, 0.78);
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
  g.userData.needleMat = mat;

  return g;
}

/**
 * Builds an arching fern cluster rosette (`蕨类植物`) using pinnately divided alpha-cutout fronds.
 */
function createFernClump(fernTex, scale = 1.0, seed = 301) {
  const g = new THREE.Group();
  const rng = createRng(seed);
  const frondMat = applyVertexBreeze(
    new THREE.MeshStandardMaterial({
      map: fernTex,
      color: new THREE.Color('#ffffff'),
      alphaTest: 0.36,
      roughness: 0.72,
      side: THREE.DoubleSide,
      envMapIntensity: 0.3,
    }),
    {
      cacheKey: 'breeze_fern_v1',
      anchorY: 0.25,
      spanY: 0.56,
      ampX: 0.028,
      ampZ: 0.022,
      speed: 1.55,
    }
  );

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
  const dummy = new THREE.Object3D();
  const matrices = [];
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + (rng() - 0.5) * 0.24;
    const isInner = i % 3 === 0;
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(isInner ? -0.3 : 0.08 + rng() * 0.14, a, 0);
    const sc = (isInner ? 0.7 : 0.94 + rng() * 0.22) * scale;
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());
  }
  const mergedFronds = new THREE.Mesh(mergeTransformedGeometry(frondGeo, matrices), frondMat);
  mergedFronds.castShadow = true;
  mergedFronds.receiveShadow = true;
  g.add(mergedFronds);
  frondGeo.dispose();

  g.userData.frondMat = frondMat;
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

  const dummy = new THREE.Object3D();
  const matrices = [];
  for (let ring = 0; ring < 2; ring++) {
    const count = ring === 0 ? 11 : 7;
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(ring === 0 ? 0.12 : -0.32, (i / count) * Math.PI * 2 + ring * 0.38, 0);
      dummy.scale.setScalar((ring === 0 ? 1.05 : 0.74) * scale);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
    }
  }
  const mergedHosta = new THREE.Mesh(mergeTransformedGeometry(leafGeo, matrices), mat);
  mergedHosta.castShadow = true;
  mergedHosta.receiveShadow = true;
  g.add(mergedHosta);
  leafGeo.dispose();

  g.userData.hostaMat = mat;
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

  // Layered basal botanical leaf cards radiating outward (merged to 1 draw call per shrub)
  const leafPlane = new THREE.PlaneGeometry(width * 0.72, width * 0.72);
  const dummy = new THREE.Object3D();
  const leafMatrices = [];
  const leafCount = 9;
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2 + rng() * 0.35;
    const dist = width * (0.12 + rng() * 0.14);
    dummy.position.set(Math.cos(a) * dist, height * (0.28 + rng() * 0.16), Math.sin(a) * dist);
    dummy.rotation.set(-0.65 + (rng() - 0.5) * 0.35, a + rng() * 0.5, (rng() - 0.5) * 0.4);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    leafMatrices.push(dummy.matrix.clone());
  }
  const mergedLeaves = new THREE.Mesh(mergeTransformedGeometry(leafPlane, leafMatrices), leafMat);
  mergedLeaves.castShadow = true;
  mergedLeaves.receiveShadow = true;
  g.add(mergedLeaves);
  leafPlane.dispose();

  if (spikes) {
    // Tall crossed botanical raceme spikes (purple lavender / salvia)
    const bloomMat = applyVertexBreeze(
      new THREE.MeshStandardMaterial({
        map: spikeTex,
        color: new THREE.Color(bloomColor),
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        roughness: 0.72,
      }),
      {
        cacheKey: 'breeze_spike_v1',
        anchorY: 0.24,
        spanY: height,
        ampX: 0.026,
        ampZ: 0.02,
        speed: 1.44,
      }
    );
    const spikeGeo = new THREE.PlaneGeometry(0.24, height * 0.92);
    const spikeMatrices = [];
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
        dummy.position.set(sx, sy, sz);
        dummy.rotation.set(tiltX, a + cross * (Math.PI * 0.5), tiltZ);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        spikeMatrices.push(dummy.matrix.clone());
      }
    }
    const mergedSpikes = new THREE.Mesh(
      mergeTransformedGeometry(spikeGeo, spikeMatrices),
      bloomMat
    );
    mergedSpikes.castShadow = true;
    g.add(mergedSpikes);
    spikeGeo.dispose();

    g.userData.leafMat = leafMat;
    g.userData.bloomMat = bloomMat;
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
    const bloomMatrices = [];
    const clusterCount = 10;
    for (let i = 0; i < clusterCount; i++) {
      const a = (i / clusterCount) * Math.PI * 2 + rng() * 0.4;
      const dist = i < 2 ? rng() * width * 0.1 : width * (0.16 + rng() * 0.18);
      const cx = Math.cos(a) * dist;
      const cz = Math.sin(a) * dist;
      const cy = height * (0.48 + (i < 2 ? 0.22 : rng() * 0.16));

      for (let p = 0; p < 3; p++) {
        dummy.position.set(cx, cy, cz);
        dummy.rotation.set((p - 1) * 0.48, a + p * (Math.PI / 3), (rng() - 0.5) * 0.3);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        bloomMatrices.push(dummy.matrix.clone());
      }
    }
    const mergedBlooms = new THREE.Mesh(mergeTransformedGeometry(flPlane, bloomMatrices), bloomMat);
    mergedBlooms.castShadow = true;
    g.add(mergedBlooms);
    flPlane.dispose();

    g.userData.leafMat = leafMat;
    g.userData.bloomMat = bloomMat;
  }

  return g;
}

function createFallenLeafTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);

  // Lobed autumn maple / crisp leaf silhouette
  ctx.save();
  ctx.translate(32, 34);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(-2, 10);
  ctx.quadraticCurveTo(-18, 12, -22, 2);
  ctx.quadraticCurveTo(-15, -2, -23, -12);
  ctx.quadraticCurveTo(-10, -11, -7, -25);
  ctx.lineTo(0, -17);
  ctx.lineTo(7, -25);
  ctx.quadraticCurveTo(10, -11, 23, -12);
  ctx.quadraticCurveTo(15, -2, 22, 2);
  ctx.quadraticCurveTo(18, 12, 2, 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(0, -15);
  ctx.moveTo(0, 2);
  ctx.lineTo(-14, -7);
  ctx.moveTo(0, 2);
  ctx.lineTo(14, -7);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function pointInXZPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const zi = poly[i].z;
    const xj = poly[j].x;
    const zj = poly[j].z;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-6) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function createAutumnLeafLitter(outlineCurve, rng) {
  const leafCount = 300;
  const fallenTex = createFallenLeafTexture();
  const geo = new THREE.PlaneGeometry(0.32, 0.32);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    map: fallenTex,
    color: new THREE.Color('#ffffff'),
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0.0,
    envMapIntensity: 0.24,
  });

  const inst = new THREE.InstancedMesh(geo, mat, leafCount);
  inst.receiveShadow = true;
  inst.castShadow = false;
  inst.visible = false;

  const poly = outlineCurve
    ? outlineCurve.getSpacedPoints(96).map((p) => ({ x: p.x * 0.9, z: p.z * 0.9 }))
    : null;

  const focusSpots = [
    { x: -5.4, z: -0.2, r: 2.5 },
    { x: -3.2, z: 3.1, r: 2.2 },
    { x: -0.5, z: 4.1, r: 2.0 },
    { x: 2.6, z: 3.9, r: 2.2 },
    { x: 5.5, z: -0.8, r: 2.2 },
    { x: 5.9, z: 2.4, r: 2.0 },
    { x: 1.5, z: -4.8, r: 2.0 },
    { x: -5.9, z: 1.8, r: 1.9 },
  ];

  const palette = ['#f0be2d', '#dc6c18', '#e8961e', '#b84214', '#f6d452', '#cf5616'];
  const c = new THREE.Color();
  const dummy = new THREE.Object3D();
  const baseTransforms = [];

  for (let i = 0; i < leafCount; i++) {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      const spot = focusSpots[(i + attempt) % focusSpots.length];
      const ang = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * spot.r;
      const tx = spot.x + Math.cos(ang) * dist;
      const tz = spot.z + Math.sin(ang) * dist;

      // Stay clear of boutique interior & entrance steps
      if (tx > -4.05 && tx < 3.85 && tz > -3.75 && tz < 0.7) continue;
      if (tx > -1.35 && tx < 1.35 && tz > 0.55 && tz < 2.25) continue;
      if (poly && !pointInXZPoly(tx, tz, poly)) continue;
      x = tx;
      z = tz;
      break;
    }

    const y = 0.228 + rng() * 0.032;
    const rx = (rng() - 0.5) * 0.28;
    const ry = rng() * Math.PI * 2;
    const rz = (rng() - 0.5) * 0.28;
    const s = 0.72 + rng() * 0.66;

    baseTransforms.push({ x, y, z, rx, ry, rz, s });
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);

    c.set(palette[Math.floor(rng() * palette.length)]).offsetHSL(
      (rng() - 0.5) * 0.03,
      (rng() - 0.5) * 0.08,
      (rng() - 0.5) * 0.08
    );
    inst.setColorAt(i, c);
  }

  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

  let lastWeight = -1;
  function setWeight(w) {
    if (Math.abs(w - lastWeight) < 0.004) return;
    lastWeight = w;
    if (w <= 0.01) {
      inst.visible = false;
      return;
    }
    inst.visible = true;
    const ease = THREE.MathUtils.smoothstep(w, 0.0, 1.0);
    for (let i = 0; i < leafCount; i++) {
      const t = baseTransforms[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(t.rx, t.ry, t.rz);
      dummy.scale.setScalar(Math.max(0.001, t.s * ease));
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  return { inst, setWeight };
}

export function createBotanicalGarden({ outlineCurve = null } = {}) {
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
      gnarl0: 0.1,
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

  const trees = [];
  const treeRootShadows = [];

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
    tree.options.branch.taper = { 0: 0.7, 1: 0.56, 2: 0.68, 3: 0.52 };
    tree.options.branch.twist = { 0: 0.1, 1: -0.1, 2: 0.06, 3: 0 };

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
    trees.push(tree);

    const rootShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      createContactShadowMaterial({ opacity: 0.4, roundness: 0.9 })
    );
    rootShadow.rotation.x = -Math.PI / 2;
    rootShadow.position.set(s.pos[0], s.pos[1] + 0.015, s.pos[2]);
    group.add(rootShadow);
    treeRootShadows.push(rootShadow);
  });

  // Extract sky-exposed canopy clusters BEFORE AssemblyController moves trees for intro!
  const canopySnowClusters = extractCanopySnowClusters(trees);

  // ==========================================================
  // 2. REAR CONIFERS (3 Evergreen Spruces behind 2F roofline, clear of rear door!)
  // ==========================================================
  const coniferSpecs = [
    { x: -0.35, z: -5.55, h: 7.45, r: 1.38, seed: 501 },
    { x: 0.85, z: -5.75, h: 8.15, r: 1.48, seed: 502 },
    { x: 2.05, z: -5.45, h: 7.15, r: 1.3, seed: 503 },
  ];
  const conifers = [];
  coniferSpecs.forEach((c) => {
    const spruce = createConiferSpruceTree(coniferTex, barkGenericMat, c.h, c.r, c.seed);
    spruce.position.set(c.x, 0.24, c.z);
    group.add(spruce);
    conifers.push(spruce);
  });

  // ==========================================================
  // 3. COLUMNAR CYPRESS SPIRES (`柱形常绿植物`, matching 基准图.png)
  // ==========================================================
  const cypressSpecs = [
    { x: -3.72, z: 1.85, h: 4.55, r: 0.46, seed: 601 },
    { x: -4.65, z: 2.35, h: 2.85, r: 0.36, seed: 602 },
    { x: 7.05, z: 1.45, h: 4.15, r: 0.44, seed: 603 },
  ];
  const cypresses = [];
  cypressSpecs.forEach((cp) => {
    const cy = createColumnarCypress(coniferTex, barkGenericMat, cp.h, cp.r, cp.seed);
    cy.position.set(cp.x, 0.22, cp.z);
    group.add(cy);
    cypresses.push(cy);
  });

  // ==========================================================
  // 4. FOREGROUND & COURTYARD UNDERSTORY FLORA
  // ==========================================================

  const fernCoords = [
    [-6.05, 0.24, 1.45, 1.25, 701],
    [-7.05, 0.24, 0.55, 1.05, 702],
    [-4.95, 0.24, 2.2, 0.92, 703],
    [3.05, 0.24, 1.15, 0.85, 704],
    [6.15, 0.24, 0.85, 0.95, 705],
    [6.65, 0.24, 1.55, 0.88, 706],
  ];
  const ferns = [];
  fernCoords.forEach(([x, y, z, s, seed]) => {
    const f = createFernClump(fernTex, s, seed);
    f.position.set(x, y, z);
    group.add(f);
    ferns.push(f);
  });

  // Signature Front-Left & Courtyard Variegated Hosta Rosettes
  const hostaItems = [
    { pos: [-4.02, 0.22, 4.15], scale: 1.22 },
    { pos: [5.65, 0.22, 3.85], scale: 0.95 },
  ];
  const hostas = hostaItems.map((hi) => {
    const h = createVariegatedHosta(hi.scale);
    h.position.set(hi.pos[0], hi.pos[1], hi.pos[2]);
    group.add(h);
    return h;
  });

  const shrubSpecs = [
    {
      x: -4.95,
      z: 2.95,
      w: 1.12,
      h: 0.84,
      bloom: '#fcf7ec',
      spikes: false,
      role: 'hydrangea',
      seed: 801,
    },
    {
      x: -3.55,
      z: 2.55,
      w: 0.92,
      h: 0.72,
      bloom: '#9872dc',
      spikes: true,
      role: 'spike',
      seed: 816,
    },
    {
      x: -3.15,
      z: 3.45,
      w: 1.02,
      h: 0.96,
      bloom: '#825ad6',
      spikes: true,
      role: 'spike',
      seed: 802,
    },
    {
      x: -2.35,
      z: 3.85,
      w: 0.88,
      h: 0.65,
      bloom: '#eda2be',
      spikes: false,
      role: 'pinkMound',
      seed: 803,
    },
    {
      x: -6.15,
      z: 2.95,
      w: 0.8,
      h: 0.54,
      bloom: '#d8de58',
      spikes: false,
      role: 'yellow',
      seed: 804,
    },
    {
      x: -2.08,
      z: 1.45,
      w: 0.86,
      h: 0.68,
      bloom: '#f7f1e3',
      spikes: false,
      role: 'hydrangeaAlt',
      seed: 805,
    },

    {
      x: 2.95,
      z: 2.05,
      w: 1.04,
      h: 0.82,
      bloom: '#faf6ec',
      spikes: false,
      role: 'hydrangea',
      seed: 806,
    },
    { x: 3.35, z: 4.1, w: 1.16, h: 0.98, bloom: '#845cd8', spikes: true, role: 'spike', seed: 807 },
    {
      x: 4.12,
      z: 4.55,
      w: 0.9,
      h: 0.62,
      bloom: '#e898ba',
      spikes: false,
      role: 'pinkMound',
      seed: 808,
    },
    {
      x: 2.25,
      z: 4.65,
      w: 0.86,
      h: 0.56,
      bloom: '#fcf8ee',
      spikes: false,
      role: 'hydrangeaAlt',
      seed: 809,
    },
    {
      x: 6.85,
      z: 2.25,
      w: 0.98,
      h: 0.84,
      bloom: '#865fda',
      spikes: true,
      role: 'spike',
      seed: 810,
    },
    {
      x: 7.25,
      z: 1.95,
      w: 0.82,
      h: 0.58,
      bloom: '#fcf8ee',
      spikes: false,
      role: 'hydrangea',
      seed: 817,
    },

    {
      x: 5.05,
      z: -1.45,
      w: 0.95,
      h: 0.74,
      bloom: '#f8f4ea',
      spikes: false,
      role: 'hydrangeaAlt',
      seed: 812,
    },
    {
      x: 5.15,
      z: -2.65,
      w: 0.92,
      h: 0.72,
      bloom: '#f8f4ea',
      spikes: false,
      role: 'hydrangea',
      seed: 813,
    },

    {
      x: -2.55,
      z: -4.95,
      w: 1.1,
      h: 0.78,
      bloom: '#f8f4ea',
      spikes: false,
      role: 'hydrangea',
      seed: 814,
    },
    {
      x: 1.95,
      z: -4.65,
      w: 1.0,
      h: 0.78,
      bloom: '#8b65dc',
      spikes: true,
      role: 'spike',
      seed: 815,
    },
  ];

  const shrubs = [];
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
    mound.userData.role = s.role;
    group.add(mound);
    shrubs.push(mound);
  });

  // ==========================================================
  // 5. 2F PLANTER BOX FROTHY BLOOMS & ORGANIC TRAILING IVY SWAGS
  // ==========================================================
  const planterFloraGroup = new THREE.Group();
  planterFloraGroup.name = 'PlanterFlora2F';
  group.add(planterFloraGroup);

  const planterLeafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    color: new THREE.Color('#6ca83b'),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.75,
  });
  const planterBloomPrimaryMat = new THREE.MeshStandardMaterial({
    map: hydrangeaTex,
    color: new THREE.Color('#fcf9ef'),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.74,
  });
  const planterBloomSecondaryMat = new THREE.MeshStandardMaterial({
    map: hydrangeaTex,
    color: new THREE.Color('#faf6e8'),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.74,
  });
  const vineMat = applyVertexBreeze(
    new THREE.MeshStandardMaterial({
      map: ivyTex,
      color: new THREE.Color('#b6e074'),
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.72,
    }),
    {
      cacheKey: 'breeze_ivy_v1',
      anchorY: 3.72,
      spanY: 0.48,
      ampX: 0.03,
      ampZ: 0.022,
      speed: 1.48,
      invertHang: true,
    }
  );

  const planterLeafGeo = new THREE.PlaneGeometry(0.44, 0.44);
  const planterBloomGeo = new THREE.PlaneGeometry(0.36, 0.36);
  const vineGeo = new THREE.PlaneGeometry(0.26, 0.46);

  const planterDummy = new THREE.Object3D();
  const pLeafMatrices = [];
  const pPrimaryMatrices = [];
  const pSecondaryMatrices = [];
  const pVineMatrices = [];

  for (let i = 0; i < 24; i++) {
    const x = THREE.MathUtils.lerp(-0.18, 3.54, i / 23) + (rng() - 0.5) * 0.05;

    for (let c = 0; c < 2; c++) {
      planterDummy.position.set(x, 3.88 + rng() * 0.06, 1.24 + (rng() - 0.5) * 0.06);
      planterDummy.rotation.set(
        -0.35 + rng() * 0.65,
        c * Math.PI * 0.5 + rng() * 0.45,
        (rng() - 0.5) * 0.35
      );
      planterDummy.scale.setScalar(1);
      planterDummy.updateMatrix();
      pLeafMatrices.push(planterDummy.matrix.clone());
    }

    for (let b = 0; b < 2; b++) {
      planterDummy.position.set(x + (rng() - 0.5) * 0.06, 3.94 + rng() * 0.09, 1.32 + rng() * 0.05);
      planterDummy.rotation.set(0.18 + rng() * 0.48, b * 1.25 + rng() * 0.45, (rng() - 0.5) * 0.42);
      planterDummy.scale.setScalar(1);
      planterDummy.updateMatrix();
      if ((i + b) % 2 === 0) {
        pPrimaryMatrices.push(planterDummy.matrix.clone());
      } else {
        pSecondaryMatrices.push(planterDummy.matrix.clone());
      }
    }
  }

  // Natural grouped trailing ivy cascades across full 2F planter (`基准图.png` spilling swags)
  const swagCenters = [-0.1, 0.3, 0.72, 1.16, 1.62, 2.08, 2.52, 2.96, 3.38];
  swagCenters.forEach((cx, sIdx) => {
    const tendrils = sIdx === 0 || sIdx === swagCenters.length - 1 || sIdx % 2 === 0 ? 4 : 3;
    for (let k = 0; k < tendrils; k++) {
      const offset = (k - (tendrils - 1) * 0.5) * 0.13 + (rng() - 0.5) * 0.05;
      const dropScaleY = (0.52 + rng() * 0.74) * (k === Math.floor(tendrils / 2) ? 1.24 : 0.82);
      const leanZ = (k - (tendrils - 1) * 0.5) * 0.22 + (rng() - 0.5) * 0.14;

      planterDummy.position.set(cx + offset, 3.7 - dropScaleY * 0.16, 1.445 + rng() * 0.03);
      planterDummy.rotation.set(0.18 + rng() * 0.14, (rng() - 0.5) * 0.55, leanZ);
      planterDummy.scale.set(0.95 + rng() * 0.35, dropScaleY, 1.0);
      planterDummy.updateMatrix();
      pVineMatrices.push(planterDummy.matrix.clone());

      planterDummy.rotation.set(0.2, 0.95 + rng() * 0.4, leanZ * 0.85);
      planterDummy.updateMatrix();
      pVineMatrices.push(planterDummy.matrix.clone());
    }
  });

  planterFloraGroup.add(
    new THREE.Mesh(mergeTransformedGeometry(planterLeafGeo, pLeafMatrices), planterLeafMat),
    new THREE.Mesh(
      mergeTransformedGeometry(planterBloomGeo, pPrimaryMatrices),
      planterBloomPrimaryMat
    ),
    new THREE.Mesh(
      mergeTransformedGeometry(planterBloomGeo, pSecondaryMatrices),
      planterBloomSecondaryMat
    ),
    new THREE.Mesh(mergeTransformedGeometry(vineGeo, pVineMatrices), vineMat)
  );
  planterLeafGeo.dispose();
  planterBloomGeo.dispose();
  vineGeo.dispose();

  // ==========================================================
  // 6. AUTUMN CRISP FALLEN LEAF LITTER (`autumnLitterWeight`)
  // ==========================================================
  const leafLitter = createAutumnLeafLitter(outlineCurve, rng);
  group.add(leafLitter.inst);

  // Smooth seasonal interpolation state
  const cLeafA = new THREE.Color();
  const cLeafB = new THREE.Color();
  const cBloomA = new THREE.Color();
  const cBloomB = new THREE.Color();
  let lastCanopyKey = '';

  function updateSeasonTransition(presetA, presetB, blend) {
    const t = THREE.MathUtils.clamp(blend, 0, 1);
    const canopyKey = `${presetA.key}:${presetB.key}:${t.toFixed(3)}`;
    if (canopyKey !== lastCanopyKey) {
      lastCanopyKey = canopyKey;
      trees.forEach((tree, idx) => {
        const palA = presetA.canopyPalettes[idx] || presetA.canopyPalettes[0];
        const palB = presetB.canopyPalettes[idx] || presetB.canopyPalettes[0];
        blendCanopyGeometryColors(tree.leavesMesh.geometry, palA, palB, t);
      });
    }

    conifers.forEach((sp) => {
      if (sp.userData.needleMat)
        sp.userData.needleMat.color.lerpColors(presetA.coniferTint, presetB.coniferTint, t);
    });
    cypresses.forEach((cp) => {
      if (cp.userData.needleMat)
        cp.userData.needleMat.color.lerpColors(presetA.cypressTint, presetB.cypressTint, t);
    });
    ferns.forEach((f) => {
      if (f.userData.frondMat)
        f.userData.frondMat.color.lerpColors(presetA.fernTint, presetB.fernTint, t);
    });
    hostas.forEach((h) => {
      if (h.userData.hostaMat)
        h.userData.hostaMat.color.lerpColors(presetA.hostaTint, presetB.hostaTint, t);
    });

    planterLeafMat.color.lerpColors(presetA.planterLeafTint, presetB.planterLeafTint, t);
    planterBloomPrimaryMat.color.lerpColors(
      presetA.planterBloomPrimary,
      presetB.planterBloomPrimary,
      t
    );
    planterBloomSecondaryMat.color.lerpColors(
      presetA.planterBloomSecondary,
      presetB.planterBloomSecondary,
      t
    );
    vineMat.color.lerpColors(presetA.vineTint, presetB.vineTint, t);

    cLeafA.set(presetA.shrubPalette.leaf);
    cLeafB.set(presetB.shrubPalette.leaf);
    shrubs.forEach((mound) => {
      if (mound.userData.leafMat) mound.userData.leafMat.color.lerpColors(cLeafA, cLeafB, t);
      const role = mound.userData.role || 'hydrangea';
      if (mound.userData.bloomMat) {
        cBloomA.set(presetA.shrubPalette[role] || presetA.shrubPalette.hydrangea);
        cBloomB.set(presetB.shrubPalette[role] || presetB.shrubPalette.hydrangea);
        mound.userData.bloomMat.color.lerpColors(cBloomA, cBloomB, t);
      }
    });

    const litterWeight = THREE.MathUtils.lerp(
      presetA.autumnLitterWeight,
      presetB.autumnLitterWeight,
      t
    );
    leafLitter.setWeight(litterWeight);
  }

  return {
    group,
    canopySnowClusters,
    coniferSpecs,
    cypressSpecs,
    fernCoords,
    hostaItems,
    shrubSpecs,
    assemblyPieces: {
      planterFloraGroup,
      trees,
      treeRootShadows,
      conifers,
      cypresses,
      ferns,
      hostas,
      shrubs,
      leafLitterMesh: leafLitter.inst,
    },
    updateSeasonTransition,
  };
}
