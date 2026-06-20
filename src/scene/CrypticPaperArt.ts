import * as THREE from 'three';

export type PaperTheme =
  | 'portal'
  | 'sacred_geometry'
  | 'time_spiral'
  | 'orbit'
  | 'warp_grid'
  | 'sigil'
  | 'diagram'
  | 'notes';

const THEMES: PaperTheme[] = [
  'portal',
  'sacred_geometry',
  'time_spiral',
  'orbit',
  'warp_grid',
  'sigil',
  'diagram',
  'notes',
];

function pickTheme(seed: number): PaperTheme {
  return THEMES[Math.abs(seed) % THEMES.length];
}

function mulberry32(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function drawLinedPaper(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#ddd5c4';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120, 110, 95, 0.28)';
  ctx.lineWidth = 1;
  for (let y = 36; y < h; y += 22) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(w - 12, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(160, 100, 100, 0.35)';
  ctx.beginPath();
  ctx.moveTo(42, 0);
  ctx.lineTo(42, h);
  ctx.stroke();
}

function drawPortal(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  const cx = w * 0.55;
  const cy = h * 0.45;
  ctx.strokeStyle = '#1a1a28';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const r = 18 + i * 14 + rand() * 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * (0.7 + rand() * 0.2), rand() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx + 40, cy + 30);
  ctx.lineTo(cx - 35, cy + 28);
  ctx.closePath();
  ctx.stroke();
  ctx.font = '10px serif';
  ctx.fillStyle = '#2a2a38';
  ctx.fillText('THRESHOLD?', w * 0.12, h * 0.82);
}

function drawSacredGeometry(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  const cx = w * 0.5;
  const cy = h * 0.42;
  ctx.strokeStyle = '#222230';
  ctx.lineWidth = 1.2;
  const r = 34 + rand() * 8;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  ctx.font = '9px serif';
  ctx.fillStyle = '#333344';
  ctx.fillText('stillpoint node', w * 0.1, h * 0.78);
}

function drawTimeSpiral(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.52;
  const cy = h * 0.44;
  ctx.strokeStyle = '#1e1e2a';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 7; t += 0.08) {
    const r = 4 + t * 3.2;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.font = 'bold 11px serif';
  ctx.fillStyle = '#2a2030';
  ctx.fillText('3:17', cx - 14, cy + 4);
  ctx.font = '9px serif';
  ctx.fillText('when time folds', w * 0.1, h * 0.8);
}

function drawOrbit(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  const cx = w * 0.5;
  const cy = h * 0.46;
  ctx.strokeStyle = '#252535';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const rx = 20 + i * 12;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, rx * 0.45, rand() * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    const a = rand() * Math.PI * 2;
    ctx.fillStyle = '#1a1a28';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * rx * 0.45, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWarpGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 1;
  for (let x = 20; x < w - 10; x += 16) {
    ctx.beginPath();
    for (let y = 20; y < h - 20; y += 8) {
      const warp = Math.sin(y * 0.08 + x * 0.04) * 6;
      if (y === 20) ctx.moveTo(x + warp, y);
      else ctx.lineTo(x + warp, y);
    }
    ctx.stroke();
  }
  ctx.font = '9px serif';
  ctx.fillStyle = '#333340';
  ctx.fillText('event horizon sketch', w * 0.08, h * 0.85);
}

function drawSigil(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  const cx = w * 0.5;
  const cy = h * 0.42;
  ctx.strokeStyle = '#1c1c28';
  ctx.lineWidth = 1.5;
  const points = 7;
  for (let i = 0; i < points; i++) {
    const a1 = (i / points) * Math.PI * 2;
    const a2 = ((i + 2) / points) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * 38, cy + Math.sin(a1) * 38);
    ctx.lineTo(cx + Math.cos(a2) * 38, cy + Math.sin(a2) * 38);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + rand() * 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDiagram(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(w * 0.15, h * 0.2, w * 0.55, h * 0.35);
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.38);
  ctx.lineTo(w * 0.7, h * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.55);
  ctx.lineTo(w * 0.62, h * 0.62);
  ctx.lineTo(w * 0.48, h * 0.72);
  ctx.closePath();
  ctx.stroke();
  ctx.font = '8px monospace';
  ctx.fillStyle = '#333';
  ctx.fillText('Δt / Δx = ?', w * 0.12, h * 0.82);
}

function drawNotes(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  const phrases = [
    'the door remembers',
    'still before point',
    'wake inside wake',
    'crow watches threshold',
    'memory chamber',
    'do not look back',
  ];
  ctx.font = '9px serif';
  ctx.fillStyle = '#2a2838';
  const phrase = phrases[Math.floor(rand() * phrases.length)];
  ctx.fillText(phrase, w * 0.1, h * 0.35);
  ctx.fillText('...portal opens when', w * 0.1, h * 0.48);
  ctx.fillText('mind is STILL', w * 0.1, h * 0.58);
  if (rand() > 0.5) {
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.arc(w * 0.65, h * 0.55, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: PaperTheme,
  rand: () => number,
): void {
  switch (theme) {
    case 'portal': drawPortal(ctx, w, h, rand); break;
    case 'sacred_geometry': drawSacredGeometry(ctx, w, h, rand); break;
    case 'time_spiral': drawTimeSpiral(ctx, w, h); break;
    case 'orbit': drawOrbit(ctx, w, h, rand); break;
    case 'warp_grid': drawWarpGrid(ctx, w, h); break;
    case 'sigil': drawSigil(ctx, w, h, rand); break;
    case 'diagram': drawDiagram(ctx, w, h); break;
    case 'notes': drawNotes(ctx, w, h, rand); break;
  }
}

export function createCrypticPaperTexture(seed: number, theme?: PaperTheme): THREE.CanvasTexture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(seed);
  drawLinedPaper(ctx, w, h);
  drawTheme(ctx, w, h, theme ?? pickTheme(seed), rand);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type PaperSpec = {
  id: string;
  width: number;
  height: number;
  seed: number;
  theme?: PaperTheme;
};

export function createPaperMesh(spec: PaperSpec): THREE.Mesh {
  const tex = createCrypticPaperTexture(spec.seed, spec.theme);
  tex.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(spec.width, spec.height);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: new THREE.Color(0.9, 0.88, 0.82),
    roughness: 0.94,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = spec.id;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPushPin(): THREE.Mesh {
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#8b3a3a', roughness: 0.6, metalness: 0.2 }),
  );
  return head;
}
