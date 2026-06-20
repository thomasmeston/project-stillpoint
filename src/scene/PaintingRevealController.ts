import * as THREE from 'three';
import { buildPaintingWithFrame } from './OakTreePaintingArt';

type AnimPhase = 'closed' | 'pop' | 'swing' | 'open';

export class PaintingRevealController {
  readonly group = new THREE.Group();
  private readonly swingGroup = new THREE.Group();
  private readonly size: THREE.Vector3;
  private phase: AnimPhase = 'closed';
  private animTime = 0;
  private onComplete: (() => void) | null = null;

  private readonly popDuration = 0.22;
  private readonly swingDuration = 0.72;
  private readonly maxPop = 0.11;
  private readonly maxSwing = 1.35;

  constructor(size: THREE.Vector3, frameColor: THREE.Color) {
    this.size = size.clone();
    this.group.name = 'Painting';

    const hinge = new THREE.Group();
    hinge.position.set(-size.x / 2, size.y / 2, 0);

    const content = buildPaintingWithFrame(size, frameColor);
    content.position.set(size.x / 2, -size.y / 2, 0);
    this.swingGroup.add(content);

    hinge.add(this.swingGroup);
    this.group.add(hinge);
    this.applyPose(0, 0);
  }

  isAnimating(): boolean {
    return this.phase === 'pop' || this.phase === 'swing';
  }

  isOpen(): boolean {
    return this.phase === 'open';
  }

  swingOpen(onComplete?: () => void): void {
    if (this.phase === 'open') {
      onComplete?.();
      return;
    }
    if (this.isAnimating()) return;

    this.onComplete = onComplete ?? null;
    this.phase = 'pop';
    this.animTime = 0;
  }

  setOpenImmediate(): void {
    this.phase = 'open';
    this.animTime = 0;
    this.onComplete = null;
    this.applyPose(this.maxPop, this.maxSwing);
  }

  resetClosed(): void {
    this.phase = 'closed';
    this.animTime = 0;
    this.onComplete = null;
    this.applyPose(0, 0);
  }

  update(dt: number): void {
    if (this.phase === 'closed' || this.phase === 'open') return;

    this.animTime += dt;

    if (this.phase === 'pop') {
      const t = THREE.MathUtils.clamp(this.animTime / this.popDuration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.applyPose(eased * this.maxPop, 0);
      if (t >= 1) {
        this.phase = 'swing';
        this.animTime = 0;
      }
      return;
    }

    const t = THREE.MathUtils.clamp(this.animTime / this.swingDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 2.4);
    this.applyPose(this.maxPop, eased * this.maxSwing);
    if (t >= 1) {
      this.phase = 'open';
      this.onComplete?.();
      this.onComplete = null;
    }
  }

  private applyPose(pop: number, swing: number): void {
    this.swingGroup.position.set(this.size.x / 2, -this.size.y / 2, pop);
    this.swingGroup.rotation.set(swing, 0, 0);
  }
}
