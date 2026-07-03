import * as THREE from 'three';

export function createBeachLandscapePaintingTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#7ec8e8');
  sky.addColorStop(0.45, '#a8d8f0');
  sky.addColorStop(1, '#f5d9a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255, 248, 220, 0.35)';
  ctx.beginPath();
  ctx.ellipse(w * 0.78, h * 0.14, 42, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(w * 0.22, h * 0.18, 58, 22, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h * 0.11, 48, 18, 0.05, 0, Math.PI * 2);
  ctx.fill();

  const horizonY = h * 0.52;
  const sea = ctx.createLinearGradient(0, horizonY, 0, h * 0.82);
  sea.addColorStop(0, '#2f9db8');
  sea.addColorStop(0.35, '#38b4c8');
  sea.addColorStop(0.7, '#4ec5d4');
  sea.addColorStop(1, '#6fd4de');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, w, h * 0.82 - horizonY);

  ctx.fillStyle = 'rgba(20, 90, 110, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 8);
  for (let x = 0; x <= w; x += 24) {
    ctx.lineTo(x, horizonY + 8 + Math.sin(x * 0.04) * 4);
  }
  ctx.lineTo(w, horizonY + 28);
  ctx.lineTo(0, horizonY + 28);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i += 1) {
    const y = h * 0.72 + i * 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 18) {
      ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 3);
    }
    ctx.stroke();
  }

  ctx.fillStyle = '#d4b483';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.82);
  ctx.quadraticCurveTo(w * 0.28, h * 0.76, w * 0.55, h * 0.8);
  ctx.quadraticCurveTo(w * 0.82, h * 0.86, w, h * 0.79);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#c9a56e';
  ctx.fillRect(0, h * 0.88, w, h * 0.12);

  const drawPalm = (baseX: number, baseY: number, lean: number, scale: number): void => {
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);

    ctx.strokeStyle = '#5a3d22';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(lean * 18, -70, lean * 28, -130);
    ctx.stroke();

    const fronds: Array<[number, number, number]> = [
      [-0.9, -125, -1.1],
      [-0.45, -132, -0.55],
      [0, -138, 0],
      [0.45, -132, 0.55],
      [0.9, -125, 1.1],
      [-0.65, -118, -0.85],
      [0.65, -118, 0.85],
    ];
    for (const [dx, dy, rot] of fronds) {
      ctx.save();
      ctx.translate(lean * 28 + dx * 8, dy);
      ctx.rotate(rot * 0.35);
      ctx.fillStyle = '#3f6b34';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-18, -28, -42, -8);
      ctx.quadraticCurveTo(-8, 6, 0, 0);
      ctx.fill();
      ctx.fillStyle = '#4a7a3d';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(18, -28, 42, -8);
      ctx.quadraticCurveTo(8, 6, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  };

  drawPalm(w * 0.72, h * 0.84, -1, 1.05);
  drawPalm(w * 0.86, h * 0.86, -1, 0.82);
  drawPalm(w * 0.58, h * 0.85, 1, 0.68);

  ctx.fillStyle = 'rgba(30, 70, 90, 0.35)';
  ctx.beginPath();
  ctx.ellipse(w * 0.18, horizonY + 6, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildPaintingWithFrame(
  size: THREE.Vector3,
  frameColor: THREE.Color,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Painting';

  const frameGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.88,
    metalness: 0.05,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const insetX = size.x * 0.84;
  const insetY = size.y * 0.84;
  const canvasGeo = new THREE.PlaneGeometry(insetX, insetY);
  const canvasMat = new THREE.MeshStandardMaterial({
    map: createBeachLandscapePaintingTexture(),
    roughness: 0.92,
    metalness: 0.0,
  });
  const canvas = new THREE.Mesh(canvasGeo, canvasMat);
  canvas.name = 'PaintingCanvas';
  canvas.position.z = size.z * 0.5 + 0.002;
  canvas.castShadow = true;
  canvas.receiveShadow = true;
  group.add(canvas);

  return group;
}
