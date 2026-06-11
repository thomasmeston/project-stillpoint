import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = '/models/characters/man-in-suit.glb';
const WALK_CLIP = 'HumanArmature|Man_Walk';
const IDLE_CLIP = 'HumanArmature|Man_Idle';
const TARGET_HEIGHT = 1.7;

export class PlayerMover {
  readonly root = new THREE.Group();
  private target: THREE.Vector3 | null = null;
  private speed = 4;
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private moving = false;

  constructor() {
    this.root.position.set(0, 0, 2);
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const height = box.getSize(new THREE.Vector3()).y || 1;
      model.scale.setScalar(TARGET_HEIGHT / height);

      box.setFromObject(model);
      model.position.y -= box.min.y;

      this.root.add(model);

      this.mixer = new THREE.AnimationMixer(model);
      const walkClip = gltf.animations.find((clip) => clip.name === WALK_CLIP);
      const idleClip = gltf.animations.find((clip) => clip.name === IDLE_CLIP);

      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.play();
      }
      if (walkClip) {
        this.walkAction = this.mixer.clipAction(walkClip);
      }
    });
  }

  private setMoving(moving: boolean): void {
    if (this.moving === moving) return;
    this.moving = moving;
    if (!this.walkAction || !this.idleAction) return;

    const fade = 0.2;
    if (moving) {
      this.idleAction.fadeOut(fade);
      this.walkAction.reset().fadeIn(fade).play();
    } else {
      this.walkAction.fadeOut(fade);
      this.idleAction.reset().fadeIn(fade).play();
    }
  }

  moveTo(point: THREE.Vector3): void {
    this.target = point.clone();
    this.target.y = this.root.position.y;
  }

  update(dt: number): void {
    this.mixer?.update(dt);

    if (!this.target) {
      this.setMoving(false);
      return;
    }

    const dir = this.target.clone().sub(this.root.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.15) {
      this.target = null;
      this.setMoving(false);
      return;
    }

    this.setMoving(true);
    dir.normalize();
    const step = Math.min(dist, this.speed * dt);
    this.root.position.addScaledVector(dir, step);
    if (dir.lengthSq() > 0.001) {
      this.root.lookAt(
        this.root.position.x + dir.x,
        this.root.position.y,
        this.root.position.z + dir.z,
      );
    }
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }
}
