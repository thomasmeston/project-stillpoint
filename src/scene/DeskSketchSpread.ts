import * as THREE from 'three';
import { createPaperMesh, type PaperTheme } from './CrypticPaperArt';

const DESK_SURFACE_Y = 0.802;
const INSPECT_CENTER = new THREE.Vector3(1.78, DESK_SURFACE_Y + 0.14, -0.02);
const INSPECT_SCALE = 2.65;

const SPREAD_LAYOUT: Array<{
  x: number;
  z: number;
  rot: number;
  w: number;
  h: number;
  theme: PaperTheme;
  seed: number;
}> = [
  { x: 1.45, z: -0.22, rot: 18, w: 0.18, h: 0.24, theme: 'portal', seed: 101 },
  { x: 1.72, z: -0.08, rot: -12, w: 0.16, h: 0.22, theme: 'sacred_geometry', seed: 102 },
  { x: 2.05, z: -0.18, rot: 34, w: 0.17, h: 0.23, theme: 'time_spiral', seed: 103 },
  { x: 2.18, z: 0.05, rot: -28, w: 0.15, h: 0.21, theme: 'orbit', seed: 104 },
  { x: 1.55, z: 0.12, rot: 8, w: 0.19, h: 0.25, theme: 'warp_grid', seed: 105 },
  { x: 1.88, z: 0.18, rot: -22, w: 0.16, h: 0.22, theme: 'sigil', seed: 106 },
  { x: 2.12, z: 0.22, rot: 41, w: 0.14, h: 0.2, theme: 'diagram', seed: 107 },
  { x: 1.38, z: 0.02, rot: -35, w: 0.17, h: 0.23, theme: 'notes', seed: 108 },
  { x: 1.98, z: -0.02, rot: 15, w: 0.18, h: 0.24, theme: 'portal', seed: 109 },
  { x: 1.62, z: 0.2, rot: -8, w: 0.15, h: 0.21, theme: 'sacred_geometry', seed: 110 },
];

type AnimMode = 'none' | 'open' | 'close';
type InspectMode = 'none' | 'to_inspect' | 'from_inspect';

type PaperAnimState = {
  mesh: THREE.Mesh;
  layoutIndex: number;
  delay: number;
};

type PaperRestPose = {
  position: THREE.Vector3;
  rotationZ: number;
  scale: number;
};

export type DeskZoomHit =
  | { type: 'sketchbook' }
  | { type: 'paper'; index: number };

export class DeskSketchSpread {
  readonly group = new THREE.Group();
  readonly sketchbookHitArea: THREE.Mesh;
  private readonly notebookOrigin = new THREE.Vector3();
  private papers: PaperAnimState[] = [];
  private spread = false;
  private animMode: AnimMode = 'none';
  private animTime = 0;
  private readonly openDuration = 0.75;
  private readonly closeDuration = 0.6;
  private readonly stagger = 0.045;
  private notebookCoverT = 0;
  private sketchbookRestRotX = 0;
  private sketchbookRestScaleY = 1;
  private sketchbookRestCached = false;

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
  private paperRestPoses: PaperRestPose[] = [];

  constructor(sketchbookPosition: THREE.Vector3) {
    this.group.name = 'DeskSketchSpread';
    this.notebookOrigin.set(sketchbookPosition.x, DESK_SURFACE_Y + 0.006, sketchbookPosition.z);

    for (let i = 0; i < SPREAD_LAYOUT.length; i++) {
      const layout = SPREAD_LAYOUT[i];
      const paper = createPaperMesh({
        id: `desk_sketch_paper_${i}`,
        width: layout.w,
        height: layout.h,
        seed: layout.seed,
        theme: layout.theme,
      });
      paper.rotation.x = -Math.PI / 2;
      paper.rotation.z = 0;
      paper.position.copy(this.notebookOrigin);
      paper.visible = false;
      paper.userData.deskItem = 'sketch_paper';
      paper.userData.paperIndex = i;
      this.papers.push({ mesh: paper, layoutIndex: i, delay: i * this.stagger });
      this.group.add(paper);
      this.paperRestPoses.push(this.layoutRestPose(i));
    }

    const hitGeo = new THREE.PlaneGeometry(0.36, 0.38);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.sketchbookHitArea = new THREE.Mesh(hitGeo, hitMat);
    this.sketchbookHitArea.name = 'SketchbookHitArea';
    this.sketchbookHitArea.rotation.x = -Math.PI / 2;
    this.sketchbookHitArea.position.copy(this.notebookOrigin);
    this.sketchbookHitArea.userData.deskItem = 'sketchbook';
    this.group.add(this.sketchbookHitArea);
  }

  getClickTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = [this.sketchbookHitArea];
    if (this.spread && this.animMode === 'none') {
      for (const { mesh } of this.papers) {
        if (mesh.visible) targets.push(mesh);
      }
    }
    return targets;
  }

  isSpread(): boolean {
    return this.spread;
  }

  isAnimating(): boolean {
    return this.animMode !== 'none' || this.inspectMode !== 'none';
  }

  isInspecting(): boolean {
    return this.inspectedIndex !== null || this.inspectMode === 'to_inspect';
  }

  toggleNotebook(): void {
    if (this.animMode !== 'none' || this.inspectMode !== 'none') return;
    if (this.spread) {
      this.closeNotebook();
    } else {
      this.openNotebook();
    }
  }

  inspectPaper(index: number): void {
    if (!this.spread || this.animMode !== 'none') return;
    if (index < 0 || index >= this.papers.length) return;

    if (this.inspectedIndex === index && this.inspectMode === 'none') {
      this.dismissInspect();
      return;
    }

    if (this.inspectMode !== 'none') return;

    if (this.inspectedIndex !== null && this.inspectedIndex !== index) {
      this.restorePaperVisual(this.inspectedIndex);
    }

    this.captureRestPose(index);
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

  openNotebook(): void {
    if (this.spread || this.animMode !== 'none') return;
    this.spread = true;
    this.animMode = 'open';
    this.animTime = 0;
    for (const { mesh } of this.papers) {
      mesh.visible = true;
      mesh.position.copy(this.notebookOrigin);
      mesh.rotation.z = 0;
      mesh.scale.setScalar(0.12);
      mesh.renderOrder = 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1;
      mat.transparent = false;
    }
    this.setNotebookOpenVisual(0);
  }

  closeNotebook(): void {
    if (!this.spread || this.animMode !== 'none') return;
    this.clearInspectImmediate();
    this.animMode = 'close';
    this.animTime = 0;
  }

  reset(): void {
    this.spread = false;
    this.animMode = 'none';
    this.animTime = 0;
    this.notebookCoverT = 0;
    this.clearInspectImmediate();
    this.papers.forEach(({ mesh }, i) => {
      mesh.visible = false;
      const layout = SPREAD_LAYOUT[i];
      mesh.position.set(layout.x, DESK_SURFACE_Y + 0.003 * i, layout.z);
      mesh.rotation.z = THREE.MathUtils.degToRad(layout.rot);
      mesh.scale.setScalar(1);
      mesh.renderOrder = 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 1;
      mat.transparent = false;
      this.paperRestPoses[i] = this.layoutRestPose(i);
    });
    this.setNotebookOpenVisual(0);
    const sketchbook = this.getSketchbookProp();
    if (sketchbook && this.sketchbookRestCached) {
      sketchbook.rotation.x = this.sketchbookRestRotX;
      sketchbook.scale.y = this.sketchbookRestScaleY;
    }
    this.setSketchbookPropVisible(true);
  }

  update(dt: number): void {
    if (this.animMode === 'open') {
      this.updateOpenAnimation(dt);
    } else if (this.animMode === 'close') {
      this.updateCloseAnimation(dt);
    }

    if (this.inspectMode !== 'none') {
      this.updateInspectAnimation(dt);
    }
  }

  raycastHit(raycaster: THREE.Raycaster): DeskZoomHit | null {
    raycaster.layers.set(0);
    const hits = raycaster.intersectObjects(this.getClickTargets(), false);
    if (hits.length === 0) return null;

    const item = hits[0].object.userData.deskItem as string;
    if (item === 'sketchbook') return { type: 'sketchbook' };
    if (item === 'sketch_paper') {
      return { type: 'paper', index: hits[0].object.userData.paperIndex as number };
    }
    return null;
  }

  private updateOpenAnimation(dt: number): void {
    this.animTime += dt;
    const coverT = Math.min(this.animTime / 0.35, 1);
    this.notebookCoverT = 1 - Math.pow(1 - coverT, 2);
    this.setNotebookOpenVisual(this.notebookCoverT);

    let allDone = true;
    for (const { mesh, layoutIndex, delay } of this.papers) {
      const layout = SPREAD_LAYOUT[layoutIndex];
      const localT = THREE.MathUtils.clamp((this.animTime - delay) / (this.openDuration - delay * 0.5), 0, 1);
      if (localT < 1) allDone = false;

      const ease = this.easeOutBack(localT);
      const target = new THREE.Vector3(layout.x, DESK_SURFACE_Y + 0.003 * layoutIndex, layout.z);
      const stackOffset = new THREE.Vector3(
        (layoutIndex % 3 - 1) * 0.008,
        0.004 * layoutIndex,
        (Math.floor(layoutIndex / 3) - 1) * 0.008,
      );
      const origin = this.notebookOrigin.clone().add(stackOffset);

      mesh.position.lerpVectors(origin, target, ease);
      const arcLift = Math.sin(localT * Math.PI) * 0.07 * (1 - localT * 0.35);
      mesh.position.y += arcLift;

      mesh.rotation.z = THREE.MathUtils.lerp(0, THREE.MathUtils.degToRad(layout.rot), ease);
      const scale = THREE.MathUtils.lerp(0.12, 1, ease);
      mesh.scale.setScalar(scale);
    }

    if (allDone && this.animTime >= this.openDuration) {
      this.animMode = 'none';
      this.papers.forEach(({ layoutIndex }) => {
        this.paperRestPoses[layoutIndex] = this.layoutRestPose(layoutIndex);
      });
    }
  }

  private updateCloseAnimation(dt: number): void {
    this.animTime += dt;
    const coverT = Math.min(this.animTime / 0.3, 1);
    this.notebookCoverT = 1 - coverT;
    this.setNotebookOpenVisual(this.notebookCoverT);

    let allDone = true;
    const reverseDelay = (this.papers.length - 1) * this.stagger;

    for (const { mesh, layoutIndex, delay } of this.papers) {
      const layout = SPREAD_LAYOUT[layoutIndex];
      const closeDelay = reverseDelay - delay;
      const localT = THREE.MathUtils.clamp((this.animTime - closeDelay) / (this.closeDuration - closeDelay * 0.4), 0, 1);
      if (localT < 1) allDone = false;

      const ease = localT * localT * localT;
      const target = new THREE.Vector3(layout.x, DESK_SURFACE_Y + 0.003 * layoutIndex, layout.z);
      const stackOffset = new THREE.Vector3(
        (layoutIndex % 3 - 1) * 0.006,
        0.003 * layoutIndex,
        (Math.floor(layoutIndex / 3) - 1) * 0.006,
      );
      const origin = this.notebookOrigin.clone().add(stackOffset);

      mesh.position.lerpVectors(target, origin, ease);
      const arcLift = Math.sin(localT * Math.PI) * 0.04;
      mesh.position.y += arcLift;

      mesh.rotation.z = THREE.MathUtils.lerp(
        THREE.MathUtils.degToRad(layout.rot),
        0,
        ease,
      );
      const scale = THREE.MathUtils.lerp(1, 0.1, ease);
      mesh.scale.setScalar(scale);

      if (localT >= 1) {
        mesh.visible = false;
      }
    }

    if (allDone && this.animTime >= this.closeDuration) {
      this.spread = false;
      this.animMode = 'none';
      this.setNotebookOpenVisual(0);
    }
  }

  private updateInspectAnimation(dt: number): void {
    if (this.inspectedIndex === null) return;

    this.inspectTime += dt;
    const t = THREE.MathUtils.clamp(this.inspectTime / this.inspectDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const mesh = this.papers[this.inspectedIndex].mesh;

    mesh.position.lerpVectors(this.inspectFrom.position, this.inspectTo.position, eased);
    mesh.rotation.z = THREE.MathUtils.lerp(this.inspectFrom.rotationZ, this.inspectTo.rotationZ, eased);
    const scale = THREE.MathUtils.lerp(this.inspectFrom.scale, this.inspectTo.scale, eased);
    mesh.scale.setScalar(scale);

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

  private layoutRestPose(index: number): PaperRestPose {
    const layout = SPREAD_LAYOUT[index];
    return {
      position: new THREE.Vector3(layout.x, DESK_SURFACE_Y + 0.003 * index, layout.z),
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

  private captureRestPose(index: number): void {
    if (this.inspectMode === 'none') {
      this.paperRestPoses[index] = this.poseFromMesh(this.papers[index].mesh);
    }
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

  private clearInspectImmediate(): void {
    if (this.inspectedIndex !== null) {
      this.restorePaperVisual(this.inspectedIndex);
    }
    this.inspectedIndex = null;
    this.inspectMode = 'none';
    this.inspectTime = 0;
    this.clearPaperDimming();
  }

  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  private setNotebookOpenVisual(openAmount: number): void {
    const sketchbook = this.getSketchbookProp();
    if (!sketchbook) return;
    if (!this.sketchbookRestCached) {
      this.sketchbookRestRotX = sketchbook.rotation.x;
      this.sketchbookRestScaleY = sketchbook.scale.y;
      this.sketchbookRestCached = true;
    }
    sketchbook.visible = true;
    sketchbook.rotation.x = THREE.MathUtils.lerp(
      this.sketchbookRestRotX,
      this.sketchbookRestRotX - 0.55,
      openAmount,
    );
    sketchbook.scale.y = THREE.MathUtils.lerp(this.sketchbookRestScaleY, this.sketchbookRestScaleY * 0.55, openAmount);
  }

  private setSketchbookPropVisible(visible: boolean): void {
    const sketchbook = this.getSketchbookProp();
    if (sketchbook) sketchbook.visible = visible;
  }

  private getSketchbookProp(): THREE.Object3D | null {
    const root = this.group.parent;
    if (!root) return null;
    return root.getObjectByName('Sketchbook') ?? null;
  }
}
