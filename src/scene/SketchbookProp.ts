import * as THREE from 'three';

const COVER_W = 256;
const COVER_H = 320;

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function drawCover(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#3a4258');
  base.addColorStop(0.45, '#2d3548');
  base.addColorStop(1, '#242a38');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.fillStyle = '#1a1c24';
  ctx.fillRect(w * 0.62, 0, w * 0.07, h);
  ctx.fillStyle = 'rgba(80, 85, 100, 0.35)';
  ctx.fillRect(w * 0.635, 0, w * 0.015, h);

  ctx.strokeStyle = 'rgba(201, 168, 108, 0.22)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.38);
  ctx.quadraticCurveTo(w * 0.35, h * 0.28, w * 0.48, h * 0.34);
  ctx.quadraticCurveTo(w * 0.58, h * 0.42, w * 0.52, h * 0.52);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const px = w * (0.28 + t * 0.22);
    const py = h * (0.36 + t * 0.08);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 8, py + 14);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(232, 220, 196, 0.12)';
  ctx.fillRect(w * 0.14, h * 0.72, w * 0.34, h * 0.08);
  ctx.font = '600 11px Outfit, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(201, 168, 108, 0.55)';
  ctx.fillText('SKETCHES', w * 0.17, h * 0.775);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w * 0.12, h);
  ctx.lineTo(0, h * 0.88);
  ctx.closePath();
  ctx.fill();
}

function drawBackCover(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#323848');
  base.addColorStop(1, '#252b38');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
}

function drawSpine(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#1e222c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(201, 168, 108, 0.25)';
  ctx.lineWidth = 1;
  for (let y = 8; y < h; y += 14) {
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(w - 2, y);
    ctx.stroke();
  }
}

function drawPageEdge(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#ddd5c4';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(140, 130, 115, 0.45)';
  ctx.lineWidth = 1;
  const lines = Math.max(6, Math.floor(h / 3));
  for (let i = 0; i < lines; i++) {
    const y = (i + 0.5) * (h / lines);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawForeEdge(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d8d0c0';
  for (let x = 0; x < w; x += 3) {
    ctx.fillRect(x, 0, 1, h);
  }
}

/** Closed sketchbook for the bedroom desk (cover, spine, page edges). */
export function buildSketchbook(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Sketchbook';

  const coverMap = makeCanvasTexture(drawCover, COVER_W, COVER_H);
  const backMap = makeCanvasTexture(drawBackCover, COVER_W, COVER_H);
  const spineMap = makeCanvasTexture(drawSpine, 32, COVER_H);
  const pageEdgeMap = makeCanvasTexture(drawPageEdge, 32, COVER_W);
  const foreEdgeMap = makeCanvasTexture(drawForeEdge, COVER_W, 32);

  const matProps = { roughness: 0.88, metalness: 0.04 };
  const coverMat = new THREE.MeshStandardMaterial({ map: coverMap, ...matProps });
  const backMat = new THREE.MeshStandardMaterial({ map: backMap, ...matProps });
  const spineMat = new THREE.MeshStandardMaterial({ map: spineMap, ...matProps });
  const pageMat = new THREE.MeshStandardMaterial({ map: pageEdgeMap, ...matProps });
  const foreMat = new THREE.MeshStandardMaterial({ map: foreEdgeMap, ...matProps });

  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.04, 0.3),
    [spineMat, pageMat, coverMat, backMat, foreMat, foreMat],
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  return group;
}
