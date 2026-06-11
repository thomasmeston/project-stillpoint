import * as THREE from 'three';
import { isWallRaised, type WallFace, VIEW_FACING } from './WallFace';

const DROP_DISTANCE = 3.6;
const DAMP = 10;

type WallEntry = {
  object: THREE.Object3D;
  face: WallFace;
  restY: number;
  dropT: number;
  targetDropT: number;
  isHotspot: boolean;
};

export class ViewWallController {
  private entries: WallEntry[] = [];
  private viewIndex = 0;

  readonly events = {
    onViewChanged: null as ((index: number, facing: WallFace) => void) | null,
  };

  getViewIndex(): number {
    return this.viewIndex;
  }

  getFacingWall(): WallFace {
    return VIEW_FACING[this.viewIndex];
  }

  register(object: THREE.Object3D, face: WallFace, isHotspot = false): void {
    this.entries.push({
      object,
      face,
      restY: object.position.y,
      dropT: isWallRaised(face, this.viewIndex) ? 0 : 1,
      targetDropT: isWallRaised(face, this.viewIndex) ? 0 : 1,
      isHotspot,
    });
    this.applyEntry(this.entries[this.entries.length - 1]);
  }

  rotateLeft(): void {
    this.setViewIndex((this.viewIndex + 3) % 4);
  }

  rotateRight(): void {
    this.setViewIndex((this.viewIndex + 1) % 4);
  }

  setViewIndex(index: number): void {
    if (index === this.viewIndex) return;
    this.viewIndex = index;
    for (const entry of this.entries) {
      entry.targetDropT = isWallRaised(entry.face, this.viewIndex) ? 0 : 1;
    }
    this.events.onViewChanged?.(this.viewIndex, VIEW_FACING[this.viewIndex]);
  }

  isObjectInteractable(object: THREE.Object3D): boolean {
    if (object.userData.puzzleHidden) return false;
    const entry = this.entries.find((e) => e.object === object);
    if (!entry) return true;
    return entry.dropT < 0.85;
  }

  isAnimating(): boolean {
    return this.entries.some((e) => Math.abs(e.dropT - e.targetDropT) > 0.02);
  }

  update(dt: number): void {
    for (const entry of this.entries) {
      entry.dropT = THREE.MathUtils.damp(entry.dropT, entry.targetDropT, DAMP, dt);
      this.applyEntry(entry);
    }
  }

  private applyEntry(entry: WallEntry): void {
    entry.object.position.y = entry.restY - entry.dropT * DROP_DISTANCE;
    if (entry.isHotspot) {
      const hidden = entry.object.userData.puzzleHidden === true;
      entry.object.visible = !hidden && entry.dropT < 0.92;
    }
  }
}
