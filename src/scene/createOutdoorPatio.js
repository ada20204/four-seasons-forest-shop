import * as THREE from 'three';
import {
  createWoodTextures,
  createContactShadowMaterial,
  createHydrangeaClusterTexture,
} from '../materials/studioMaterials.js';

function createSlattedChair(woodMat) {
  const g = new THREE.Group();

  // Seat dimensions: 0.44 x 0.42 at y = 0.44
  const legPos = [
    [-0.18, -0.17],
    [0.18, -0.17],
    [-0.18, 0.17],
    [0.18, 0.17],
  ];
  legPos.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.44, 0.036), woodMat);
    leg.position.set(lx, 0.22, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    g.add(leg);
  });

  // Side seat rails
  for (const sx of [-0.18, 0.18]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.36), woodMat);
    rail.position.set(sx, 0.415, 0);
    rail.castShadow = true;
    g.add(rail);
  }

  // 4 horizontal seat slats
  for (let i = 0; i < 4; i++) {
    const z = THREE.MathUtils.lerp(-0.15, 0.15, i / 3);
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.022, 0.072), woodMat);
    slat.position.set(0, 0.44, z);
    slat.castShadow = true;
    slat.receiveShadow = true;
    g.add(slat);
  }

  // Slanted backrest posts & horizontal slats
  const backGroup = new THREE.Group();
  backGroup.position.set(0, 0.44, -0.17);
  backGroup.rotation.x = -0.12;

  for (const bx of [-0.18, 0.18]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.46, 0.036), woodMat);
    st.position.set(bx, 0.23, 0);
    st.castShadow = true;
    backGroup.add(st);
  }
  for (let i = 0; i < 3; i++) {
    const by = 0.16 + i * 0.11;
    const bSlat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.055, 0.026), woodMat);
    bSlat.position.set(0, by, 0.01);
    bSlat.castShadow = true;
    bSlat.receiveShadow = true;
    backGroup.add(bSlat);
  }
  g.add(backGroup);

  // Subtle side armrests (seen in 基准图.png)
  for (const ax of [-0.19, 0.19]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.34), woodMat);
    arm.position.set(ax, 0.62, -0.01);
    arm.castShadow = true;
    g.add(arm);

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), woodMat);
    post.position.set(ax, 0.53, 0.14);
    post.castShadow = true;
    g.add(post);
  }

  return g;
}

/**
 * Builds sculpted 8-panel octagonal cream canvas umbrella with gentle fabric sag & ribs.
 */
function createMarketParasol(woodMat) {
  const g = new THREE.Group();

  // Tall wooden center mast passing through tabletop to weighted cast base
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 2.52, 12), woodMat);
  pole.position.y = 1.26;
  pole.castShadow = true;
  g.add(pole);

  const footBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.26, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: '#383a3f', roughness: 0.72, metalness: 0.3 })
  );
  footBase.position.y = 0.025;
  footBase.receiveShadow = true;
  g.add(footBase);

  // Sculpted 8-gore canopy geometry with subtle catenary swag between ribs
  const radialSegs = 8;
  const ringSegs = 6;
  const radius = 1.48;
  const apexY = 2.66;
  const eaveY = 2.18;

  const positions = [];
  const uvs = [];
  const indices = [];

  // Ring vertices
  for (let r = 0; r <= ringSegs; r++) {
    const rt = r / ringSegs;
    for (let a = 0; a <= radialSegs * 2; a++) {
      const ang = (a / (radialSegs * 2)) * Math.PI * 2;
      const isMid = a % 2 === 1;
      const rad = radius * rt * (isMid ? 0.96 : 1.0);
      // Slight fabric belly sag between radial wood ribs
      const sag = isMid ? Math.sin(rt * Math.PI) * 0.055 : 0;
      const curveY = THREE.MathUtils.lerp(apexY, eaveY, Math.pow(rt, 0.84)) - sag;

      positions.push(Math.cos(ang) * rad, curveY, Math.sin(ang) * rad);
      uvs.push(0.5 + Math.cos(ang) * 0.5 * rt, 0.5 + Math.sin(ang) * 0.5 * rt);
    }
  }

  const stride = radialSegs * 2 + 1;
  for (let r = 0; r < ringSegs; r++) {
    for (let a = 0; a < radialSegs * 2; a++) {
      const i0 = r * stride + a;
      const i1 = i0 + 1;
      const i2 = (r + 1) * stride + a;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const canopyGeo = new THREE.BufferGeometry();
  canopyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  canopyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  canopyGeo.setIndex(indices);
  canopyGeo.computeVertexNormals();

  const fabricMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f4ecde'),
    roughness: 0.86,
    metalness: 0.01,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  });

  const canopyMesh = new THREE.Mesh(canopyGeo, fabricMat);
  canopyMesh.castShadow = true;
  canopyMesh.receiveShadow = true;
  g.add(canopyMesh);

  // Scalloped outer valance apron skirt around the canopy edge
  const valance = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.97, radius * 1.0, 0.14, 16, 1, true),
    fabricMat
  );
  valance.position.y = eaveY - 0.065;
  valance.castShadow = true;
  g.add(valance);

  // Carved wood top finial
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), woodMat);
  finial.position.y = apexY + 0.04;
  g.add(finial);

  // Underside 8 wood strut ribs radiating from hub ring at y = 1.98
  for (let a = 0; a < radialSegs; a++) {
    const ang = (a / radialSegs) * Math.PI * 2;
    const endX = Math.cos(ang) * radius * 0.72;
    const endZ = Math.sin(ang) * radius * 0.72;
    const endY = THREE.MathUtils.lerp(apexY, eaveY, 0.72);
    const startVec = new THREE.Vector3(0, 1.92, 0);
    const endVec = new THREE.Vector3(endX, endY - 0.02, endZ);
    const len = startVec.distanceTo(endVec);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), woodMat);
    strut.position.copy(startVec).lerp(endVec, 0.5);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endVec.clone().sub(startVec).normalize());
    g.add(strut);
  }

  return g;
}

export function createOutdoorPatio() {
  const group = new THREE.Group();
  group.name = 'OutdoorPatioLounge';
  group.position.set(5.18, 0.26, 2.38);

  const teakTex = createWoodTextures({ baseHex: '#b87f47', grainHex: '#8b5727', repeat: [1, 1] });
  const teakMat = new THREE.MeshStandardMaterial({
    map: teakTex.map,
    bumpMap: teakTex.bumpMap,
    bumpScale: 0.012,
    roughness: 0.68,
    metalness: 0.02,
    envMapIntensity: 0.36,
  });

  // Soft umbrella & furniture shadow on slate pad
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.0),
    createContactShadowMaterial({ opacity: 0.34, roundness: 0.85 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  group.add(shadow);

  // Round teak bistro table (`radius 0.58, height 0.74`)
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.045, 24), teakMat);
  tableTop.position.y = 0.74;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  group.add(tableTop);

  const tableApron = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.51, 0.045, 20), teakMat);
  tableApron.position.y = 0.70;
  group.add(tableApron);

  // Cross-leg pedestal base
  const tableCol = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.68, 12), teakMat);
  tableCol.position.y = 0.35;
  tableCol.castShadow = true;
  group.add(tableCol);

  for (let i = 0; i < 4; i++) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.045, 0.065), teakMat);
    foot.position.y = 0.025;
    foot.rotation.y = (i * Math.PI) / 4;
    foot.castShadow = true;
    group.add(foot);
  }

  // Tabletop little ceramic pot + lavender/flower cluster (matching 基准图.png)
  const miniPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.065, 0.11, 12),
    new THREE.MeshStandardMaterial({ color: '#ece3d5', roughness: 0.55 })
  );
  miniPot.position.set(0.18, 0.815, 0.14);
  miniPot.castShadow = true;
  group.add(miniPot);

  const flowerMat = new THREE.MeshStandardMaterial({
    map: createHydrangeaClusterTexture(),
    color: new THREE.Color('#a47ce0'),
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.72,
  });
  for (let p = 0; p < 3; p++) {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), flowerMat);
    fl.position.set(0.18, 0.91, 0.14);
    fl.rotation.set((p - 1) * 0.35, (p * Math.PI) / 3, 0);
    fl.castShadow = true;
    group.add(fl);
  }

  // Miniature matte-bronze & frosted amber candle lantern on tabletop (glows softly at dusk & night)
  const lanternBaseMat = new THREE.MeshStandardMaterial({ color: '#2b2623', roughness: 0.48, metalness: 0.55 });
  const lanternBulbMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff5dd'),
    emissive: new THREE.Color('#ffaa42'),
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });
  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(-0.26, 0.763, 0.22);
  const lanternFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.022, 12), lanternBaseMat);
  lanternFoot.position.y = 0.011;
  const lanternGlobe = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.042, 0.125, 12), lanternBulbMat);
  lanternGlobe.position.y = 0.084;
  const lanternCap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.064, 0.036, 12), lanternBaseMat);
  lanternCap.position.y = 0.162;
  lanternGroup.add(lanternFoot, lanternGlobe, lanternCap);
  group.add(lanternGroup);

  const lanternLight = new THREE.PointLight('#ff9f38', 0, 4.8, 1.45);
  lanternLight.position.set(-0.26, 0.94, 0.22);
  group.add(lanternLight);

  function setCandleWeight(w) {
    const cw = THREE.MathUtils.clamp(w, 0, 1);
    lanternLight.intensity = cw * 3.2;
    lanternBulbMat.emissiveIntensity = cw * 6.4;
  }

  // Market Parasol through center of bistro table
  const parasol = createMarketParasol(teakMat);
  group.add(parasol);

  // 3 Teak Slatted Bistro Chairs nestled harmoniously around the table
  const chairAngles = [
    { a: 2.38, r: 0.84, faceOffset: 0.05 },   // front-left chair
    { a: 0.78, r: 0.86, faceOffset: -0.08 },  // front-right chair
    { a: -1.45, r: 0.86, faceOffset: 0.0 },   // back-left chair
  ];
  const chairsGroup = new THREE.Group();
  const chairSpots = [];
  chairAngles.forEach(({ a, r, faceOffset }) => {
    const ch = createSlattedChair(teakMat);
    ch.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    // Face center of table (+PI/2 because chair backrest is at -Z)
    ch.lookAt(0, 0, 0);
    ch.rotation.y += faceOffset;
    chairsGroup.add(ch);
    chairSpots.push({ x: ch.position.x, z: ch.position.z, rotY: ch.rotation.y });
  });
  group.add(chairsGroup);

  return {
    group,
    flowerMat,
    worldOrigin: group.position.clone(),
    chairSpots,
    setCandleWeight,
  };
}
