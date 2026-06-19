import * as THREE from 'three';
import { VIEW_FACING, type WallFace } from './WallFace';

const ISO_PITCH = THREE.MathUtils.degToRad(-35);
const ROTATE_DAMP = 9;

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
    this.camera.position.set(0, 0, 20); // Offset along local Z axis
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
    this.targetYaw -= Math.PI / 2;
    this.rotating = true;
  }

  rotateRight(): void {
    if (this.rotating) return;
    this.viewIndex = (this.viewIndex + 1) % 4;
    this.targetYaw += Math.PI / 2;
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
    this.size = THREE.MathUtils.clamp(this.size + deltaY * 0.01, 4, 15);
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

  menuRotate(dt: number): void {
    this.targetYaw += 0.06 * dt;
    this.currentYaw = this.targetYaw;
    this.applyRigPose(this.currentPos, this.currentYaw);
  }

  focusOn(_target: THREE.Vector3): void {
    // Fixed orbit views.
  }

  private snapToView(index: number): void {
    const facing = VIEW_FACING[index];
    const yaws: Record<Exclude<WallFace, 'floor'>, number> = {
      north: THREE.MathUtils.degToRad(45),
      east: THREE.MathUtils.degToRad(135),
      south: THREE.MathUtils.degToRad(225),
      west: THREE.MathUtils.degToRad(315),
    };
    this.targetPos.set(0, 0.9, 0.0); // Center of the room
    this.targetYaw = yaws[facing as Exclude<WallFace, 'floor'>];
  }


  private applyRigPose(pos: THREE.Vector3, yaw: number): void {
    this.rig.position.copy(pos);
    this.rig.rotation.y = yaw;
    this.rig.rotation.x = ISO_PITCH;
  }
}
