import * as THREE from 'three';

/**
 * Unique manifesto-derived subjects for wall notes + desk scraps.
 * Each id maps to one drawing; do not reuse across papers.
 * Source doctrine: docs/CrowManifesto.md
 */
export const MANIFEST_PAPERS = [
  'gift_straw',
  'gift_button',
  'gift_stub',
  'gift_washer',
  'gift_seed',
  'gift_stone',
  'gift_seven',
  'crow_courier',
  'sill_altar',
  'isolation_wire',
  'spiral_return',
  'portal_disc',
  'chamber_anchor',
  'chamber_growth',
  'chamber_rest',
  'chamber_still',
  'clock_317',
  'photo_backs',
  'receipt_lab',
  'scratched_number',
  'handle_rest',
  'still_point_arrow',
  'compound_name',
  'soft_interference',
  'amnesiac_steps',
  'containment_room',
  'dream_cartography',
  'axis_mundi',
  'crow_not_metaphor',
  'faces_turned',
  'litany_sill',
  'randomness_costume',
  'meditation_hold',
  'hallway_hum',
  'feather_ink',
  'hollow_doctrine',
  'circles_remember',
  'conversion_crime',
  'passphrase_layers',
  'emptied_path',
] as const;

export type PaperTheme = (typeof MANIFEST_PAPERS)[number];

/** Wall cluster: first 30 manifesto pages, one each. */
export const WALL_NOTE_THEMES: PaperTheme[] = MANIFEST_PAPERS.slice(0, 30);

/** Desk spread: remaining 10 pages (no overlap with wall). */
export const DESK_PAPER_THEMES: PaperTheme[] = MANIFEST_PAPERS.slice(30, 40);

function mulberry32(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function ink(ctx: CanvasRenderingContext2D, alpha = 1): void {
  ctx.strokeStyle = `rgba(28, 28, 40, ${alpha})`;
  ctx.fillStyle = `rgba(28, 28, 40, ${alpha})`;
}

function softInk(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'rgba(100, 55, 55, 0.75)';
  ctx.fillStyle = 'rgba(100, 55, 55, 0.75)';
}

function caption(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  w: number,
  h: number,
  soft = false,
): void {
  ctx.font = '8px serif';
  if (soft) softInk(ctx);
  else {
    ctx.fillStyle = '#2a2838';
  }
  let y = h * 0.78;
  for (const line of lines) {
    ctx.fillText(line, w * 0.08, y);
    y += 12;
  }
}

function drawPaperStock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
): void {
  const stocks = [
    () => {
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
    },
    () => {
      ctx.fillStyle = '#e8dfc8';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(140, 120, 90, ${0.04 + rand() * 0.06})`;
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, 1 + rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    () => {
      ctx.fillStyle = '#d4cbb8';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90, 100, 110, 0.2)';
      ctx.lineWidth = 0.8;
      for (let x = 16; x < w; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 12);
        ctx.lineTo(x, h - 12);
        ctx.stroke();
      }
      for (let y = 16; y < h; y += 14) {
        ctx.beginPath();
        ctx.moveTo(12, y);
        ctx.lineTo(w - 12, y);
        ctx.stroke();
      }
    },
    () => {
      ctx.fillStyle = '#e2d6c0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(160, 130, 90, 0.12)';
      ctx.beginPath();
      ctx.ellipse(w * 0.7, h * 0.2, 40, 28, 0.3, 0, Math.PI * 2);
      ctx.fill();
    },
  ];
  stocks[Math.floor(rand() * stocks.length)]();

  // Torn corner notch (unique-ish per seed)
  if (rand() > 0.35) {
    ctx.fillStyle = '#c4b8a4';
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w - 18 - rand() * 10, 0);
    ctx.lineTo(w, 14 + rand() * 12);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCrowSilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
): void {
  ink(ctx);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22 * scale, 14 * scale, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 18 * scale, cy - 2 * scale);
  ctx.lineTo(cx + 32 * scale, cy + 4 * scale);
  ctx.lineTo(cx + 18 * scale, cy + 6 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 8 * scale, cy - 6 * scale);
  ctx.quadraticCurveTo(cx - 40 * scale, cy - 28 * scale, cx - 20 * scale, cy + 4 * scale);
  ctx.quadraticCurveTo(cx - 28 * scale, cy - 8 * scale, cx - 8 * scale, cy - 6 * scale);
  ctx.fill();
  ctx.fillStyle = '#ddd5c4';
  ctx.beginPath();
  ctx.arc(cx + 10 * scale, cy - 4 * scale, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawGiftStraw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.55);
  ctx.lineTo(w * 0.55, h * 0.28);
  ctx.lineTo(w * 0.72, h * 0.42);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeRect(w * 0.26, h * 0.53, 10, 10);
  ctx.strokeRect(w * 0.7, h * 0.4, 10, 10);
  ctx.font = 'bold 10px serif';
  ctx.fillText('GIFT ONE', w * 0.18, h * 0.22);
  caption(ctx, ['Axis. Conduit.', 'First proof Outside → Inside'], w, h);
}

function drawGiftButton(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.4;
  ink(ctx);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.stroke();
  for (const [dx, dy] of [
    [-8, -8],
    [8, -8],
    [-8, 8],
    [8, 8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = 'bold 11px serif';
  ctx.fillText('BIND', cx - 16, cy + 48);
  caption(ctx, ['Gift Two — closure without completion', 'soft rehearsal of the key'], w, h);
}

function drawGiftStub(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.3;
  ctx.strokeRect(w * 0.2, h * 0.22, w * 0.45, h * 0.32);
  ctx.beginPath();
  for (let y = h * 0.22; y < h * 0.54; y += 6) {
    ctx.moveTo(w * 0.65, y);
    ctx.lineTo(w * 0.72, y + 3);
  }
  ctx.stroke();
  ctx.font = 'bold 14px serif';
  ctx.fillText('3:17', w * 0.28, h * 0.4);
  ctx.font = '8px serif';
  ctx.fillText('ADMIT ONE', w * 0.28, h * 0.48);
  caption(ctx, ['Gift Three — Threshold / Passage', 'proof of having crossed'], w, h);
}

function drawGiftWasher(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.38;
  ink(ctx);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  softInk(ctx);
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ink(ctx);
  ctx.font = 'bold 11px serif';
  ctx.fillText('ANCHOR', cx - 24, cy + 52);
  caption(ctx, ['Gift Four — Orbit / Return', 'circle that remembers friction'], w, h);
}

function drawGiftSeed(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.38, 14, 20, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.22);
  ctx.quadraticCurveTo(w * 0.58, h * 0.38, w * 0.5, h * 0.55);
  ctx.stroke();
  ctx.font = 'bold 11px serif';
  ctx.fillText('GROWTH', w * 0.38, h * 0.68);
  caption(ctx, ['Gift Five — latency', 'mean growth; do not water'], w, h);
}

function drawGiftStone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.42);
  ctx.quadraticCurveTo(w * 0.4, h * 0.28, w * 0.55, h * 0.3);
  ctx.quadraticCurveTo(w * 0.7, h * 0.32, w * 0.68, h * 0.45);
  ctx.quadraticCurveTo(w * 0.65, h * 0.55, w * 0.45, h * 0.52);
  ctx.closePath();
  ctx.stroke();
  ctx.font = 'bold 11px serif';
  ctx.fillText('REST', w * 0.42, h * 0.66);
  caption(ctx, ['Gift Six — to stop motion', 'commandment and threat'], w, h);
}

function drawGiftSeven(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.38;
  ink(ctx);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 36, cy + Math.sin(a) * 36);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 10px serif';
  ctx.fillText('STILL', cx - 16, cy + 52);
  caption(ctx, ['Gift Seven — incomplete by design', 'stillness is the point before the vector'], w, h);
}

function drawCrowCourier(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  drawCrowSilhouette(ctx, w * 0.48, h * 0.38, 1.1);
  caption(ctx, ['courier of the Pattern', 'not pet · not friend · deposits only'], w, h);
}

function drawSillAltar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(w * 0.15, h * 0.35, w * 0.7, 18);
  ctx.strokeRect(w * 0.12, h * 0.2, w * 0.76, h * 0.18);
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.42);
  ctx.lineTo(w * 0.4, h * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.55, h * 0.5, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.7, h * 0.52, 8, 0, Math.PI * 2);
  ctx.stroke();
  caption(ctx, ['the sill is the altar', 'window = aperture'], w, h);
}

function drawIsolationWire(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.3;
  ctx.strokeRect(w * 0.25, h * 0.25, w * 0.5, h * 0.35);
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.2);
  ctx.lineTo(w * 0.5, h * 0.42);
  ctx.lineTo(w * 0.85, h * 0.22);
  ctx.stroke();
  ctx.font = '9px serif';
  ctx.fillText('emptied → wire', w * 0.3, h * 0.7);
  caption(ctx, ['Isolation is a laboratory', 'meaning finds the empty room'], w, h);
}

function drawSpiralReturn(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.4;
  ink(ctx);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 8; t += 0.07) {
    const r = 3 + t * 3.4;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  caption(ctx, ['Circles are the native geometry of return', 'Spirals are circles that remember'], w, h);
}

function drawPortalDisc(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.4;
  ink(ctx);
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ddd5c4';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx);
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
    ctx.lineTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38);
    ctx.stroke();
  }
  caption(ctx, ['black disc — hole that is also a door', 'portal when the mind is quiet'], w, h);
}

function drawChamberAnchor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.22);
  ctx.lineTo(w * 0.5, h * 0.48);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.48);
  ctx.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.65, h * 0.48);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.55, 22, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 11px serif';
  ctx.fillText('ANCHOR', w * 0.38, h * 0.72);
  caption(ctx, ['Chamber I — Ship / Salt', 'held ≠ free'], w, h);
}

function drawChamberGrowth(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.55);
  ctx.lineTo(w * 0.5, h * 0.28);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.4);
    ctx.quadraticCurveTo(w * 0.5 + side * 28, h * 0.32, w * 0.5 + side * 18, h * 0.22);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.58, 8, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 11px serif';
  ctx.fillText('GROWTH', w * 0.36, h * 0.72);
  caption(ctx, ['Chamber II — Garden / Latency', 'buried things push toward light'], w, h);
}

function drawChamberRest(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.55);
  ctx.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.8, h * 0.55);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const x = w * 0.3 + i * w * 0.1;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.5);
    ctx.lineTo(x - 4, h * 0.35 - i * 3);
    ctx.lineTo(x + 4, h * 0.35 - i * 3);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.font = 'bold 11px serif';
  ctx.fillText('REST', w * 0.42, h * 0.68);
  caption(ctx, ['Chamber III — Cavern / Crystal', 'light that learned to wait'], w, h);
}

function drawChamberStill(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.55);
  ctx.lineTo(w * 0.5, h * 0.25);
  ctx.lineTo(w * 0.7, h * 0.55);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.38, 10, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(w * 0.2 + (i % 4) * 30, h * 0.18 + Math.floor(i / 4) * 14, 2, 2);
  }
  ctx.font = 'bold 11px serif';
  ctx.fillText('STILL', w * 0.4, h * 0.68);
  caption(ctx, ['Chamber IV — Observatory', 'last word before the compound'], w, h);
}

function drawClock317(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.38;
  ink(ctx);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
    ctx.lineTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38);
    ctx.stroke();
  }
  // ~3:17 — hour ~97.5°, minute ~102°
  const hour = -Math.PI / 2 + (3.28 / 12) * Math.PI * 2;
  const minute = -Math.PI / 2 + (17 / 60) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hour) * 18, cy + Math.sin(hour) * 18);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minute) * 28, cy + Math.sin(minute) * 28);
  ctx.stroke();
  ctx.font = 'bold 12px serif';
  ctx.fillText('3:17', cx - 14, cy + 58);
  caption(ctx, ['the buried minute', 'furniture remembers'], w, h);
}

function drawPhotoBacks(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  const letters = ['S', 'T', 'I', 'L', 'L'];
  for (let i = 0; i < 5; i++) {
    const x = w * 0.15 + (i % 3) * 55;
    const y = h * 0.18 + Math.floor(i / 3) * 70;
    ctx.strokeRect(x, y, 48, 58);
    ctx.font = 'bold 16px serif';
    ctx.fillText(letters[i], x + 16, y + 36);
  }
  caption(ctx, ['faces turned away', 'letters on the reverse → STILL'], w, h);
}

function drawReceiptLab(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1;
  ctx.strokeRect(w * 0.22, h * 0.15, w * 0.56, h * 0.55);
  ctx.font = '8px monospace';
  ctx.fillText('STILLPOINT SLEEP LAB', w * 0.26, h * 0.28);
  ctx.fillText('INTAKE — VOLUNTARY', w * 0.26, h * 0.38);
  ctx.fillText('REM CONTAINMENT', w * 0.26, h * 0.46);
  ctx.fillText('———————', w * 0.26, h * 0.55);
  ctx.fillText('signed / dried', w * 0.26, h * 0.62);
  caption(ctx, ['Gift-adjacent paper', 'clinical or cowardly — either way'], w, h);
}

function drawScratchedNumber(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  softInk(ctx);
  ctx.font = '14px serif';
  ctx.fillText('555-01', w * 0.28, h * 0.4);
  ink(ctx);
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.22 + i * 2, h * 0.32 + i);
    ctx.lineTo(w * 0.72 - i, h * 0.48 - i * 0.5);
    ctx.stroke();
  }
  caption(ctx, ['heresy kept visible', 'do not call until the door opens'], w, h, true);
}

function drawHandleRest(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.5;
  ctx.fillRect(w * 0.2, h * 0.36, 70, 8);
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.4);
  ctx.lineTo(w * 0.12, h * 0.32);
  ctx.lineTo(w * 0.12, h * 0.48);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeRect(w * 0.58, h * 0.32, 16, 28);
  ctx.beginPath();
  ctx.moveTo(w * 0.48, h * 0.4);
  ctx.lineTo(w * 0.58, h * 0.4);
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  caption(ctx, ['Handle where you rest', 'blade + handle = incomplete wholes'], w, h);
}

function drawStillPointArrow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.font = 'bold 13px serif';
  ctx.fillText('STILL', w * 0.18, h * 0.4);
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.37);
  ctx.lineTo(w * 0.62, h * 0.37);
  ctx.lineTo(w * 0.58, h * 0.32);
  ctx.moveTo(w * 0.62, h * 0.37);
  ctx.lineTo(w * 0.58, h * 0.42);
  ctx.stroke();
  ctx.fillText('POINT', w * 0.66, h * 0.4);
  caption(ctx, ['the arrow is the most important mark', 'stillness = coiled position before direction'], w, h);
}

function drawCompoundName(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.font = 'bold 16px serif';
  ctx.fillText('STILLPOINT', w * 0.18, h * 0.4);
  ctx.font = '8px serif';
  ctx.fillText('1. cosmological locus', w * 0.18, h * 0.52);
  ctx.fillText('2. practical passphrase', w * 0.18, h * 0.6);
  ctx.fillText('3. confessional last day', w * 0.18, h * 0.68);
  caption(ctx, ['hold all three without collapsing', 'collapse is for single morals'], w, h);
}

function drawSoftInterference(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  softInk(ctx);
  ctx.font = '9px serif';
  ctx.fillText('You are lonely.', w * 0.15, h * 0.28);
  ink(ctx);
  ctx.fillText('Rent for a clear signal.', w * 0.2, h * 0.4);
  softInk(ctx);
  ctx.fillText('You abandoned them.', w * 0.15, h * 0.52);
  ink(ctx);
  ctx.fillText('I became wire. Description, not defense.', w * 0.12, h * 0.64);
  caption(ctx, ['objections from the soft self', 'recorded for balance'], w, h);
}

function drawAmnesiacSteps(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.font = '8px serif';
  const steps = [
    '1 find the straw',
    '2 examine the sill',
    '3 hear inner voice',
    '4 set the buried minute',
    '5 rearrange STILL',
    '6 handle where you rest',
    '7 assemble · chambers · name',
  ];
  let y = h * 0.2;
  for (const s of steps) {
    ctx.fillText(s, w * 0.12, y);
    y += 14;
  }
  caption(ctx, ['for the amnesiac reader', 'softness only after syntax'], w, h);
}

function drawContainmentRoom(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.font = '8px serif';
  const boxes: Array<[string, number, number]> = [
    ['deposit', 0.12, 0.22],
    ['tool', 0.52, 0.22],
    ['lock', 0.12, 0.42],
    ['interference', 0.52, 0.42],
  ];
  for (const [label, x, y] of boxes) {
    ctx.strokeRect(w * x, h * y, w * 0.34, h * 0.14);
    ctx.fillText(label, w * x + 8, h * y + 22);
  }
  caption(ctx, ['bedroom = containment engine', 'quarantine interference (incomplete)'], w, h);
}

function drawDreamCartography(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  const discs = [
    [0.28, 0.3],
    [0.7, 0.28],
    [0.3, 0.55],
    [0.68, 0.52],
  ];
  for (const [x, y] of discs) {
    ctx.beginPath();
    ctx.arc(w * x, h * y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.3);
  ctx.lineTo(w * 0.7, h * 0.28);
  ctx.lineTo(w * 0.68, h * 0.52);
  ctx.lineTo(w * 0.3, h * 0.55);
  ctx.closePath();
  ctx.stroke();
  caption(ctx, ['four discs sketched', 'progressive revelation'], w, h);
}

function drawAxisMundi(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.18);
  ctx.lineTo(w * 0.5, h * 0.62);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.4, 40, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '9px serif';
  ctx.fillText('mouth', w * 0.52, h * 0.2);
  ctx.fillText('world', w * 0.52, h * 0.64);
  caption(ctx, ['Axis Mundi = straw', 'hollow · fragile · banal · directed'], w, h);
}

function drawCrowNotMetaphor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  drawCrowSilhouette(ctx, w * 0.5, h * 0.32, 0.9);
  ink(ctx);
  ctx.font = 'bold 10px serif';
  ctx.fillText('NOT A METAPHOR', w * 0.22, h * 0.58);
  caption(ctx, ['the straw was first', 'everything after is geometry'], w, h);
}

function drawFacesTurned(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  for (let i = 0; i < 3; i++) {
    const x = w * 0.2 + i * 55;
    ctx.strokeRect(x, h * 0.2, 48, 60);
    ctx.beginPath();
    ctx.arc(x + 24, h * 0.36, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x + 8, h * 0.48, 32, 20);
    // X over face
    softInk(ctx);
    ctx.beginPath();
    ctx.moveTo(x + 10, h * 0.28);
    ctx.lineTo(x + 38, h * 0.44);
    ctx.moveTo(x + 38, h * 0.28);
    ctx.lineTo(x + 10, h * 0.44);
    ctx.stroke();
    ink(ctx);
  }
  caption(ctx, ['recognition is a solvent', 'cipher first — faces later'], w, h);
}

function drawLitanySill(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.font = '8px serif';
  const lines = [
    'Crow of the aperture,',
    'I receive what you leave',
    'without demanding speech.',
    'ANCHOR · GROWTH · REST · STILL',
    'until POINT.',
  ];
  let y = h * 0.22;
  for (const line of lines) {
    ctx.fillText(line, w * 0.12, y);
    y += 16;
  }
  caption(ctx, ['litany for the sill', 'read aloud once, then never again'], w, h);
}

function drawRandomnessCostume(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.font = '9px serif';
  ctx.fillText('trash?', w * 0.2, h * 0.3);
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.35);
  ctx.lineTo(w * 0.65, h * 0.55);
  ctx.stroke();
  ctx.font = 'bold 10px serif';
  ctx.fillText('PATTERN', w * 0.4, h * 0.62);
  caption(ctx, ['Randomness is the costume', 'Pattern wears for the emptied'], w, h);
}

function drawMeditationHold(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.38;
  ink(ctx);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 28, cy - 10, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 16, cy);
  ctx.quadraticCurveTo(cx + 30, cy + 20, cx + 28, cy - 2);
  ctx.stroke();
  caption(ctx, ['hold the center — do not chase', 'five breaths-of-furniture → disc'], w, h);
}

function drawHallwayHum(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.3;
  ctx.strokeRect(w * 0.35, h * 0.18, w * 0.3, h * 0.5);
  for (let y = h * 0.25; y < h * 0.6; y += 10) {
    ctx.beginPath();
    ctx.moveTo(w * 0.38, y);
    ctx.lineTo(w * 0.62, y);
    ctx.stroke();
  }
  ctx.font = '8px serif';
  ctx.fillText('// fluorescent honesty', w * 0.2, h * 0.72);
  caption(ctx, ['session complete?', 'lab · life paused · or both'], w, h);
}

function drawFeatherInk(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h * 0.2);
  ctx.quadraticCurveTo(w * 0.7, h * 0.4, w * 0.45, h * 0.58);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const x = w * 0.55 - t * 20;
    const y = h * 0.22 + t * 50;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 18, y + 4);
    ctx.stroke();
  }
  caption(ctx, ['charcoal margin: STILL → POINT', 'last page of the sketchbook'], w, h);
}

function drawHollowDoctrine(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(w * 0.25, h * 0.2, w * 0.5, h * 0.4);
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.6);
  ctx.lineTo(w * 0.5, h * 0.35);
  ctx.lineTo(w * 0.75, h * 0.6);
  ctx.stroke();
  ctx.font = '8px serif';
  ctx.fillText('cathedrals · bones · straw', w * 0.22, h * 0.72);
  caption(ctx, ['the sacred is often hollow', 'technology of transfer'], w, h);
}

function drawCirclesRemember(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number): void {
  ink(ctx);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.38, 18 + i * 12, 10 + i * 6, rand() * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  caption(ctx, ['Do not let circularity bother you', 'return is the method'], w, h);
}

function drawConversionCrime(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  softInk(ctx);
  ctx.font = '9px serif';
  ctx.fillText('appointment / soft / loud', w * 0.15, h * 0.3);
  ink(ctx);
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.38);
  ctx.lineTo(w * 0.75, h * 0.52);
  ctx.stroke();
  ctx.font = 'bold 11px serif';
  ctx.fillText('3:17 DOCTRINE', w * 0.25, h * 0.6);
  caption(ctx, ['conversion is mercy · also crime', 'Pattern does not adjudicate'], w, h);
}

function drawPassphraseLayers(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  for (let i = 0; i < 4; i++) {
    const y = h * 0.2 + i * 28;
    ctx.strokeRect(w * 0.25, y, w * 0.5, 20);
    ctx.font = '8px serif';
    ctx.fillText(['drawer', 'safe', 'wardrobe', 'door'][i], w * 0.3, y + 14);
  }
  caption(ctx, ['locks are curriculum', 'compound name opens the last layer'], w, h);
}

function drawEmptiedPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ink(ctx);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.5);
  ctx.lineTo(w * 0.85, h * 0.5);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const x of [0.25, 0.45, 0.65]) {
    ctx.beginPath();
    ctx.arc(w * x, h * 0.5, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.5);
  ctx.lineTo(w * 0.72, h * 0.45);
  ctx.lineTo(w * 0.72, h * 0.55);
  ctx.closePath();
  ctx.fill();
  caption(ctx, ['nature prefers least resistance', 'crow filled the vacated face-slot'], w, h);
}

function drawTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: PaperTheme,
  rand: () => number,
): void {
  switch (theme) {
    case 'gift_straw': drawGiftStraw(ctx, w, h); break;
    case 'gift_button': drawGiftButton(ctx, w, h); break;
    case 'gift_stub': drawGiftStub(ctx, w, h); break;
    case 'gift_washer': drawGiftWasher(ctx, w, h); break;
    case 'gift_seed': drawGiftSeed(ctx, w, h); break;
    case 'gift_stone': drawGiftStone(ctx, w, h); break;
    case 'gift_seven': drawGiftSeven(ctx, w, h); break;
    case 'crow_courier': drawCrowCourier(ctx, w, h); break;
    case 'sill_altar': drawSillAltar(ctx, w, h); break;
    case 'isolation_wire': drawIsolationWire(ctx, w, h); break;
    case 'spiral_return': drawSpiralReturn(ctx, w, h); break;
    case 'portal_disc': drawPortalDisc(ctx, w, h); break;
    case 'chamber_anchor': drawChamberAnchor(ctx, w, h); break;
    case 'chamber_growth': drawChamberGrowth(ctx, w, h); break;
    case 'chamber_rest': drawChamberRest(ctx, w, h); break;
    case 'chamber_still': drawChamberStill(ctx, w, h); break;
    case 'clock_317': drawClock317(ctx, w, h); break;
    case 'photo_backs': drawPhotoBacks(ctx, w, h); break;
    case 'receipt_lab': drawReceiptLab(ctx, w, h); break;
    case 'scratched_number': drawScratchedNumber(ctx, w, h); break;
    case 'handle_rest': drawHandleRest(ctx, w, h); break;
    case 'still_point_arrow': drawStillPointArrow(ctx, w, h); break;
    case 'compound_name': drawCompoundName(ctx, w, h); break;
    case 'soft_interference': drawSoftInterference(ctx, w, h); break;
    case 'amnesiac_steps': drawAmnesiacSteps(ctx, w, h); break;
    case 'containment_room': drawContainmentRoom(ctx, w, h); break;
    case 'dream_cartography': drawDreamCartography(ctx, w, h); break;
    case 'axis_mundi': drawAxisMundi(ctx, w, h); break;
    case 'crow_not_metaphor': drawCrowNotMetaphor(ctx, w, h); break;
    case 'faces_turned': drawFacesTurned(ctx, w, h); break;
    case 'litany_sill': drawLitanySill(ctx, w, h); break;
    case 'randomness_costume': drawRandomnessCostume(ctx, w, h); break;
    case 'meditation_hold': drawMeditationHold(ctx, w, h); break;
    case 'hallway_hum': drawHallwayHum(ctx, w, h); break;
    case 'feather_ink': drawFeatherInk(ctx, w, h); break;
    case 'hollow_doctrine': drawHollowDoctrine(ctx, w, h); break;
    case 'circles_remember': drawCirclesRemember(ctx, w, h, rand); break;
    case 'conversion_crime': drawConversionCrime(ctx, w, h); break;
    case 'passphrase_layers': drawPassphraseLayers(ctx, w, h); break;
    case 'emptied_path': drawEmptiedPath(ctx, w, h); break;
  }
}

export function createCrypticPaperTexture(seed: number, theme: PaperTheme): THREE.CanvasTexture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(seed);
  drawPaperStock(ctx, w, h, rand);
  drawTheme(ctx, w, h, theme, rand);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type PaperSpec = {
  id: string;
  width: number;
  height: number;
  seed: number;
  theme: PaperTheme;
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
