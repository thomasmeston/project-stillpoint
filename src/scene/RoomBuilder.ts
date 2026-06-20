import * as THREE from 'three';
import roomData from '../../data/rooms/bedroom.json';
import { Hotspot, type HotspotData } from './Hotspot';
import { inferWallFace, type WallFace } from './WallFace';
import type { ViewWallController } from './ViewWallController';
import { publicUrl } from '../utils/publicUrl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WallNotesCluster } from './WallNotesCluster';
import { PaintingRevealController } from './PaintingRevealController';
import { buildDeskMug } from './DeskMugProp';
import { buildBedsideLamp } from './BedsideLampProp';


type RoomFile = {
  palette: Record<string, string>;
  shell: {
    size: { x: number; z: number };
    wall_height: number;
    floor_color: string;
    wall_color: string;
  };
  props: Array<{
    id: string;
    mesh?: string;
    color: string;
    size: [number, number, number];
    position: [number, number, number];
    rotation?: [number, number, number];
    wall?: WallFace;
  }>;
  hotspots: Array<HotspotData & { wall?: WallFace }>;
  lighting?: Record<string, { position: number[]; color: string; energy: number }>;
  spawn?: { player: [number, number, number] };
};

const FLOOR_ONLY_PROPS = new Set([
  'Rug',
  'BedFrame',
  'Mattress',
  'Pillow',
  'Desk',
  'DeskTop',
  'Chair',
  'Nightstand',
  'LampBase',
  'LampShade',
  'Sketchbook',
  'CrowFigurine'
]);

const FLOOR_ONLY_HOTSPOTS = new Set([
  'bed',
  'calendar_scrap',
  'desk',
  'desk_drawer',
  'sketchbook',
  'nightstand',
  'key_handle',
  'combine_station',
  'chair'
]);

export class RoomBuilder {
  readonly root = new THREE.Group();
  readonly propsRoot = new THREE.Group();
  readonly hotspotsRoot = new THREE.Group();
  readonly hotspots: Hotspot[] = [];
  readonly floorMeshes: THREE.Object3D[] = [];
  readonly obstacles: THREE.Box3[] = [];
  readonly shellSize = new THREE.Vector2();
  readonly playerSpawn = new THREE.Vector3();
  readonly propsData: RoomFile['props'] = [];
  readonly hotspotsData: RoomFile['hotspots'] = [];
  readonly lightingData: RoomFile['lighting'] = {};
  readonly wallMeshes = new Map<WallFace, THREE.Mesh>();
  readonly lights = new Map<string, THREE.PointLight>();
  readonly paintingReveal: PaintingRevealController;
  readonly wallNotesCluster: WallNotesCluster;
  wallSafeMesh: THREE.Object3D | null = null;
  phoneInSafeMesh: THREE.Object3D | null = null;

  private palette: Record<string, string>;

  constructor(private wallCtrl: ViewWallController) {
    const data = roomData as unknown as RoomFile;
    this.palette = data.palette;
    this.shellSize.set(data.shell.size.x, data.shell.size.z);
    const spawn = data.spawn?.player ?? [0, 0, 2];
    this.playerSpawn.set(spawn[0], spawn[1], spawn[2]);
    this.root.add(this.propsRoot);
    this.root.add(this.hotspotsRoot);
    this.paintingReveal = new PaintingRevealController(
      new THREE.Vector3(0.9, 0.7, 0.05),
      this.color('wood_dark'),
    );
    this.wallNotesCluster = new WallNotesCluster();
    this.buildShell(data.shell);

    // Load custom layout from localStorage if it exists
    this.propsData = data.props;
    this.hotspotsData = data.hotspots;
    this.lightingData = data.lighting ?? {};
    const savedLayout = localStorage.getItem('dev_room_layout_bedroom');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        if (Array.isArray(parsed.props)) {
          this.propsData = data.props.map((original) => {
            const saved = parsed.props.find((p: any) => p.id === original.id);
            if (saved) {
              return {
                ...original,
                position: saved.position,
                rotation: saved.rotation ?? original.rotation
              };
            }
            return original;
          });
        }
        if (Array.isArray(parsed.hotspots)) {
          this.hotspotsData = data.hotspots.map((original) => {
            const saved = parsed.hotspots.find((h: any) => h.id === original.id);
            if (saved) {
              return {
                ...original,
                position: saved.position
              };
            }
            return original;
          });
        }
        if (parsed.lighting) {
          this.lightingData = { ...this.lightingData };
          for (const key of Object.keys(parsed.lighting)) {
            if (this.lightingData[key]) {
              this.lightingData[key].position = [...parsed.lighting[key].position];
            }
          }
        }
      } catch (e) {
        console.error('Failed to load custom dev layout', e);
      }
    }

    this.buildProps(this.propsData);
    this.buildHotspots(this.hotspotsData);
    this.buildLighting(this.lightingData);

    const northWall = this.wallMeshes.get('north');
    if (northWall) {
      this.wallNotesCluster.attachToWall(northWall);
    }

    // Register walls with wallCtrl AFTER everything is parented and in rest position!
    for (const [face, wall] of this.wallMeshes) {
      this.wallCtrl.register(wall, face);
    }
  }

  private color(value: string): THREE.Color {
    const hex = this.palette[value] ?? value;
    return new THREE.Color(hex);
  }

  private makeBox(
    size: THREE.Vector3,
    color: THREE.Color,
    collision = false,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    if (collision) {
      mesh.userData.isFloor = true;
      mesh.layers.set(0);
      this.floorMeshes.push(mesh);
    }
    return mesh;
  }

  private buildShell(shell: RoomFile['shell']): void {
    const centerZ = 0;
    const floor = this.makeBox(
      new THREE.Vector3(shell.size.x, 0.1, shell.size.z),
      this.color(shell.floor_color),
      true,
    );
    floor.position.set(0, -0.05, centerZ);
    this.root.add(floor);

    const wallH = shell.wall_height;
    const halfX = shell.size.x / 2;
    const halfZ = shell.size.z / 2;

    const walls: Array<{ id: string; face: WallFace; pos: [number, number, number]; size: [number, number, number] }> = [
      { id: 'wall_north', face: 'north', pos: [0, wallH / 2, centerZ - halfZ], size: [shell.size.x, wallH, 0.15] },
      { id: 'wall_south', face: 'south', pos: [0, wallH / 2, centerZ + halfZ], size: [shell.size.x, wallH, 0.15] },
      { id: 'wall_west', face: 'west', pos: [-halfX, wallH / 2, centerZ], size: [0.15, wallH, shell.size.z] },
      { id: 'wall_east', face: 'east', pos: [halfX, wallH / 2, centerZ], size: [0.15, wallH, shell.size.z] },
    ];

    for (const w of walls) {
      const wall = this.makeBox(
        new THREE.Vector3(w.size[0], w.size[1], w.size[2]),
        this.color(shell.wall_color),
      );
      wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wall.name = w.id;
      wall.userData.wallFace = w.face;
      this.root.add(wall);
      this.wallMeshes.set(w.face, wall);
    }
  }

  private buildProps(props: RoomFile['props']): void {
    const loader = new GLTFLoader();

    for (const prop of props) {
      if (prop.id === 'Painting') {
        const group = this.paintingReveal.group;
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        const face = prop.wall ?? inferWallFace(prop.position[0], prop.position[2]);
        group.userData.wallFace = face;
        if (face !== 'floor') {
          const wallMesh = this.wallMeshes.get(face);
          if (wallMesh) {
            group.position.sub(wallMesh.position);
            wallMesh.add(group);
          } else {
            this.propsRoot.add(group);
          }
        } else {
          this.propsRoot.add(group);
        }
        continue;
      }

      if (prop.id === 'DeskMug') {
        const group = buildDeskMug();
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        this.propsRoot.add(group);
        continue;
      }

      if (prop.id === 'BedsideLamp') {
        const group = buildBedsideLamp();
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        this.propsRoot.add(group);
        continue;
      }

      if (prop.mesh && (prop.mesh.endsWith('.glb') || prop.mesh.endsWith('.gltf'))) {
        loader.load(publicUrl(prop.mesh), (gltf) => {
          const model = gltf.scene;
          model.name = `${prop.id}_model`;

          // Enable shadow casting and standard material configurations
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              const meshChild = child as THREE.Mesh;
              if (meshChild.material) {
                const origMat = meshChild.material as any;
                meshChild.material = new THREE.MeshStandardMaterial({
                  color: origMat.color || new THREE.Color(0xffffff),
                  map: origMat.map || null,
                  roughness: 0.85,
                  metalness: 0.1
                });
              }
            }
          });

          // Scale model to target bounds size
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);

          const targetSize = new THREE.Vector3(prop.size[0], prop.size[1], prop.size[2]);
          const scaleX = targetSize.x / (size.x || 1.0);
          const scaleY = targetSize.y / (size.y || 1.0);
          const scaleZ = targetSize.z / (size.z || 1.0);
          const scale = Math.min(scaleX, scaleY, scaleZ);
          model.scale.setScalar(scale);

          // Get new bounds to offset pivot to bottom-center
          const newBox = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          newBox.getCenter(center);

          // Align local origin to bottom-center of the mesh
          model.position.set(-center.x, -newBox.min.y, -center.z);

          // Create parent group for transformation matching the prop
          const group = new THREE.Group();
          group.name = prop.id;
          group.position.set(prop.position[0], prop.position[1], prop.position[2]);
          if (prop.rotation) {
            group.rotation.set(
              THREE.MathUtils.degToRad(prop.rotation[0]),
              THREE.MathUtils.degToRad(prop.rotation[1]),
              THREE.MathUtils.degToRad(prop.rotation[2])
            );
          }
          group.add(model);

          const face = prop.wall ?? (FLOOR_ONLY_PROPS.has(prop.id) ? 'floor' : inferWallFace(prop.position[0], prop.position[2]));
          group.userData.wallFace = face;

          if (face !== 'floor') {
            const wallMesh = this.wallMeshes.get(face);
            if (wallMesh) {
              group.position.sub(wallMesh.position);
              wallMesh.add(group);
            } else {
              this.propsRoot.add(group);
            }
          } else {
            this.propsRoot.add(group);
          }
        });
      } else {
        // Fallback to procedural shape generation
        let mesh: THREE.Mesh;
        const color = this.color(prop.color);
        const size = new THREE.Vector3(prop.size[0], prop.size[1], prop.size[2]);
        if (prop.mesh === 'cylinder') {
          mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(size.x / 2, size.x / 2, size.y, 12),
            new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
          );
        } else if (prop.mesh === 'sphere') {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(size.x / 2, 12, 12),
            new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
          );
        } else {
          mesh = this.makeBox(size, color);
        }

        if (prop.id === 'WindowGlass') {
          const loaderTexture = new THREE.TextureLoader();
          const texture = loaderTexture.load(publicUrl('images/beach.png'));
          mesh.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.1,
            metalness: 0.1
          });
        }

        if (prop.id === 'WallSafe') {
          mesh.visible = false;
          this.wallSafeMesh = mesh;
        }

        if (prop.id === 'Phone') {
          mesh.visible = false;
          this.phoneInSafeMesh = mesh;
        }

        mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          mesh.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        mesh.name = prop.id;
        const face = prop.wall ?? (FLOOR_ONLY_PROPS.has(prop.id) ? 'floor' : inferWallFace(prop.position[0], prop.position[2]));
        mesh.userData.wallFace = face;
        if (face !== 'floor') {
          const wallMesh = this.wallMeshes.get(face);
          if (wallMesh) {
            mesh.position.sub(wallMesh.position);
            wallMesh.add(mesh);
          } else {
            this.propsRoot.add(mesh);
          }
        } else {
          this.propsRoot.add(mesh);
        }
      }

      // Add obstacles for player collisions
      if (['BedFrame', 'Desk', 'Chair', 'Bookshelf', 'Nightstand', 'Wardrobe'].includes(prop.id)) {
        const min = new THREE.Vector3(
          prop.position[0] - prop.size[0] / 2,
          prop.position[1] - prop.size[1] / 2,
          prop.position[2] - prop.size[2] / 2
        );
        const max = new THREE.Vector3(
          prop.position[0] + prop.size[0] / 2,
          prop.position[1] + prop.size[1] / 2,
          prop.position[2] + prop.size[2] / 2
        );
        this.obstacles.push(new THREE.Box3(min, max));
      }
    }
  }

  private buildHotspots(hotspots: RoomFile['hotspots']): void {
    for (const hs of hotspots) {
      const hotspot = new Hotspot(hs);
      const face = hs.wall ?? (FLOOR_ONLY_HOTSPOTS.has(hs.id) ? 'floor' : inferWallFace(hs.position[0], hs.position[2]));
      hotspot.mesh.userData.wallFace = face;
      hotspot.mesh.userData.isHotspot = true;
      this.hotspots.push(hotspot);
      if (face !== 'floor') {
        const wallMesh = this.wallMeshes.get(face);
        if (wallMesh) {
          hotspot.mesh.position.sub(wallMesh.position);
          wallMesh.add(hotspot.mesh);
        } else {
          this.hotspotsRoot.add(hotspot.mesh);
        }
      } else {
        this.hotspotsRoot.add(hotspot.mesh);
      }
    }
  }

  private buildLighting(lighting: RoomFile['lighting']): void {
    const ambient = new THREE.AmbientLight(0x404860, 0.55);
    this.root.add(ambient);

    const LIGHT_PARENTS: Record<string, string> = {
      lamp: 'LampBase',
      window: 'WindowFrame'
    };

    for (const [key, spec] of Object.entries(lighting ?? {})) {
      const light = new THREE.PointLight(
        new THREE.Color(spec.color),
        spec.energy,
        6,
      );
      light.name = `light_${key}`;

      const parentId = LIGHT_PARENTS[key];
      let parentMesh: THREE.Object3D | undefined;
      if (parentId) {
        parentMesh = this.propsRoot.getObjectByName(parentId) || this.root.getObjectByName(parentId);
      }

      if (parentMesh) {
        parentMesh.updateMatrixWorld(true);
        const parentWorldPos = new THREE.Vector3();
        parentMesh.getWorldPosition(parentWorldPos);

        const localPos = new THREE.Vector3(
          spec.position[0] - parentWorldPos.x,
          spec.position[1] - parentWorldPos.y,
          spec.position[2] - parentWorldPos.z
        );

        light.position.copy(localPos);
        parentMesh.add(light);

        light.userData.parentPropId = parentId;
        light.userData.localOffset = localPos.clone();
      } else {
        light.position.set(spec.position[0], spec.position[1], spec.position[2]);
        this.root.add(light);
      }

      this.lights.set(key, light);
    }
  }

  setHotspotVisible(id: string, visible: boolean): void {
    const hs = this.hotspots.find((h) => h.id === id);
    if (hs) {
      hs.mesh.userData.puzzleHidden = !visible;
      if (!visible) hs.mesh.visible = false;
    }
  }

  rebuildObstacles(): void {
    this.obstacles.length = 0;
    for (const prop of this.propsData) {
      if (['BedFrame', 'Desk', 'Chair', 'Bookshelf', 'Nightstand', 'Wardrobe'].includes(prop.id)) {
        const min = new THREE.Vector3(
          prop.position[0] - prop.size[0] / 2,
          prop.position[1] - prop.size[1] / 2,
          prop.position[2] - prop.size[2] / 2
        );
        const max = new THREE.Vector3(
          prop.position[0] + prop.size[0] / 2,
          prop.position[1] + prop.size[1] / 2,
          prop.position[2] + prop.size[2] / 2
        );
        this.obstacles.push(new THREE.Box3(min, max));
      }
    }
  }

  revealWallSafe(): void {
    if (this.wallSafeMesh) this.wallSafeMesh.visible = true;
  }

  syncSafeContents(paintingMoved: boolean, safeUnlocked: boolean, phoneTaken: boolean): void {
    if (this.wallSafeMesh) this.wallSafeMesh.visible = paintingMoved;
    if (this.phoneInSafeMesh) {
      this.phoneInSafeMesh.visible = paintingMoved && safeUnlocked && !phoneTaken;
    }
  }

  syncPaintingReveal(moved: boolean, safeUnlocked = false, phoneTaken = false): void {
    if (moved) {
      this.paintingReveal.setOpenImmediate();
    } else {
      this.paintingReveal.resetClosed();
    }
    this.syncSafeContents(moved, safeUnlocked, phoneTaken);
  }
}
