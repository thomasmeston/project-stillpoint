import * as THREE from 'three';
import { createPaperMesh, createPushPin, type PaperTheme } from './CrypticPaperArt';

const INSPECT_CENTER = new THREE.Vector3(0.25, 0.05, 0.32);
const INSPECT_SCALE = 2.75;
const PAPER_Z = 0.1;
/** Wall-local X shift — cluster sits left of the painting (painting center x ≈ 0.5). */
export const WALL_NOTES_CLUSTER_OFFSET_X = -1.35;
const WALL_NOTES_FOCUS_X = 0.25;

export function getWallNotesFocusOnWall(): THREE.Vector3 {
  return new THREE.Vector3(
    WALL_NOTES_CLUSTER_OFFSET_X + WALL_NOTES_FOCUS_X,
    0.05,
    0.08,
  );
}

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

type NoteLayout = {
  x: number;
  y: number;
  rot: number;
  w: number;
  h: number;
  seed: number;
  theme: PaperTheme;
};

type PaperRestPose = {
  position: THREE.Vector3;
  rotationZ: number;
  scale: number;
};

type InspectMode = 'none' | 'to_inspect' | 'from_inspect';

type WallPaperState = {
  mesh: THREE.Mesh;
  layoutIndex: number;
};

export type WallNoteHit = { type: 'paper'; index: number };

function buildLayouts(): NoteLayout[] {
  const layouts: NoteLayout[] = [];
  let seed = 200;
  const slots: Array<[number, number, number]> = [
    [-1.4, -0.45, -8], [-0.95, -0.35, 12], [-0.55, -0.55, -15], [-0.15, -0.25, 6],
    [0.25, -0.45, -10], [0.65, -0.15, 18], [1.05, -0.5, -6], [1.45, -0.3, 14],
    [1.85, -0.45, -12], [2.15, -0.1, 8], [-1.2, 0.05, 5], [-0.7, 0.15, -18],
    [-0.2, 0.05, 10], [0.35, 0.15, -8], [0.85, 0.05, 16], [1.35, 0.2, -4],
    [1.75, 0.05, 12], [-1.05, 0.55, -6], [-0.45, 0.65, 14], [0.15, 0.55, -12],
    [0.75, 0.7, 8], [1.25, 0.55, -16], [1.65, 0.65, 6], [-1.35, 0.35, 10],
    [2.0, 0.35, -10], [-0.85, -0.15, 20], [0.5, -0.35, -22], [1.15, -0.25, 4],
    [1.55, -0.15, -14], [0.0, 0.35, 8],
  ];

  for (const [x, y, rot] of slots) {
    const theme = THEMES[seed % THEMES.length];
    const w = 0.14 + (seed % 5) * 0.015;
    const h = 0.18 + (seed % 4) * 0.018;
    layouts.push({ x, y, rot, w, h, seed, theme });
    seed += 7;
  }
  return layouts;
}

export class WallNotesCluster {
  readonly group = new THREE.Group();
  private readonly layouts = buildLayouts();
  private papers: WallPaperState[] = [];
  private paperRestPoses: PaperRestPose[] = [];

  private inspectedIndex: number | null = null;
  private inspectMode: InspectMode = 'none';
  private inspectTime = 0;
  private readonly inspectDuration = 0.38;
  private inspectFrom: PaperRestPose = {
    position: new THREE.Vector3(),
    rotationZ: 0,
    scale: 1,
  };
  private inspectTo: PaperRestPose = {
    position: new THREE.Vector3(),
    rotationZ: 0,
    scale: 1,
  };

  constructor() {
    this.group.name = 'WallNotesCluster';
    this.group.position.x = WALL_NOTES_CLUSTER_OFFSET_X;
    const layouts = buildLayouts();
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      const paper = createPaperMesh({
        id: `wall_note_${i}`,
        width: layout.w,
        height: layout.h,
        seed: layout.seed,
        theme: layout.theme,
      });
      paper.position.set(layout.x, layout.y, PAPER_Z);
      paper.rotation.z = THREE.MathUtils.degToRad(layout.rot);
      paper.userData.wallNote = 'paper';
      paper.userData.paperIndex = i;

      const pin = createPushPin();
      pin.position.set(layout.x, layout.y + layout.h * 0.42, PAPER_Z + 0.02);

      this.papers.push({ mesh: paper, layoutIndex: i });
      this.paperRestPoses.push(this.layoutRestPose(i));
      this.group.add(paper);
      this.group.add(pin);
    }
  }

  attachToWall(wallMesh: THREE.Mesh): void {
    wallMesh.add(this.group);
  }

  getClickTargets(): THREE.Object3D[] {
    return this.papers.map(({ mesh }) => mesh);
  }

  isAnimating(): boolean {
    return this.inspectMode !== 'none';
  }

  isInspecting(): boolean {
    return this.inspectedIndex !== null || this.inspectMode === 'to_inspect';
  }

  inspectPaper(index: number): void {
    if (index < 0 || index >= this.papers.length) return;

    if (this.inspectedIndex === index && this.inspectMode === 'none') {
      this.dismissInspect();
      return;
    }

    if (this.inspectMode !== 'none') return;

    if (this.inspectedIndex !== null && this.inspectedIndex !== index) {
      this.restorePaperVisual(this.inspectedIndex);
    }

    this.inspectedIndex = index;
    this.inspectFrom = this.poseFromMesh(this.papers[index].mesh);
    this.inspectTo = this.inspectPose();
    this.inspectMode = 'to_inspect';
    this.inspectTime = 0;
    this.applyInspectDimming(index);
  }

  dismissInspect(): void {
    if (this.inspectedIndex === null || this.inspectMode !== 'none') return;
    const index = this.inspectedIndex;
    this.inspectFrom = this.poseFromMesh(this.papers[index].mesh);
    this.inspectTo = this.paperRestPoses[index];
    this.inspectMode = 'from_inspect';
    this.inspectTime = 0;
  }

  resetInspect(): void {
    if (this.inspectedIndex !== null) {
      this.restorePaperVisual(this.inspectedIndex);
    }
    this.inspectedIndex = null;
    this.inspectMode = 'none';
    this.inspectTime = 0;
    this.clearPaperDimming();
  }

  update(dt: number): void {
    if (this.inspectMode === 'none') return;
    if (this.inspectedIndex === null) return;

    this.inspectTime += dt;
    const t = THREE.MathUtils.clamp(this.inspectTime / this.inspectDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const mesh = this.papers[this.inspectedIndex].mesh;

    mesh.position.lerpVectors(this.inspectFrom.position, this.inspectTo.position, eased);
    mesh.rotation.z = THREE.MathUtils.lerp(this.inspectFrom.rotationZ, this.inspectTo.rotationZ, eased);
    mesh.scale.setScalar(THREE.MathUtils.lerp(this.inspectFrom.scale, this.inspectTo.scale, eased));

    if (t >= 1) {
      if (this.inspectMode === 'to_inspect') {
        this.inspectMode = 'none';
        mesh.renderOrder = 12;
      } else {
        const idx = this.inspectedIndex;
        this.inspectMode = 'none';
        this.inspectedIndex = null;
        mesh.renderOrder = 0;
        this.clearPaperDimming();
        if (idx !== null) {
          this.paperRestPoses[idx] = this.poseFromMesh(mesh);
        }
      }
    }
  }

  raycastHit(raycaster: THREE.Raycaster): WallNoteHit | null {
    raycaster.layers.set(0);
    const hits = raycaster.intersectObjects(this.getClickTargets(), false);
    if (hits.length === 0) return null;
    return { type: 'paper', index: hits[0].object.userData.paperIndex as number };
  }

  private layoutRestPose(index: number): PaperRestPose {
    const layout = this.layouts[index];
    return {
      position: new THREE.Vector3(layout.x, layout.y, PAPER_Z),
      rotationZ: THREE.MathUtils.degToRad(layout.rot),
      scale: 1,
    };
  }

  private inspectPose(): PaperRestPose {
    return {
      position: INSPECT_CENTER.clone(),
      rotationZ: 0,
      scale: INSPECT_SCALE,
    };
  }

  private poseFromMesh(mesh: THREE.Mesh): PaperRestPose {
    return {
      position: mesh.position.clone(),
      rotationZ: mesh.rotation.z,
      scale: mesh.scale.x,
    };
  }

  private restorePaperVisual(index: number): void {
    const mesh = this.papers[index].mesh;
    const rest = this.paperRestPoses[index];
    mesh.position.copy(rest.position);
    mesh.rotation.z = rest.rotationZ;
    mesh.scale.setScalar(rest.scale);
    mesh.renderOrder = 0;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.opacity = 1;
    mat.transparent = false;
  }

  private applyInspectDimming(activeIndex: number): void {
    for (const { mesh, layoutIndex } of this.papers) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (layoutIndex === activeIndex) {
        mat.opacity = 1;
        mat.transparent = false;
        continue;
      }
      mat.transparent = true;
      mat.opacity = 0.42;
    }
  }

  private clearPaperDimming(): void {
    for (const { mesh } of this.papers) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1;
      mat.transparent = false;
    }
  }
}
