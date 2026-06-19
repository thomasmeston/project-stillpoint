import * as THREE from 'three';
import { isWallRaised, type WallFace, VIEW_FACING } from './WallFace';

const DAMP = 10;

type WallEntry = {
  object: THREE.Object3D;
  face: WallFace;
  restX: number;
  restY: number;
  restZ: number;
  restRot: THREE.Euler;
  dropT: number;
  targetDropT: number;
  isHotspot: boolean;
};

export class ViewWallController {
  private entries: WallEntry[] = [];
  private viewIndex = 0;
  private inMenu = false;

  readonly events = {
    onViewChanged: null as ((index: number, facing: WallFace) => void) | null,
  };

  getViewIndex(): number {
    return this.viewIndex;
  }

  getFacingWall(): WallFace {
    return VIEW_FACING[this.viewIndex];
  }

  setInMenu(inMenu: boolean): void {
    this.inMenu = inMenu;
    for (const entry of this.entries) {
      entry.targetDropT = inMenu ? 0 : (isWallRaised(entry.face, this.viewIndex) ? 0 : 1);
    }
  }

  register(object: THREE.Object3D, face: WallFace, isHotspot = false): void {
    const targetDropT = this.inMenu ? 0 : (isWallRaised(face, this.viewIndex) ? 0 : 1);
    this.entries.push({
      object,
      face,
      restX: object.position.x,
      restY: object.position.y,
      restZ: object.position.z,
      restRot: object.rotation.clone(),
      dropT: targetDropT,
      targetDropT,
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
      entry.targetDropT = this.inMenu ? 0 : (isWallRaised(entry.face, this.viewIndex) ? 0 : 1);
    }
    this.events.onViewChanged?.(this.viewIndex, VIEW_FACING[this.viewIndex]);
  }

  isObjectInteractable(object: THREE.Object3D): boolean {
    if (object.userData.puzzleHidden) return false;
    let current: THREE.Object3D | null = object;
    while (current) {
      const entry = this.entries.find((e) => e.object === current);
      if (entry) {
        return entry.dropT < 0.85;
      }
      current = current.parent;
    }
    return true;
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
    const theta = entry.dropT * (Math.PI / 2);

    // Reset rotation and position to baseline
    entry.object.rotation.copy(entry.restRot);
    entry.object.position.set(entry.restX, entry.restY, entry.restZ);

    if (entry.face === 'north') {
      const dy = entry.restY;
      const dz = entry.restZ + 3.0; // Pivot Z = -3.0
      entry.object.position.y = dy * Math.cos(theta) + dz * Math.sin(theta);
      entry.object.position.z = -3.0 + dz * Math.cos(theta) - dy * Math.sin(theta);
      entry.object.rotation.x = entry.restRot.x - theta;
    } else if (entry.face === 'south') {
      const dy = entry.restY;
      const dz = entry.restZ - 3.0; // Pivot Z = 3.0
      entry.object.position.y = dy * Math.cos(theta) - dz * Math.sin(theta);
      entry.object.position.z = 3.0 + dz * Math.cos(theta) + dy * Math.sin(theta);
      entry.object.rotation.x = entry.restRot.x + theta;
    } else if (entry.face === 'east') {
      const dy = entry.restY;
      const dx = entry.restX - 3.5; // Pivot X = 3.5
      entry.object.position.y = dy * Math.cos(theta) - dx * Math.sin(theta);
      entry.object.position.x = 3.5 + dx * Math.cos(theta) + dy * Math.sin(theta);
      entry.object.rotation.z = entry.restRot.z - theta;
    } else if (entry.face === 'west') {
      const dy = entry.restY;
      const dx = entry.restX + 3.5; // Pivot X = -3.5
      entry.object.position.y = dy * Math.cos(theta) + dx * Math.sin(theta);
      entry.object.position.x = -3.5 + dx * Math.cos(theta) - dy * Math.sin(theta);
      entry.object.rotation.z = entry.restRot.z + theta;
    }

    if (entry.isHotspot) {
      const hidden = entry.object.userData.puzzleHidden === true;
      entry.object.visible = !hidden && entry.dropT < 0.92;
    } else {
      entry.object.traverse((child) => {
        if (child.userData.isHotspot) {
          const hidden = child.userData.puzzleHidden === true;
          child.visible = !hidden && entry.dropT < 0.92;
        }
      });
    }
  }
}
