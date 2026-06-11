import * as THREE from 'three';
import { VIEW_FACING, type WallFace } from './WallFace';

const ISO_PITCH = THREE.MathUtils.degToRad(-35);
const ROTATE_DAMP = 9;

type ViewPose = {
  position: THREE.Vector3;
  yaw: number;
};

/** Pre-tuned isometric orbit poses per facing wall. */
const VIEW_POSES: Record<Exclude<WallFace, 'floor'>, ViewPose> = {
  north: { position: new THREE.Vector3(0, 6.2, 6.5), yaw: THREE.MathUtils.degToRad(45) },
  east: { position: new THREE.Vector3(6.5, 6.2, 1), yaw: THREE.MathUtils.degToRad(135) },
  south: { position: new THREE.Vector3(0, 6.2, -4.5), yaw: THREE.MathUtils.degToRad(225) },
  west: { position: new THREE.Vector3(-6.5, 6.2, 1), yaw: THREE.MathUtils.degToRad(315) },
};

export class IsoCamera {
  readonly camera: THREE.OrthographicCamera;
  readonly rig: THREE.Object3D;

  private viewIndex = 0;
  private currentPos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private currentYaw = 0;
  private targetYaw = 0;
  private size = 10;
  private rotating = false;

  constructor(aspect: number) {
    this.rig = new THREE.Object3D();
    this.rig.rotation.order = 'YXZ';
    this.camera = new THREE.OrthographicCamera(
      (-this.size * aspect) / 2,
      (this.size * aspect) / 2,
      this.size / 2,
      -this.size / 2,
      0.1,
      100,
    );
    this.rig.add(this.camera);
    this.snapToView(0);
    this.currentPos.copy(this.targetPos);
    this.currentYaw = this.targetYaw;
    this.applyRigPose(this.currentPos, this.currentYaw);
  }

  getViewIndex(): number {
    return this.viewIndex;
  }

  isRotating(): boolean {
    return this.rotating;
  }

  rotateLeft(): void {
    if (this.rotating) return;
    this.viewIndex = (this.viewIndex + 3) % 4;
    this.updateTarget();
    this.rotating = true;
  }

  rotateRight(): void {
    if (this.rotating) return;
    this.viewIndex = (this.viewIndex + 1) % 4;
    this.updateTarget();
    this.rotating = true;
  }

  setViewIndex(index: number): void {
    this.viewIndex = index % 4;
    this.snapToView(this.viewIndex);
    this.currentPos.copy(this.targetPos);
    this.currentYaw = this.targetYaw;
    this.applyRigPose(this.currentPos, this.currentYaw);
    this.rotating = false;
  }

  resize(width: number, height: number): void {
    const aspect = width / height;
    this.camera.left = (-this.size * aspect) / 2;
    this.camera.right = (this.size * aspect) / 2;
    this.camera.top = this.size / 2;
    this.camera.bottom = -this.size / 2;
    this.camera.updateProjectionMatrix();
  }

  onWheel(deltaY: number): void {
    this.size = THREE.MathUtils.clamp(this.size + deltaY * 0.01, 8, 14);
    this.resize(window.innerWidth, window.innerHeight);
  }

  update(dt: number): void {
    const posDone = this.currentPos.distanceToSquared(this.targetPos) < 0.002;
    const yawDone = Math.abs(this.currentYaw - this.targetYaw) < 0.002;
    if (!this.rotating && posDone && yawDone) return;

    this.currentPos.lerp(this.targetPos, 1 - Math.exp(-ROTATE_DAMP * dt));
    this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, this.targetYaw, 1 - Math.exp(-ROTATE_DAMP * dt));
    this.applyRigPose(this.currentPos, this.currentYaw);

    if (this.currentPos.distanceToSquared(this.targetPos) < 0.002 && Math.abs(this.currentYaw - this.targetYaw) < 0.002) {
      this.currentPos.copy(this.targetPos);
      this.currentYaw = this.targetYaw;
      this.applyRigPose(this.currentPos, this.currentYaw);
      this.rotating = false;
    }
  }

  focusOn(_target: THREE.Vector3): void {
    // Fixed orbit views — no pan.
  }

  private snapToView(index: number): void {
    const facing = VIEW_FACING[index];
    const pose = VIEW_POSES[facing as Exclude<WallFace, 'floor'>];
    this.targetPos.copy(pose.position);
    this.targetYaw = pose.yaw;
  }

  private updateTarget(): void {
    this.snapToView(this.viewIndex);
  }

  private applyRigPose(pos: THREE.Vector3, yaw: number): void {
    this.rig.position.copy(pos);
    this.rig.rotation.y = yaw;
    this.rig.rotation.x = ISO_PITCH;
  }
}
