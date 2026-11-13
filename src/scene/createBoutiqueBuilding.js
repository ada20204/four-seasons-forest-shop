import * as THREE from 'three';
import {
  createStuccoTextures,
  createStackedStoneTextures,
  createWoodTextures,
  createClearStorefrontGlassMaterial,
  createBroadleafSprayTexture,
  createHydrangeaClusterTexture,
} from '../materials/studioMaterials.js';

function createRng(seed = 314159) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Creates a sculpted draped boutique garment (coat/shirt/dress) hanging on a brass hook.
 */
function createGarment(matFabric, brassMat, { length = 0.72, width = 0.24, flared = false } = {}) {
  const g = new THREE.Group();

  // Slim hanger hook + shoulder bar
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12, Math.PI * 1.2), brassMat);
  hook.position.set(0, 0.04, 0);
  g.add(hook);

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, width * 0.96, 6), brassMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.y = 0.01;
  g.add(bar);

  // Draped garment torso/skirt geometry (oriented perpendicular to rail so profiles show cleanly!)
  const botR = flared ? width * 0.62 : width * 0.42;
  const bodyGeo = new THREE.CylinderGeometry(width * 0.36, botR, length, 8, 1);
  bodyGeo.scale(0.45, 1.0, 1.0);
  const body = new THREE.Mesh(bodyGeo, matFabric);
  body.position.y = -length * 0.5 - 0.01;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  return g;
}

/**
 * Creates a standing timber-and-brass clothing rack populated with sculpted garments.
 */
function createBoutiqueRack(length, height, brassMat, garmentMats, rng, count = 8) {
  const g = new THREE.Group();

  // Left & right upright arch posts
  for (const sx of [-length * 0.5, length * 0.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, height, 8), brassMat);
    post.position.set(sx, height * 0.5, 0);
    g.add(post);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.34), brassMat);
    foot.position.set(sx, 0.012, 0);
    g.add(foot);
  }

  // Horizontal hang bar
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, length + 0.03, 10), brassMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.y = height;
  g.add(rail);

  for (let i = 0; i < count; i++) {
    const t = (i + 0.7) / (count + 0.4);
    const x = THREE.MathUtils.lerp(-length * 0.46, length * 0.46, t);
    const fMat = garmentMats[i % garmentMats.length];
    const isDress = i % 4 === 2;
    const item = createGarment(fMat, brassMat, {
      length: isDress ? 0.86 : 0.62 + rng() * 0.14,
      width: 0.24 + rng() * 0.05,
      flared: isDress,
    });
    item.position.set(x, height - 0.035, 0);
    // Garment faces +X along rail (tiny organic twist)
    item.rotation.y = (rng() - 0.5) * 0.14;
    g.add(item);
  }

  return g;
}

/**
 * Builds the iconic front-right window tailor's dress mannequin on a low oak pedestal.
 */
function createShowcaseMannequin(oakMat, brassMat) {
  const g = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.12, 24), oakMat);
  plinth.position.y = 0.06;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  g.add(plinth);

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.92, 10), brassMat);
  stand.position.y = 0.54;
  g.add(stand);

  const dressMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#efe4cf'),
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.35,
  });
  const formMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e6d7be'),
    roughness: 0.72,
    metalness: 0.02,
  });

  // Flared pleated midi dress skirt + fitted bodice
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.27, 0.72, 18), dressMat);
  skirt.scale.set(1.0, 1.0, 0.82);
  skirt.position.y = 0.74;
  skirt.castShadow = true;
  g.add(skirt);

  const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.105, 0.34, 16), dressMat);
  bodice.scale.set(1.0, 1.0, 0.72);
  bodice.position.y = 1.24;
  bodice.castShadow = true;
  g.add(bodice);

  // Subtle belt ribbon
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.112, 0.032, 16),
    new THREE.MeshStandardMaterial({ color: '#c49b68', roughness: 0.6 })
  );
  belt.scale.set(1.0, 1.0, 0.76);
  belt.position.y = 1.09;
  g.add(belt);

  // Neck + sculptural dress form cap
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.14, 12), formMat);
  neck.position.y = 1.46;
  g.add(neck);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), formMat);
  finial.position.y = 1.54;
  g.add(finial);

  return g;
}

/**
 * Builds a small potted indoor ficus/olive plant for boutique interior corners & upper window.
 */
function createIndoorPottedPlant(potMat, leafSprayMat, scale = 1.0) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.26, 14), potMat);
  pot.position.y = 0.13;
  g.add(pot);

  const barkMat = new THREE.MeshStandardMaterial({ color: '#5c4636', roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.028, 0.56, 6), barkMat);
  trunk.position.y = 0.48;
  g.add(trunk);

  // Articulated upper branch stems
  for (const [ang, tilt] of [[0.4, 0.35], [2.4, 0.32], [4.4, 0.38]]) {
    const sub = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.26, 5), barkMat);
    sub.position.set(Math.cos(ang) * 0.07, 0.72, Math.sin(ang) * 0.07);
    sub.rotation.z = -Math.cos(ang) * tilt;
    sub.rotation.x = Math.sin(ang) * tilt;
    g.add(sub);
  }

  // Crisp alpha-cutout broadleaf spray planes instead of geometric spheres
  const cardGeo = new THREE.PlaneGeometry(0.38, 0.38);
  const clusters = [
    [0, 0.84, 0, 0, 0],
    [0, 0.84, 0, Math.PI * 0.5, 0.15],
    [0.11, 0.72, 0.08, 0.9, 0.35],
    [-0.11, 0.75, 0.07, -0.7, -0.30],
    [0.05, 0.68, -0.10, 2.2, 0.28],
    [-0.06, 0.92, -0.04, 1.3, -0.22],
  ];
  clusters.forEach(([x, y, z, ry, rx]) => {
    const c = new THREE.Mesh(cardGeo, leafSprayMat);
    c.position.set(x, y, z);
    c.rotation.set(rx, ry, rx * 0.4);
    g.add(c);
  });

  g.scale.setScalar(scale);
  return g;
}

/**
 * Creates a recessed window frame opening using 4 surround strips + glass pane + mullions.
 */
function buildWindowUnit({ width, height, frameMat, glassMat, bays = 1, hasDoorSplit = false }) {
  const g = new THREE.Group();
  const fThick = 0.055;
  const fDepth = 0.095;

  // Perimeter frame
  const topB = new THREE.Mesh(new THREE.BoxGeometry(width, fThick, fDepth), frameMat);
  topB.position.y = height * 0.5 - fThick * 0.5;
  g.add(topB);

  const botB = new THREE.Mesh(new THREE.BoxGeometry(width, fThick, fDepth), frameMat);
  botB.position.y = -height * 0.5 + fThick * 0.5;
  g.add(botB);

  for (const sx of [-width * 0.5 + fThick * 0.5, width * 0.5 - fThick * 0.5]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(fThick, height, fDepth), frameMat);
    side.position.x = sx;
    g.add(side);
  }

  // Interior vertical mullions
  for (let b = 1; b < bays; b++) {
    const x = THREE.MathUtils.lerp(-width * 0.5, width * 0.5, b / bays);
    const mul = new THREE.Mesh(new THREE.BoxGeometry(0.042, height - fThick, fDepth * 0.85), frameMat);
    mul.position.x = x;
    g.add(mul);
  }

  if (hasDoorSplit) {
    // Center meeting stiles & horizontal transom bar + brass door pulls
    const transomY = height * 0.28;
    const transom = new THREE.Mesh(new THREE.BoxGeometry(width - fThick, 0.045, fDepth * 0.85), frameMat);
    transom.position.y = transomY;
    g.add(transom);

    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.048, height * 0.78, fDepth * 0.9), frameMat);
    stile.position.y = -height * 0.11;
    g.add(stile);

    const handleMat = new THREE.MeshStandardMaterial({ color: '#c49b5a', metalness: 0.75, roughness: 0.28 });
    for (const hx of [-0.07, 0.07]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), handleMat);
      h.position.set(hx, -height * 0.12, fDepth * 0.55);
      g.add(h);
    }
  }

  // Physical clear glass pane
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(width - fThick * 1.4, height - fThick * 1.4),
    glassMat
  );
  g.add(glass);

  return g;
}

export function createBoutiqueBuilding() {
  const group = new THREE.Group();
  group.name = 'ForestBoutiqueBuilding';

  const rng = createRng(998877);

  // Material Palette (Carefully calibrated for AgX + N8AO)
  const stuccoTex = createStuccoTextures();
  const stuccoMat = new THREE.MeshStandardMaterial({
    map: stuccoTex.map,
    bumpMap: stuccoTex.bumpMap,
    bumpScale: 0.012,
    color: new THREE.Color('#f6f1e8'),
    roughness: 0.84,
    metalness: 0.02,
    envMapIntensity: 0.36,
  });

  const stoneTex = createStackedStoneTextures();
  const stoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex.map,
    bumpMap: stoneTex.bumpMap,
    bumpScale: 0.032,
    color: new THREE.Color('#aeb3ba'),
    roughness: 0.82,
    metalness: 0.05,
    envMapIntensity: 0.38,
  });

  const cedarTex = createWoodTextures({ baseHex: '#a85a25', grainHex: '#6c3410', repeat: [1, 2] });
  const cedarMat = new THREE.MeshStandardMaterial({
    map: cedarTex.map,
    bumpMap: cedarTex.bumpMap,
    bumpScale: 0.015,
    roughness: 0.64,
    metalness: 0.04,
    envMapIntensity: 0.42,
  });

  const oakTex = createWoodTextures({ baseHex: '#cfa776', grainHex: '#a57c4b', repeat: [3, 3] });
  const oakMat = new THREE.MeshStandardMaterial({
    map: oakTex.map,
    bumpMap: oakTex.bumpMap,
    bumpScale: 0.01,
    roughness: 0.62,
    metalness: 0.03,
    envMapIntensity: 0.42,
  });

  const interiorWallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f2dec0'),
    roughness: 0.84,
    metalness: 0.01,
    envMapIntensity: 0.25,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#27292e'),
    roughness: 0.48,
    metalness: 0.38,
    envMapIntensity: 0.72,
  });

  const roofMembraneMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3a3e44'),
    roughness: 0.88,
    metalness: 0.05,
    envMapIntensity: 0.3,
  });

  const glassMat = createClearStorefrontGlassMaterial();

  const warmLedMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff5dc'),
    emissive: new THREE.Color('#ffb854'),
    emissiveIntensity: 6.4,
    roughness: 0.2,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cca15a'),
    roughness: 0.28,
    metalness: 0.78,
    envMapIntensity: 0.95,
  });

  const garmentMats = [
    new THREE.MeshStandardMaterial({ color: '#7b8d72', roughness: 0.82 }), // sage green
    new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: 0.82 }), // oat cream
    new THREE.MeshStandardMaterial({ color: '#c49b6a', roughness: 0.82 }), // warm camel
    new THREE.MeshStandardMaterial({ color: '#474c52', roughness: 0.82 }), // charcoal wool
    new THREE.MeshStandardMaterial({ color: '#b8826e', roughness: 0.82 }), // muted terracotta
    new THREE.MeshStandardMaterial({ color: '#9ba394', roughness: 0.82 }), // lichen olive
  ];

  // ==========================================================
  // 1. GROUND FLOOR SHELL & ARCHITECTURE (Y: 0.22 .. 3.06)
  // ==========================================================

  // Warm interior oak floor slab
  const floor1F = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.14, 4.3), oakMat);
  floor1F.position.set(-0.2, 0.29, -1.72);
  floor1F.receiveShadow = true;
  group.add(floor1F);

  // Right stacked-stone pier & full right facade wall (X: 2.55 .. 3.92, Z: -4.02 .. 0.48)
  const rightPierWall = new THREE.Mesh(new THREE.BoxGeometry(1.37, 2.74, 4.50), stoneMat);
  rightPierWall.position.set(3.235, 1.59, -1.77);
  rightPierWall.castShadow = true;
  rightPierWall.receiveShadow = true;
  group.add(rightPierWall);

  // Far-left corner stone wall (X: -4.45 .. -4.10, Z: -4.02 .. 0.48)
  const leftCornerWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.74, 4.50), stoneMat);
  leftCornerWall.position.set(-4.275, 1.59, -1.77);
  leftCornerWall.castShadow = true;
  leftCornerWall.receiveShadow = true;
  group.add(leftCornerWall);

  // Rear masonry wall (with rear staff door opening feel cleanly recessed)
  const rearWall1F = new THREE.Mesh(new THREE.BoxGeometry(8.35, 2.74, 0.28), stoneMat);
  rearWall1F.position.set(-0.25, 1.59, -3.88);
  rearWall1F.castShadow = true;
  rearWall1F.receiveShadow = true;
  group.add(rearWall1F);

  // Back facade architectural glazed staff door + warm interior backing + clerestory window (for 360° orbit inspection)
  const backDoorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 2.04),
    new THREE.MeshStandardMaterial({
      color: '#ffe0a4',
      emissive: '#ffaa44',
      emissiveIntensity: 1.95,
      roughness: 0.35,
    })
  );
  backDoorGlow.position.set(-1.6, 1.44, -4.022);
  backDoorGlow.rotation.y = Math.PI;
  group.add(backDoorGlow);

  const backDoor = buildWindowUnit({
    width: 1.05,
    height: 2.15,
    frameMat: darkTrimMat,
    glassMat,
    bays: 1,
  });
  backDoor.position.set(-1.6, 1.44, -4.035);
  backDoor.rotation.y = Math.PI;
  group.add(backDoor);

  const backWindowGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.62),
    new THREE.MeshStandardMaterial({
      color: '#ffe2ad',
      emissive: '#ffaa44',
      emissiveIntensity: 2.25,
      roughness: 0.35,
    })
  );
  backWindowGlow.position.set(1.2, 2.18, -4.025);
  backWindowGlow.rotation.y = Math.PI;
  group.add(backWindowGlow);

  const backWinFrame = buildWindowUnit({
    width: 2.48,
    height: 0.68,
    frameMat: darkTrimMat,
    glassMat,
    bays: 2,
  });
  backWinFrame.position.set(1.2, 2.18, -4.04);
  backWinFrame.rotation.y = Math.PI;
  group.add(backWinFrame);

  // Right wall narrow glowing storefront/studio window (`高位侧面_概念.png` detail)
  const rightSideWinGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 0.56),
    new THREE.MeshStandardMaterial({
      color: '#ffe5b8',
      emissive: '#ffad47',
      emissiveIntensity: 2.35,
      roughness: 0.3,
    })
  );
  rightSideWinGlow.position.set(3.93, 1.55, -2.05);
  rightSideWinGlow.rotation.y = Math.PI / 2;
  group.add(rightSideWinGlow);

  const rightSideFrame = buildWindowUnit({
    width: 1.62,
    height: 0.62,
    frameMat: darkTrimMat,
    glassMat,
    bays: 2,
  });
  rightSideFrame.position.set(3.94, 1.55, -2.05);
  rightSideFrame.rotation.y = Math.PI / 2;
  group.add(rightSideFrame);

  // Left vertical cedar wood slat screen (recessed alcove X: -4.10 .. -1.42, Z = 0.05)
  const slatBackdrop = new THREE.Mesh(new THREE.BoxGeometry(2.70, 2.66, 0.14), darkTrimMat);
  slatBackdrop.position.set(-2.76, 1.61, -0.06);
  slatBackdrop.castShadow = true;
  slatBackdrop.receiveShadow = true;
  group.add(slatBackdrop);

  const slatCount = 21;
  for (let i = 0; i < slatCount; i++) {
    const sx = THREE.MathUtils.lerp(-4.02, -1.50, i / (slatCount - 1));
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.068, 2.62, 0.14), cedarMat);
    slat.position.set(sx, 1.61, 0.07);
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
  }

  // Interior partition separating left timber storeroom from bright glass boutique showroom
  const innerPartition = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.65, 3.65), interiorWallMat);
  innerPartition.position.set(-1.45, 1.62, -1.92);
  innerPartition.receiveShadow = true;
  group.add(innerPartition);

  // Curved warm interior boutique backdrop wall (back & right niche feel)
  const innerBackWall = new THREE.Mesh(new THREE.BoxGeometry(4.05, 2.66, 0.14), interiorWallMat);
  innerBackWall.position.set(0.55, 1.62, -3.55);
  innerBackWall.receiveShadow = true;
  group.add(innerBackWall);

  const innerRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.66, 3.85), interiorWallMat);
  innerRightWall.position.set(2.50, 1.62, -1.68);
  innerRightWall.receiveShadow = true;
  group.add(innerRightWall);

  // Front 1F Glass Storefront Bays (X: -1.42 .. +2.55, Z = +0.42)
  const leftBay = buildWindowUnit({
    width: 1.14,
    height: 2.50,
    frameMat: darkTrimMat,
    glassMat,
    bays: 1,
  });
  leftBay.position.set(-0.85, 1.63, 0.42);
  group.add(leftBay);

  const doubleDoor = buildWindowUnit({
    width: 1.44,
    height: 2.50,
    frameMat: darkTrimMat,
    glassMat,
    bays: 1,
    hasDoorSplit: true,
  });
  doubleDoor.position.set(0.42, 1.63, 0.42);
  group.add(doubleDoor);

  const rightBay = buildWindowUnit({
    width: 1.41,
    height: 2.50,
    frameMat: darkTrimMat,
    glassMat,
    bays: 1,
  });
  rightBay.position.set(1.84, 1.63, 0.42);
  group.add(rightBay);

  // 1F Overhanging Dark Bronze Roof Canopy Fascia (`X: -4.55 .. +4.02, Z: -4.08 .. +0.86`)
  const canopy1F = new THREE.Mesh(new THREE.BoxGeometry(8.57, 0.22, 4.94), darkTrimMat);
  canopy1F.position.set(-0.265, 2.97, -1.61);
  canopy1F.castShadow = true;
  canopy1F.receiveShadow = true;
  group.add(canopy1F);

  // Soffit glowing recessed downlights under the overhanging fascia (`基准图.png` wood slats & glass top edge!)
  const soffitLightPositions = [-3.65, -2.75, -1.85, -0.85, 0.42, 1.84];
  soffitLightPositions.forEach((lx) => {
    const zPos = lx < -1.4 ? 0.34 : 0.62;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.015, 12), warmLedMat);
    disc.position.set(lx, 2.855, zPos);
    group.add(disc);
  });

  // Warm grazing spot lights illuminating the cedar timber slats & storefront threshold
  const slatWarmLight = new THREE.PointLight('#ff9c3a', 4.8, 5.2, 1.5);
  slatWarmLight.position.set(-2.75, 2.65, 0.42);
  group.add(slatWarmLight);

  const porchWarmLight = new THREE.PointLight('#ffb454', 3.8, 4.8, 1.55);
  porchWarmLight.position.set(0.42, 2.68, 0.72);
  group.add(porchWarmLight);

  // ==========================================================
  // 2. COMPLETE 1F BOUTIQUE INTERIOR FURNISHINGS
  // ==========================================================

  // Interior Ceiling LED Spots & Real PointLights
  const interiorLight1FMain = new THREE.PointLight('#ffb152', 9.5, 8.2, 1.35);
  interiorLight1FMain.position.set(0.45, 2.58, -1.35);
  group.add(interiorLight1FMain);

  const interiorLight1FMannequin = new THREE.PointLight('#ffc36b', 4.8, 5.2, 1.45);
  interiorLight1FMannequin.position.set(1.85, 2.45, -0.55);
  group.add(interiorLight1FMannequin);

  for (const cx of [-0.85, 0.42, 1.80]) {
    for (const cz of [-0.65, -2.15]) {
      const ceilDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.018, 10), warmLedMat);
      ceilDisc.position.set(cx, 2.845, cz);
      group.add(ceilDisc);
    }
  }

  // Central Timber Reception / Folded Sweater Island Table
  const counterGroup = new THREE.Group();
  counterGroup.position.set(0.35, 0.36, -1.65);
  const counterBody = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.78, 0.64), oakMat);
  counterBody.position.y = 0.39;
  counterBody.castShadow = true;
  counterBody.receiveShadow = true;
  counterGroup.add(counterBody);

  // Vase with cream & blush ceramic arrangement atop counter
  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.085, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.4 })
  );
  vase.position.set(-0.22, 0.87, 0.04);
  counterGroup.add(vase);
  const bouquetTex = createHydrangeaClusterTexture();
  const bouquetMat = new THREE.MeshStandardMaterial({
    map: bouquetTex,
    color: new THREE.Color('#fff5eb'),
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.72,
  });
  for (let b = 0; b < 3; b++) {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), bouquetMat);
    fl.position.set(-0.22, 1.01, 0.04);
    fl.rotation.set((b - 1) * 0.25, (b * Math.PI) / 3, 0);
    counterGroup.add(fl);
  }

  // Folded garment stacks atop counter
  const foldColors = ['#d8ccb8', '#8b9980', '#efe8dc'];
  foldColors.forEach((fc, idx) => {
    const fold = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.055, 0.22),
      new THREE.MeshStandardMaterial({ color: fc, roughness: 0.85 })
    );
    fold.position.set(0.22, 0.81 + idx * 0.055, 0.02);
    fold.rotation.y = (idx - 1) * 0.08;
    counterGroup.add(fold);
  });
  group.add(counterGroup);

  // Left Wall & Back Boutique Brass Clothing Racks
  const rackLeft1F = createBoutiqueRack(1.85, 1.48, brassMat, garmentMats, rng, 8);
  rackLeft1F.position.set(-1.12, 0.36, -1.75);
  rackLeft1F.rotation.y = Math.PI / 2;
  group.add(rackLeft1F);

  const rackBackLeft1F = createBoutiqueRack(1.65, 1.48, brassMat, garmentMats, rng, 7);
  rackBackLeft1F.position.set(-0.32, 0.36, -3.15);
  group.add(rackBackLeft1F);

  const rackBackRight1F = createBoutiqueRack(1.75, 1.48, brassMat, garmentMats, rng, 8);
  rackBackRight1F.position.set(1.52, 0.36, -3.15);
  group.add(rackBackRight1F);

  // Front-Right Window Mannequin wearing pleated cream dress
  const mannequin = createShowcaseMannequin(oakMat, brassMat);
  mannequin.position.set(1.86, 0.36, -0.55);
  mannequin.rotation.y = -0.25;
  group.add(mannequin);

  // 1F Pendant Lamp hanging above mannequin/counter area
  const pendantCord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6), darkTrimMat);
  pendantCord.position.set(1.52, 2.55, -1.25);
  group.add(pendantCord);
  const pendantShade = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), warmLedMat);
  pendantShade.position.set(1.52, 2.26, -1.25);
  group.add(pendantShade);

  // 1F Potted Indoor Plants
  const ceramicPotMat = new THREE.MeshStandardMaterial({ color: '#e9e1d4', roughness: 0.55 });
  const indoorLeafTex = createBroadleafSprayTexture();
  const indoorLeafMat = new THREE.MeshStandardMaterial({
    map: indoorLeafTex,
    color: new THREE.Color('#6f9f44'),
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.74,
  });
  const plant1FL = createIndoorPottedPlant(ceramicPotMat, indoorLeafMat, 0.92);
  plant1FL.position.set(-1.18, 0.36, -0.15);
  group.add(plant1FL);
  const plant1FR = createIndoorPottedPlant(ceramicPotMat, indoorLeafMat, 0.85);
  plant1FR.position.set(2.26, 0.36, -0.18);
  group.add(plant1FR);

  // ==========================================================
  // 3. SECOND FLOOR STAGGERED WHITE STUCCO VOLUMES (Y: 3.08 .. 6.02)
  // ==========================================================

  // A. Rear-Left Stepped White Block (`X: -3.58 .. -0.68, Z: -3.90 .. -0.32, Y: 3.08 .. 5.48`)
  const left2FShell = new THREE.Mesh(new THREE.BoxGeometry(2.90, 2.40, 3.58), stuccoMat);
  left2FShell.position.set(-2.13, 4.28, -2.11);
  left2FShell.castShadow = true;
  left2FShell.receiveShadow = true;
  group.add(left2FShell);

  // Left 2F recessed dark flat membrane roof inside raised coping parapet
  const left2FRoof = new THREE.Mesh(new THREE.BoxGeometry(2.60, 0.08, 3.28), roofMembraneMat);
  left2FRoof.position.set(-2.13, 5.46, -2.11);
  left2FRoof.receiveShadow = true;
  group.add(left2FRoof);

  // Raised parapet rim on left 2F block
  const parapetLeftTop = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.14, 0.16), stuccoMat);
  parapetLeftTop.position.set(-2.13, 5.54, -0.40);
  const parapetLeftRear = parapetLeftTop.clone();
  parapetLeftRear.position.z = -3.82;
  const parapetLeftSide = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 3.58), stuccoMat);
  parapetLeftSide.position.set(-3.50, 5.54, -2.11);
  group.add(parapetLeftTop, parapetLeftRear, parapetLeftSide);

  // B. Main Front Cantilevered White Volume (`X: -0.70 .. +4.10, Z: -3.76 .. +1.22, Y: 3.08 .. 5.96`)
  // Built cleanly from hollow slabs/walls so front panoramic window has real 3D showroom depth!
  const floor2F = new THREE.Mesh(new THREE.BoxGeometry(4.80, 0.24, 4.98), stuccoMat);
  floor2F.position.set(1.70, 3.20, -1.27);
  floor2F.castShadow = true;
  floor2F.receiveShadow = true;
  group.add(floor2F);

  // Left side wall of main cantilevered block (`X = -0.60`, leaves slit gap framing front-left step)
  const wall2FLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.74, 4.98), stuccoMat);
  wall2FLeft.position.set(-0.58, 4.57, -1.27);
  wall2FLeft.castShadow = true;
  wall2FLeft.receiveShadow = true;
  group.add(wall2FLeft);

  // Vertical glowing slit window recessed in the cantilevered left step corner (`基准图.png` center-left)
  const slitGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 1.92),
    new THREE.MeshStandardMaterial({
      color: '#ffe0a6',
      emissive: '#ffaa44',
      emissiveIntensity: 2.65,
      roughness: 0.25,
    })
  );
  slitGlow.position.set(-0.705, 4.52, 0.08);
  slitGlow.rotation.y = -Math.PI / 2;
  group.add(slitGlow);

  const slitFrame = buildWindowUnit({
    width: 0.28,
    height: 1.98,
    frameMat: darkTrimMat,
    glassMat,
    bays: 1,
  });
  slitFrame.position.set(-0.715, 4.52, 0.08);
  slitFrame.rotation.y = -Math.PI / 2;
  group.add(slitFrame);

  // Right side wall of main 2F block (`X = 3.98`)
  const wall2FRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.74, 4.98), stuccoMat);
  wall2FRight.position.set(3.98, 4.57, -1.27);
  wall2FRight.castShadow = true;
  wall2FRight.receiveShadow = true;
  group.add(wall2FRight);

  // Right 2F wall twin narrow vertical slot windows (`高位侧面_概念.png` detail)
  for (const wz of [-0.65, -2.45]) {
    const rGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 1.48),
      new THREE.MeshStandardMaterial({
        color: '#ffe2ad',
        emissive: '#ffac46',
        emissiveIntensity: 2.35,
        roughness: 0.3,
      })
    );
    rGlow.position.set(4.105, 4.65, wz);
    rGlow.rotation.y = Math.PI / 2;
    group.add(rGlow);

    const rWin = buildWindowUnit({
      width: 0.32,
      height: 1.54,
      frameMat: darkTrimMat,
      glassMat,
      bays: 1,
    });
    rWin.position.set(4.115, 4.65, wz);
    rWin.rotation.y = Math.PI / 2;
    group.add(rWin);
  }

  // Rear wall of 2F block (`Z = -3.64`) + rear horizontal clerestory window
  const wall2FRear = new THREE.Mesh(new THREE.BoxGeometry(4.80, 2.74, 0.24), stuccoMat);
  wall2FRear.position.set(1.70, 4.57, -3.64);
  wall2FRear.castShadow = true;
  wall2FRear.receiveShadow = true;
  group.add(wall2FRear);

  const rear2FGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.72),
    new THREE.MeshStandardMaterial({
      color: '#ffe4b4',
      emissive: '#ffad47',
      emissiveIntensity: 2.25,
      roughness: 0.35,
    })
  );
  rear2FGlow.position.set(1.65, 4.75, -3.765);
  rear2FGlow.rotation.y = Math.PI;
  group.add(rear2FGlow);

  const rear2FWin = buildWindowUnit({
    width: 2.68,
    height: 0.78,
    frameMat: darkTrimMat,
    glassMat,
    bays: 2,
  });
  rear2FWin.position.set(1.65, 4.75, -3.78);
  rear2FWin.rotation.y = Math.PI;
  group.add(rear2FWin);

  // Front facade stucco surround around the panoramic 2F window
  const frontSillWall = new THREE.Mesh(new THREE.BoxGeometry(4.80, 0.56, 0.24), stuccoMat);
  frontSillWall.position.set(1.70, 3.60, 1.10);
  frontSillWall.castShadow = true;
  frontSillWall.receiveShadow = true;
  group.add(frontSillWall);

  const frontHeaderWall = new THREE.Mesh(new THREE.BoxGeometry(4.80, 0.42, 0.24), stuccoMat);
  frontHeaderWall.position.set(1.70, 5.79, 1.10);
  frontHeaderWall.castShadow = true;
  frontHeaderWall.receiveShadow = true;
  group.add(frontHeaderWall);

  const frontLeftPier2F = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.78, 0.24), stuccoMat);
  frontLeftPier2F.position.set(-0.49, 4.70, 1.10);
  frontLeftPier2F.castShadow = true;
  frontLeftPier2F.receiveShadow = true;
  group.add(frontLeftPier2F);

  const frontRightPier2F = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.78, 0.24), stuccoMat);
  frontRightPier2F.position.set(3.87, 4.70, 1.10);
  frontRightPier2F.castShadow = true;
  frontRightPier2F.receiveShadow = true;
  group.add(frontRightPier2F);

  // 2F Roof ceiling slab + parapet walls + recessed membrane roof (`高位侧面_概念.png` flat roof cap!)
  const ceiling2F = new THREE.Mesh(new THREE.BoxGeometry(4.78, 0.14, 4.94), stuccoMat);
  ceiling2F.position.set(1.70, 5.88, -1.27);
  ceiling2F.castShadow = true;
  ceiling2F.receiveShadow = true;
  group.add(ceiling2F);

  const roofMembrane2F = new THREE.Mesh(new THREE.BoxGeometry(4.44, 0.05, 4.60), roofMembraneMat);
  roofMembrane2F.position.set(1.70, 5.95, -1.27);
  roofMembrane2F.receiveShadow = true;
  group.add(roofMembrane2F);

  // Parapet coping ring around 2F main block
  const copingSpecs = [
    [4.82, 0.14, 0.16, 1.70, 6.01, 1.14],
    [4.82, 0.14, 0.16, 1.70, 6.01, -3.68],
    [0.16, 0.14, 4.98, -0.62, 6.01, -1.27],
    [0.16, 0.14, 4.98, 4.02, 6.01, -1.27],
  ];
  copingSpecs.forEach(([w, h, d, x, y, z]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stuccoMat);
    c.position.set(x, y, z);
    c.castShadow = true;
    c.receiveShadow = true;
    group.add(c);
  });

  // 2F Panoramic Window (Recessed cleanly at Z = 1.03 inside white overhang box)
  const window2F = buildWindowUnit({
    width: 3.92,
    height: 1.70,
    frameMat: darkTrimMat,
    glassMat,
    bays: 3,
  });
  window2F.position.set(1.68, 4.73, 1.03);
  group.add(window2F);

  // Built-in 2F Planter Box Trough underneath window (`X: -0.28 .. 3.64`)
  const planterWall = new THREE.Mesh(new THREE.BoxGeometry(3.96, 0.28, 0.30), stuccoMat);
  planterWall.position.set(1.68, 3.66, 1.24);
  planterWall.castShadow = true;
  planterWall.receiveShadow = true;
  group.add(planterWall);

  const soilMat = new THREE.MeshStandardMaterial({ color: '#3b2e24', roughness: 0.96 });
  const planterSoil = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.08, 0.22), soilMat);
  planterSoil.position.set(1.68, 3.79, 1.23);
  group.add(planterSoil);

  // ==========================================================
  // 4. SECOND FLOOR BOUTIQUE SHOWROOM INTERIOR
  // ==========================================================

  const floor2FOak = new THREE.Mesh(new THREE.BoxGeometry(4.30, 0.05, 4.10), oakMat);
  floor2FOak.position.set(1.68, 3.345, -1.15);
  floor2FOak.receiveShadow = true;
  group.add(floor2FOak);

  // Inner back showcase wall (`Z = -2.25`) catching warm amber uplight behind clothing rail!
  const innerWall2F = new THREE.Mesh(new THREE.BoxGeometry(4.32, 2.42, 0.14), interiorWallMat);
  innerWall2F.position.set(1.68, 4.55, -2.30);
  innerWall2F.receiveShadow = true;
  group.add(innerWall2F);

  // 2F Interior ceiling spotlights & point lights
  const interiorLight2F = new THREE.PointLight('#ffb152', 9.0, 8.0, 1.35);
  interiorLight2F.position.set(1.68, 5.45, -0.55);
  group.add(interiorLight2F);

  const interiorLight2FFill = new THREE.PointLight('#ffbd62', 3.6, 5.2, 1.45);
  interiorLight2FFill.position.set(0.55, 4.95, 0.05);
  group.add(interiorLight2FFill);

  for (const lx of [0.35, 1.68, 3.02]) {
    const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 10), warmLedMat);
    disc2.position.set(lx, 5.79, -0.25);
    group.add(disc2);
  }

  // Long double-span 2F Clothing Rail (`X: 0.1 .. 3.25, Z = -0.55`) clearly visible through window!
  const rack2FLeft = createBoutiqueRack(1.42, 1.46, brassMat, garmentMats, rng, 7);
  rack2FLeft.position.set(0.82, 3.37, -0.42);
  group.add(rack2FLeft);

  const rack2FRight = createBoutiqueRack(1.48, 1.46, brassMat, garmentMats, rng, 7);
  rack2FRight.position.set(2.55, 3.37, -0.42);
  group.add(rack2FRight);

  // 2F Window indoor plants flanking left & right ends of panoramic window
  const plant2FL = createIndoorPottedPlant(ceramicPotMat, indoorLeafMat, 1.24);
  plant2FL.position.set(-0.08, 3.37, 0.24);
  group.add(plant2FL);

  const plant2FR = createIndoorPottedPlant(ceramicPotMat, indoorLeafMat, 1.18);
  plant2FR.position.set(3.40, 3.37, 0.20);
  group.add(plant2FR);

  return {
    group,
  };
}
