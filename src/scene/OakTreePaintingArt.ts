import * as THREE from 'three';

export function createOakTreePaintingTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#9eb6c9');
  sky.addColorStop(0.55, '#c8d4c0');
  sky.addColorStop(1, '#8f9a72');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Distant hills
  ctx.fillStyle = 'rgba(95, 110, 82, 0.45)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.quadraticCurveTo(w * 0.25, h * 0.62, w * 0.5, h * 0.7);
  ctx.quadraticCurveTo(w * 0.78, h * 0.78, w, h * 0.66);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Ground
  ctx.fillStyle = '#6f7758';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  const cx = w * 0.5;
  const baseY = h * 0.78;

  // Trunk
  ctx.fillStyle = '#4a3424';
  ctx.beginPath();
  ctx.moveTo(cx - 28, baseY);
  ctx.quadraticCurveTo(cx - 34, baseY - 90, cx - 18, baseY - 150);
  ctx.quadraticCurveTo(cx - 8, baseY - 210, cx - 4, baseY - 250);
  ctx.lineTo(cx + 4, baseY - 250);
  ctx.quadraticCurveTo(cx + 10, baseY - 210, cx + 20, baseY - 150);
  ctx.quadraticCurveTo(cx + 36, baseY - 90, cx + 28, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#3a2818';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, baseY - 40);
  ctx.quadraticCurveTo(cx - 12, baseY - 120, cx - 6, baseY - 190);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 10, baseY - 60);
  ctx.quadraticCurveTo(cx + 14, baseY - 140, cx + 8, baseY - 210);
  ctx.stroke();

  // Main branches
  ctx.strokeStyle = '#4a3424';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const branches: Array<[number, number, number, number]> = [
    [cx, baseY - 230, cx - 120, baseY - 280],
    [cx, baseY - 220, cx + 130, baseY - 270],
    [cx, baseY - 200, cx - 90, baseY - 240],
    [cx, baseY - 195, cx + 95, baseY - 235],
    [cx, baseY - 175, cx - 55, baseY - 205],
    [cx, baseY - 170, cx + 60, baseY - 200],
    [cx, baseY - 250, cx - 40, baseY - 310],
    [cx, baseY - 245, cx + 45, baseY - 305],
  ];
  for (const [x1, y1, x2, y2] of branches) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 18, x2, y2);
    ctx.stroke();
  }

  // Foliage clusters
  const foliage: Array<[number, number, number, string]> = [
    [cx, baseY - 295, 95, '#3f5c34'],
    [cx - 115, baseY - 285, 72, '#4a6a3c'],
    [cx + 120, baseY - 278, 78, '#456636'],
    [cx - 75, baseY - 250, 58, '#567845'],
    [cx + 82, baseY - 245, 62, '#527040'],
    [cx - 35, baseY - 318, 48, '#628552'],
    [cx + 38, baseY - 312, 52, '#5d7f4a'],
    [cx, baseY - 265, 55, '#6a9158'],
    [cx - 140, baseY - 255, 40, '#4d6d40'],
    [cx + 145, baseY - 248, 42, '#4a6838'],
  ];
  for (const [fx, fy, fr, color] of foliage) {
    const grad = ctx.createRadialGradient(fx, fy, fr * 0.15, fx, fy, fr);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(40, 60, 32, 0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle highlight on canopy
  ctx.fillStyle = 'rgba(210, 220, 150, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx - 20, baseY - 310, 70, 35, -0.2, 0, Math.PI * 2);
  ctx.fill();

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
    map: createOakTreePaintingTexture(),
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
