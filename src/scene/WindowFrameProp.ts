import * as THREE from 'three';

function createNightSkyTexture(width = 512, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0a1028');
  grad.addColorStop(0.45, '#121830');
  grad.addColorStop(1, '#060810');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#e8e4dc';
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.18, height * 0.055, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(200, 210, 230, 0.35)';
  ctx.beginPath();
  ctx.arc(width * 0.74, height * 0.18, height * 0.065, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 140; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.85;
    const r = Math.random() * 1.4 + 0.3;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#0d1520';
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height * 0.72);
  ctx.quadraticCurveTo(width * 0.25, height * 0.68, width * 0.5, height * 0.74);
  ctx.quadraticCurveTo(width * 0.78, height * 0.8, width, height * 0.7);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWindowFrame(
  size: THREE.Vector3,
  frameColor: THREE.Color,
  glassTint: THREE.Color,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WindowFrame';

  const w = size.x;
  const h = size.y;
  const d = size.z;
  const trim = Math.min(w, h) * 0.055;
  const mullion = trim * 0.72;

  const woodMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.84,
    metalness: 0.04,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: glassTint.clone().multiplyScalar(0.25),
    transparent: true,
    opacity: 0.38,
    roughness: 0.04,
    metalness: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const curtainMat = new THREE.MeshStandardMaterial({
    color: '#c8b9a4',
    roughness: 0.94,
    metalness: 0.01,
  });
  const curtainShadowMat = new THREE.MeshStandardMaterial({
    color: '#b0a090',
    roughness: 0.96,
    metalness: 0.01,
  });
  const barMat = new THREE.MeshStandardMaterial({
    color: '#1e1e24',
    roughness: 0.45,
    metalness: 0.72,
    emissive: '#0a0a10',
    emissiveIntensity: 0.15,
  });

  const glassGroup = new THREE.Group();
  glassGroup.name = 'WindowGlass';
  group.add(glassGroup);

  const addBox = (
    parent: THREE.Object3D,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // +Z faces the room (after the window's Y rotation on the west wall).
  const zGlass = d * 0.5 - 0.006;
  const zBars = -d * 0.08;
  const zSky = -d * 0.44;

  addBox(group, w, trim, d, 0, h * 0.5 - trim * 0.5, 0, woodMat);
  addBox(group, w, trim, d, 0, -h * 0.5 + trim * 0.5, 0, woodMat);
  addBox(group, trim, h - trim * 2, d, -w * 0.5 + trim * 0.5, 0, 0, woodMat);
  addBox(group, trim, h - trim * 2, d, w * 0.5 - trim * 0.5, 0, 0, woodMat);

  const innerW = w - trim * 2;
  const innerH = h - trim * 2;
  const paneW = (innerW - mullion) * 0.5;
  const paneH = (innerH - mullion) * 0.5;
  const paneInset = 0.004;

  const nightSky = new THREE.Mesh(
    new THREE.PlaneGeometry(innerW * 0.98, innerH * 0.98),
    new THREE.MeshBasicMaterial({
      map: createNightSkyTexture(),
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  nightSky.position.z = zSky;
  nightSky.renderOrder = 1;
  nightSky.name = 'WindowNightSky';
  group.add(nightSky);

  const barsGroup = new THREE.Group();
  barsGroup.name = 'WindowBars';
  barsGroup.renderOrder = 2;
  const barRadius = trim * 0.2;
  const barDepth = 0.028;
  const vertCount = 6;
  const vertSpan = innerW * 0.94;
  const vertStep = vertSpan / (vertCount - 1);

  for (let i = 0; i < vertCount; i += 1) {
    const x = -vertSpan * 0.5 + i * vertStep;
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(barRadius, barRadius, innerH * 0.94, 8),
      barMat,
    );
    bar.position.set(x, 0, zBars);
    bar.renderOrder = 2;
    bar.castShadow = true;
    barsGroup.add(bar);
  }

  for (const yFrac of [-0.28, 0.28]) {
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(innerW * 0.96, barRadius * 2.4, barDepth),
      barMat,
    );
    cross.position.set(0, innerH * yFrac, zBars);
    cross.renderOrder = 2;
    cross.castShadow = true;
    barsGroup.add(cross);
  }

  group.add(barsGroup);

  const paneCenters: Array<[number, number]> = [
    [-(paneW + mullion) * 0.5, (paneH + mullion) * 0.5],
    [(paneW + mullion) * 0.5, (paneH + mullion) * 0.5],
    [-(paneW + mullion) * 0.5, -(paneH + mullion) * 0.5],
    [(paneW + mullion) * 0.5, -(paneH + mullion) * 0.5],
  ];

  for (const [px, py] of paneCenters) {
    const pane = addBox(glassGroup, paneW - paneInset, paneH - paneInset, 0.014, px, py, zGlass, glassMat);
    pane.renderOrder = 3;
  }

  addBox(group, mullion, innerH, d * 0.65, 0, 0, 0, woodMat);
  addBox(group, innerW, mullion, d * 0.65, 0, 0, 0, woodMat);

  const rodY = h * 0.5 + trim * 0.35;
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(trim * 0.18, trim * 0.18, w + trim * 0.6, 10),
    new THREE.MeshStandardMaterial({ color: '#6a5a48', roughness: 0.55, metalness: 0.35 }),
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, rodY, d * 0.35);
  rod.castShadow = true;
  group.add(rod);

  const buildCurtainPanel = (side: -1 | 1): THREE.Group => {
    const panel = new THREE.Group();
    const panelW = w * 0.22;
    const panelH = h * 0.92;
    const folds = 4;
    const foldW = panelW / folds;

    for (let i = 0; i < folds; i += 1) {
      const fold = addBox(
        panel,
        foldW * 0.92,
        panelH,
        0.018,
        side * (panelW * 0.5 - foldW * (i + 0.5)),
        -h * 0.02,
        d * 0.42 + i * 0.004,
        i % 2 === 0 ? curtainMat : curtainShadowMat,
      );
      fold.rotation.y = side * 0.08 * (i + 1);
    }

    panel.position.x = side * (w * 0.5 - panelW * 0.35);
    return panel;
  };

  group.add(buildCurtainPanel(-1));
  group.add(buildCurtainPanel(1));

  return group;
}
