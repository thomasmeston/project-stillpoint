import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { publicUrl } from '../utils/publicUrl';

const SHIP_URL = 'models/props/sail-ship.glb';
/** Target ship length along the long axis (world units). */
const TARGET_LEN = 42;

export type UpperDeckPlane = {
  floor: THREE.Mesh;
  /** Logical walk height above main deck (local Y). */
  height: number;
  /** Climb markers in ship-local space (y = logical deck height). */
  climbBottom: THREE.Vector3;
  climbTop: THREE.Vector3;
};

export type SailShipReady = {
  group: THREE.Group;
  /** Invisible walkable main deck — register in floorMeshes. */
  deckFloor: THREE.Mesh;
  deckSize: { x: number; z: number };
  /** Invisible plane fitted to the model's existing aft upper deck. */
  upperDeck: UpperDeckPlane | null;
};

/** Quaternius "Sail Ship" (CC0) — https://poly.pizza/m/cIzO4MBPqI */
export function loadSailShip(onReady: (result: SailShipReady) => void): void {
  const loader = new GLTFLoader();
  loader.load(
    publicUrl(SHIP_URL),
    (gltf) => {
      const group = new THREE.Group();
      group.name = 'PirateShip';

      const model = gltf.scene;
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = TARGET_LEN / (Math.max(size.x, size.z) || 1);
      model.scale.setScalar(scale);

      // Center XZ, then drop so the main deck top sits at local y = 0.
      const scaled = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      scaled.getCenter(center);
      model.position.set(-center.x, 0, -center.z);

      const deckY = findDeckSurfaceY(model);
      model.position.y = -deckY;
      group.add(model);

      const deckBounds = measureDeckFootprint(model);
      const deckFloor = buildWalkableDeckFloor(deckBounds.x, deckBounds.z, 0);
      group.add(deckFloor);

      const upperDeck = buildUpperDeckFloorFromModel(model);
      if (upperDeck) {
        group.add(upperDeck.floor);
      }

      onReady({
        group,
        deckFloor,
        deckSize: deckBounds,
        upperDeck,
      });
    },
    undefined,
    () => {
      onReady(buildFallbackShip());
    },
  );
}

/** Walkable plank height — cabin base (BigShip_2.min), not gunwale rims. */
function findDeckSurfaceY(model: THREE.Object3D): number {
  model.updateMatrixWorld(true);

  let cabinFloorY: number | null = null;
  let railTopY: number | null = null;

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const box = new THREE.Box3().setFromObject(child);
    const name = child.name.toLowerCase();
    if (name === 'bigship_2') {
      cabinFloorY = box.min.y;
    }
    if (name === 'bigship_1' || name === 'bigship_3') {
      railTopY = Math.max(railTopY ?? -Infinity, box.max.y);
    }
  });

  // Cabin sits on the deck; fall back slightly below the rail rim if needed.
  if (cabinFloorY != null) return cabinFloorY;
  if (railTopY != null) return railTopY - 0.55;
  const full = new THREE.Box3().setFromObject(model);
  return full.min.y + (full.max.y - full.min.y) * 0.28;
}

function measureDeckFootprint(model: THREE.Object3D): { x: number; z: number } {
  model.updateMatrixWorld(true);
  let box: THREE.Box3 | null = null;
  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const name = child.name.toLowerCase();
    if (name.startsWith('bigship_') || name === 'rudder') {
      const b = new THREE.Box3().setFromObject(child);
      box = box ? box.union(b) : b.clone();
    }
  });
  if (!box) {
    box = new THREE.Box3().setFromObject(model);
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  // Slightly inset so the player stays on planks, not over the rail void.
  return {
    x: Math.max(size.x * 0.72, 4),
    z: Math.max(size.z * 0.78, 8),
  };
}

function buildWalkableDeckFloor(width: number, depth: number, deckHeight: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.06, depth),
    new THREE.MeshStandardMaterial({
      color: '#c98a4b',
      roughness: 0.95,
      metalness: 0.02,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  mesh.name = deckHeight > 0 ? 'UpperDeckFloor' : 'DeckFloor';
  // Collider centered so top face sits at deckHeight.
  mesh.position.y = deckHeight - 0.03;
  mesh.userData.isFloor = true;
  mesh.userData.deckHeight = deckHeight;
  mesh.layers.set(0);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Fit an invisible walk plane to the Quaternius aft raised deck (BigShip_1 top surface).
 * Measured from mesh verts after the main deck has been aligned to y = 0.
 */
function buildUpperDeckFloorFromModel(model: THREE.Object3D): UpperDeckPlane | null {
  model.updateMatrixWorld(true);

  let hull: THREE.Mesh | null = null;
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && child.name === 'BigShip_1') {
      hull = child as THREE.Mesh;
    }
  });
  if (!hull) return null;

  const mesh = hull as THREE.Mesh;
  const pos = mesh.geometry.getAttribute('position');
  if (!pos) return null;

  const v = new THREE.Vector3();
  const samples: Array<[number, number, number]> = [];
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    // Raised aft deck sits well above the main plank line.
    if (v.y < 1.6 || v.y > 4.2) continue;
    // Stern half of the ship (negative Z after centering).
    if (v.z > -12) continue;
    samples.push([v.x, v.y, v.z]);
  }
  if (samples.length < 40) return null;

  // Densest Y band ≈ flat walkable surface.
  const bins = new Map<number, number>();
  for (const [, y] of samples) {
    const key = Math.round(y / 0.12) * 0.12;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let bestY = 3;
  let bestCount = 0;
  for (const [y, count] of bins) {
    if (count > bestCount) {
      bestCount = count;
      bestY = y;
    }
  }

  const band = samples.filter((p) => Math.abs(p[1] - bestY) < 0.18);
  if (band.length < 20) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let sumY = 0;
  for (const [x, y, z] of band) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
    sumY += y;
  }
  const height = sumY / band.length;
  // Inset so feet stay on planks inside the rails.
  const inset = 0.35;
  const width = Math.max(maxX - minX - inset * 2, 2.5);
  const depth = Math.max(maxZ - minZ - inset * 2, 2.5);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const floor = buildWalkableDeckFloor(width, depth, height);
  floor.position.x = centerX;
  floor.position.z = centerZ;

  // Climb at the forward lip of the raised deck (toward midships).
  const climbX = centerX;
  const lipZ = maxZ - inset;
  const climbBottom = new THREE.Vector3(climbX, 0, lipZ + 0.85);
  const climbTop = new THREE.Vector3(climbX, height, lipZ - 0.45);

  return { floor, height, climbBottom, climbTop };
}

export function buildFallbackShip(): SailShipReady {
  const group = new THREE.Group();
  group.name = 'PirateShip';

  const hullMat = new THREE.MeshStandardMaterial({
    color: '#6e4a2b',
    roughness: 0.85,
    metalness: 0.05,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: '#c98a4b',
    roughness: 0.9,
    metalness: 0.02,
  });
  const sailMat = new THREE.MeshStandardMaterial({
    color: '#f4f1e8',
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(38, 5, 13), hullMat);
  hull.position.y = -2.5;
  hull.castShadow = true;
  group.add(hull);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.22, 11), deckMat);
  deck.position.y = -0.05;
  deck.receiveShadow = true;
  group.add(deck);

  // Simple raised aft block so the fallback still has an upper surface to match.
  const upperVisual = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 7), deckMat);
  upperVisual.position.set(0, 2.9, -12);
  upperVisual.receiveShadow = true;
  group.add(upperVisual);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 16, 8), hullMat);
  mast.position.set(0, 7.8, 0);
  mast.castShadow = true;
  group.add(mast);

  const sail = new THREE.Mesh(new THREE.PlaneGeometry(10, 9), sailMat);
  sail.position.set(0, 6.5, -0.4);
  group.add(sail);

  const deckSize = { x: 30, z: 9.5 };
  const deckFloor = buildWalkableDeckFloor(deckSize.x, deckSize.z, 0);
  group.add(deckFloor);

  const height = 3;
  const upperFloor = buildWalkableDeckFloor(9, 6.2, height);
  upperFloor.position.set(0, height - 0.03, -12);
  group.add(upperFloor);

  return {
    group,
    deckFloor,
    deckSize,
    upperDeck: {
      floor: upperFloor,
      height,
      climbBottom: new THREE.Vector3(0, 0, -8.5),
      climbTop: new THREE.Vector3(0, height, -9.2),
    },
  };
}

export function createOceanTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#1a6a9a');
  base.addColorStop(0.45, '#2a87b5');
  base.addColorStop(1, '#165f8c');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 48; i += 1) {
    const y = (i / 48) * size + Math.sin(i * 0.7) * 4;
    ctx.strokeStyle = `rgba(180, 230, 255, ${0.08 + (i % 5) * 0.02})`;
    ctx.lineWidth = 1.5 + (i % 3);
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const yy = y + Math.sin(x * 0.04 + i) * 6 + Math.cos(x * 0.02) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 120; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + Math.random() * 10, 1.5 + Math.random() * 2, Math.random() * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function buildOceanPlane(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(200, 200, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: createOceanTexture(),
    roughness: 0.35,
    metalness: 0.15,
    color: '#ffffff',
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Ocean';
  mesh.rotation.x = -Math.PI / 2;
  // Below the hull once the deck sits at y≈0 (larger ship sits deeper).
  mesh.position.y = -5.5;
  mesh.receiveShadow = true;
  return mesh;
}

/** Gentle bob + roll so the ship feels afloat on the ocean. */
export class ShipFloatMotion {
  private elapsed = 0;
  private readonly baseY: number;
  private readonly target: THREE.Object3D;

  constructor(target: THREE.Object3D, baseY = 0) {
    this.target = target;
    this.baseY = baseY;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed;
    this.target.position.y = this.baseY + Math.sin(t * 0.85) * 0.07 + Math.sin(t * 1.35) * 0.02;
    this.target.rotation.z = Math.sin(t * 0.55) * 0.018;
    this.target.rotation.x = Math.sin(t * 0.4 + 1.2) * 0.01;
  }
}

/** Slow UV drift for the ocean surface. */
export function updateOceanDrift(ocean: THREE.Mesh, dt: number): void {
  const mat = ocean.material as THREE.MeshStandardMaterial;
  const map = mat.map;
  if (!map) return;
  map.offset.x = (map.offset.x + dt * 0.008) % 1;
  map.offset.y = (map.offset.y + dt * 0.005) % 1;
}
