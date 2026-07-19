import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { publicUrl } from '../utils/publicUrl';

const MODEL_URL = publicUrl('models/characters/man-papercraft.glb');
const TARGET_HEIGHT = 1.7;

const ARRIVAL_EPSILON = 0.08;

export class PlayerMover {
  readonly root = new THREE.Group();
  private target: THREE.Vector3 | null = null;
  private pathQueue: THREE.Vector3[] = [];
  private speed = 4;
  private moving = false;
  /** Height above the room float/base floor (0 = main deck). */
  deckHeight = 0;

  // Reference to the loaded model group and its rest Y position
  private characterModel: THREE.Object3D | null = null;
  private baseModelY = 0;

  // Animation Mixer and skeletal Actions
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;

  // Animation state tracking
  private time = 0;
  private walkWeight = 0;
  private onArrival: (() => void) | null = null;

  constructor() {
    this.root.position.set(-1.35, 0, 1.05);
    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      this.characterModel = model;
      
      // Ensure shadows are cast and received, and convert unlit materials to MeshStandardMaterial to respond to light
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const newMaterials = materials.map((mat) => {
              // Extract the texture map and color from the original material
              const origMat = mat as any;
              return new THREE.MeshStandardMaterial({
                color: origMat.color || new THREE.Color(0xffffff),
                map: origMat.map || null,
                roughness: 0.9,
                metalness: 0.1,
                flatShading: true
              });
            });

            mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
          }
        }
      });

      // Scale model to target height and set origin to bottom of bounding box
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const height = size.y || 1.0;
      model.scale.setScalar(TARGET_HEIGHT / height);

      // Recompute bounds after scale and offset Y so feet touch floor (Y = 0)
      box.setFromObject(model);
      model.position.y -= box.min.y;
      this.baseModelY = model.position.y;

      // Initialize the AnimationMixer and bind the walking animation clip
      this.mixer = new THREE.AnimationMixer(model);
      const walkClip = gltf.animations[0]; // The walking animation clip in the GLB
      if (walkClip) {
        this.walkAction = this.mixer.clipAction(walkClip);
        if (this.moving) {
          this.walkAction.play();
        }
      }

      this.root.add(model);
    });
  }

  private setMoving(moving: boolean): void {
    if (this.moving === moving) return;
    this.moving = moving;

    if (this.walkAction) {
      const fade = 0.25;
      if (moving) {
        this.walkAction.reset().fadeIn(fade).play();
      } else {
        this.walkAction.fadeOut(fade);
      }
    }
  }

  moveTo(point: THREE.Vector3, onArrived?: () => void): void {
    this.pathQueue = [];
    this.target = point.clone();
    // point.y is treated as logical deck height when multi-deck is in use.
    this.onArrival = onArrived || null;

    const dir = this.target.clone().sub(this.root.position);
    dir.y = 0;
    const heightDelta = Math.abs(this.target.y - this.deckHeight);
    if (dir.length() < ARRIVAL_EPSILON && heightDelta < 0.08) {
      this.deckHeight = this.target.y;
      this.target = null;
      this.setMoving(false);
      this.onArrival = null;
      onArrived?.();
    }
  }

  /** Follow waypoints where each point.y is logical deck height. */
  moveAlongPath(points: THREE.Vector3[], onArrived?: () => void): void {
    if (points.length === 0) {
      onArrived?.();
      return;
    }
    this.pathQueue = points.map((p) => p.clone());
    this.onArrival = onArrived || null;
    this.target = this.pathQueue.shift() ?? null;
    if (!this.target) {
      this.setMoving(false);
      this.onArrival = null;
      onArrived?.();
    }
  }

  update(
    dt: number,
    obstacles?: THREE.Box3[],
    shellSize?: THREE.Vector2,
    walkBounds?: { minX: number; maxX: number; minZ: number; maxZ: number } | null,
  ): void {
    const clampedDt = Math.min(dt, 0.1);
    this.time += clampedDt;

    // Smoothly transition walk weight (0 = idle, 1 = walk) for secondary animations
    const targetWeight = this.moving ? 1.0 : 0.0;
    this.walkWeight += (targetWeight - this.walkWeight) * 10 * clampedDt;
    this.walkWeight = THREE.MathUtils.clamp(this.walkWeight, 0, 1);
    const idleWeight = 1.0 - this.walkWeight;

    // Update skeletal animation mixer
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Apply a subtle secondary procedural bobbing for breathing when idle
    if (this.characterModel) {
      const model = this.characterModel;
      const walkBob = Math.abs(Math.sin(this.time * 12)) * 0.015 * this.walkWeight;
      const idleBob = Math.sin(this.time * 2.5) * 0.008 * idleWeight;
      model.position.y = this.baseModelY + walkBob + idleBob;
    }

    // Movement positioning logic
    if (!this.target) {
      this.setMoving(false);
      return;
    }

    const climbing = Math.abs(this.target.y - this.deckHeight) > 0.05;
    const dir = this.target.clone().sub(this.root.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < ARRIVAL_EPSILON && !climbing) {
      this.deckHeight = this.target.y;
      this.advancePathOrFinish();
      return;
    }

    this.setMoving(true);
    if (dist > 0.0001) dir.normalize();

    const moveSpeed = climbing ? this.speed * 0.42 : this.speed;
    const step = Math.min(dist, moveSpeed * dt);

    // Save starting position to detect block state
    const startPos = this.root.position.clone();

    // Propose step position (XZ only)
    const proposedPos = this.root.position.clone();
    if (dist > 0.0001) {
      proposedPos.addScaledVector(dir, step);
    }

    // Resolve collision if room data is available
    if (obstacles && shellSize) {
      const resolvedPos = this.resolveCollisions(proposedPos, obstacles, shellSize, walkBounds);
      this.root.position.x = resolvedPos.x;
      this.root.position.z = resolvedPos.z;

      // Blocked check: if we barely moved, cancel target unless close enough to finish
      const actualMove = Math.hypot(
        this.root.position.x - startPos.x,
        this.root.position.z - startPos.z,
      );
      if (!climbing && step > 0.001 && actualMove < 0.01) {
        const remaining = this.target
          ? Math.hypot(
              this.root.position.x - this.target.x,
              this.root.position.z - this.target.z,
            )
          : Infinity;
        const cb = this.onArrival;
        this.target = null;
        this.pathQueue = [];
        this.setMoving(false);
        this.onArrival = null;
        if (cb && remaining < 1.0) {
          cb();
        }
        return;
      }
    } else {
      this.root.position.x = proposedPos.x;
      this.root.position.z = proposedPos.z;
    }

    if (climbing) {
      const climbSpeed = 1.6;
      const dy = this.target.y - this.deckHeight;
      const stepY = Math.sign(dy) * Math.min(Math.abs(dy), climbSpeed * dt);
      this.deckHeight += stepY;
      if (Math.abs(this.target.y - this.deckHeight) < 0.04 && dist < ARRIVAL_EPSILON) {
        this.deckHeight = this.target.y;
        this.advancePathOrFinish();
        return;
      }
    }

    // Orient character model to actual moving direction or target direction
    const actualDir = this.root.position.clone().sub(startPos);
    actualDir.y = 0;
    if (actualDir.lengthSq() > 0.001) {
      actualDir.normalize();
      this.root.lookAt(
        this.root.position.x + actualDir.x,
        this.root.position.y,
        this.root.position.z + actualDir.z,
      );
    } else if (dir.lengthSq() > 0.001) {
      this.root.lookAt(
        this.root.position.x + dir.x,
        this.root.position.y,
        this.root.position.z + dir.z,
      );
    }
  }

  private advancePathOrFinish(): void {
    if (this.pathQueue.length > 0) {
      this.target = this.pathQueue.shift() ?? null;
      return;
    }
    this.target = null;
    this.setMoving(false);
    if (this.onArrival) {
      const cb = this.onArrival;
      this.onArrival = null;
      cb();
    }
  }

  private resolveCollisions(
    pos: THREE.Vector3,
    obstacles: THREE.Box3[],
    shellSize: THREE.Vector2,
    walkBounds?: { minX: number; maxX: number; minZ: number; maxZ: number } | null,
  ): THREE.Vector3 {
    const resolved = pos.clone();
    const radius = 0.25;
    const wallThickness = 0.15;

    if (walkBounds) {
      resolved.x = THREE.MathUtils.clamp(resolved.x, walkBounds.minX + radius, walkBounds.maxX - radius);
      resolved.z = THREE.MathUtils.clamp(resolved.z, walkBounds.minZ + radius, walkBounds.maxZ - radius);
    } else {
      // Clamp to wall boundaries
      const halfX = shellSize.x / 2 - wallThickness / 2 - radius;
      const halfZ = shellSize.y / 2 - wallThickness / 2 - radius;
      resolved.x = THREE.MathUtils.clamp(resolved.x, -halfX, halfX);
      resolved.z = THREE.MathUtils.clamp(resolved.z, -halfZ, halfZ);
    }

    // Resolve obstacles with circle-to-AABB sliding
    // Iterate twice to resolve corners
    for (let iter = 0; iter < 2; iter++) {
      for (const box of obstacles) {
        const cx = THREE.MathUtils.clamp(resolved.x, box.min.x, box.max.x);
        const cz = THREE.MathUtils.clamp(resolved.z, box.min.z, box.max.z);

        const dx = resolved.x - cx;
        const dz = resolved.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.001) {
            const overlap = radius - dist;
            resolved.x += (dx / dist) * overlap;
            resolved.z += (dz / dist) * overlap;
          } else {
            // Circle center inside box - push out along shallowest axis
            const distLeft = resolved.x - box.min.x;
            const distRight = box.max.x - resolved.x;
            const distTop = resolved.z - box.min.z;
            const distBottom = box.max.z - resolved.z;
            const minDist = Math.min(distLeft, distRight, distTop, distBottom);

            if (minDist === distLeft) resolved.x = box.min.x - radius;
            else if (minDist === distRight) resolved.x = box.max.x + radius;
            else if (minDist === distTop) resolved.z = box.min.z - radius;
            else resolved.z = box.max.z + radius;
          }
        }
      }
    }

    return resolved;
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  getFacingYaw(): number {
    return this.root.rotation.y;
  }

  getHeadWorldPosition(): THREE.Vector3 {
    const head = this.root.getWorldPosition(new THREE.Vector3());
    head.y += 1.55;
    return head;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  cancelMovement(): void {
    this.target = null;
    this.pathQueue = [];
    this.onArrival = null;
    this.setMoving(false);
  }

  setPosition(pos: { x: number; y: number; z: number }): void {
    this.root.position.set(pos.x, pos.y, pos.z);
    this.deckHeight = pos.y;
    this.target = null;
    this.pathQueue = [];
    this.setMoving(false);
  }
}
