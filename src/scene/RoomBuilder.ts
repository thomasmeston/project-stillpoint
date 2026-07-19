import * as THREE from 'three';
import roomData from '../../data/rooms/bedroom.json';
import shipRoomData from '../../data/rooms/pirate-ship.json';
import level2RoomData from '../../data/rooms/level_2.json';
import level3RoomData from '../../data/rooms/level_3.json';
import level4RoomData from '../../data/rooms/level_4.json';
import { Hotspot, type HotspotData } from './Hotspot';
import { inferWallFace, type WallFace } from './WallFace';
import type { ViewWallController } from './ViewWallController';
import { publicUrl } from '../utils/publicUrl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WallNotesCluster, WALL_NOTES_CLUSTER_OFFSET_X } from './WallNotesCluster';
import { CorkBoardCluster, CORK_BOARD_CLUSTER_OFFSET } from './CorkBoardCluster';
import { PortalSwirlParticles } from './PortalSwirlParticles';
import { PaintingRevealController } from './PaintingRevealController';
import { NightstandDrawerController } from './NightstandDrawerController';
import { buildDeskMug } from './DeskMugProp';
import { buildBedsideLamp } from './BedsideLampProp';
import { buildVintageTableLamp } from './VintageTableLampProp';
import { buildNightstandReadingLight } from './NightstandReadingLightProp';
import { buildCalendarScrap } from './CalendarScrapProp';
import { buildSketchbook } from './SketchbookProp';
import { buildWindowFrame } from './WindowFrameProp';
import { buildWallOutlet } from './WallOutletProp';
import { loadTypewriter, loadWastebin } from './WastebinProp';
import { loadModernBookshelf } from './ModernBookshelfProp';
import { buildCorkBoardClutterPile, buildRedYarnBall } from './CorkBoardFloorClutter';
import {
  buildOceanPlane,
  loadSailShip,
  ShipFloatMotion,
  updateOceanDrift,
} from './PirateShipWorld';
import {
  DEFAULT_CAMERA_SHOTS,
  mergeCameraShots,
  type CameraShotDef,
} from './CameraShots';


export type PortalDef = {
  id: string;
  target: string;
  position: [number, number, number];
  wall?: WallFace;
  radius?: number;
};

type RoomFile = {
  palette: Record<string, string>;
  shell: {
    size: { x: number; z: number };
    wall_height: number;
    floor_color: string;
    wall_color: string;
  };
  /** Editable walkable floor plane (defaults from shell / ship deck). */
  floor?: {
    position: [number, number, number];
    size: [number, number, number];
  };
  /** Optional second walkable plane (e.g. ship upper deck). */
  floor_upper?: {
    position: [number, number, number];
    size: [number, number, number];
  };
  props: Array<{
    id: string;
    mesh?: string;
    color: string;
    size: [number, number, number];
    position: [number, number, number];
    rotation?: [number, number, number];
    /** Uniform scale multiplier (default 1). */
    scale?: number;
    wall?: WallFace;
  }>;
  hotspots: Array<HotspotData & { wall?: WallFace }>;
  portals?: PortalDef[];
  lighting?: Record<string, { position: number[]; color: string; energy: number }>;
  spawn?: { player: [number, number, number] };
  camera_shots?: Record<string, CameraShotDef>;
};

export type FloorPlaneData = {
  position: [number, number, number];
  size: [number, number, number];
};

type PortalEntry = {
  group: THREE.Group;
  target: string;
  disc: THREE.Mesh;
  swirl: PortalSwirlParticles;
};

const LIGHT_PARENTS: Record<string, string> = {
  lamp: 'LampBase',
  window: 'WindowFrame',
  reading_lamp: 'NightstandReadingLight',
  cabinet_lamp_left: 'CabinetLampLeft',
  cabinet_lamp_right: 'CabinetLampRight',
};

const FLOOR_ONLY_PROPS = new Set([
  'Rug',
  'BedFrame',
  'Mattress',
  'Pillow',
  'Desk',
  'Chair',
  'Nightstand',
  'NightstandReadingLight',
  'LampBase',
  'LampShade',
  'Sketchbook',
  'CrowFigurine',
  'CalendarScrap',
  'Wastebin',
  'WardrobeTypewriter',
  'CabinetLampLeft',
  'CabinetLampRight',
  'RedYarnBall',
  'CorkBoardClutter',
]);

const FLOOR_ONLY_HOTSPOTS = new Set([
  'bed',
  'calendar_scrap',
  'desk',
  'desk_drawer',
  'sketchbook',
  'nightstand',
  'key_handle',
  'chair',
  'portal_ship',
]);

const OBSTACLE_IDS = new Set([
  'BedFrame', 'Desk', 'Chair', 'WallBookcase', 'Nightstand', 'Wardrobe',
  'Mast', 'TreasureChest', 'WheelStand', 'Barrel1', 'Barrel2', 'Cannon',
  'Arbor', 'CrystalCluster', 'Telescope', 'StonePillar',
]);

const ROOM_FILES: Record<string, unknown> = {
  bedroom: roomData,
  pirate_ship: shipRoomData,
  level_2: level2RoomData,
  level_3: level3RoomData,
  level_4: level4RoomData,
};

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
  /** Walkable floor plane (editable in Dev Mode Layout). */
  floorPlaneData: FloorPlaneData = {
    position: [0, -0.05, 0],
    size: [6, 0.1, 6],
  };
  /** Upper / secondary walkable plane (ship aft deck). Null if room has none. */
  upperFloorPlaneData: FloorPlaneData | null = null;
  cameraShotsData: Record<string, CameraShotDef> = {};
  readonly wallMeshes = new Map<WallFace, THREE.Mesh>();
  readonly lights = new Map<string, THREE.PointLight>();
  readonly paintingReveal: PaintingRevealController;
  readonly nightstandDrawer: NightstandDrawerController;
  readonly wallNotesCluster: WallNotesCluster;
  readonly corkBoardCluster: CorkBoardCluster;
  wallSafeMesh: THREE.Object3D | null = null;
  phoneInSafeMesh: THREE.Object3D | null = null;
  readonly portalDefs: PortalDef[] = [];
  readonly portals = new Map<string, PortalEntry>();
  readonly roomId: string;
  /** Fired when async props change floor/hotspot raycast targets (e.g. ship deck). */
  onTargetsChanged?: () => void;

  private palette: Record<string, string>;
  private nightstandDrawerUnlocked = false;
  private nightstandDrawerAnimate = false;
  private oceanMesh: THREE.Mesh | null = null;
  private shipFloatRoot: THREE.Group | null = null;
  private shipFloat: ShipFloatMotion | null = null;
  private floorEditHelper: THREE.Mesh | null = null;
  private floorPlaneFromFile = false;
  private upperFloorFromFile = false;
  private shipFloorLocal = false;
  private shipLadderBottom = new THREE.Object3D();
  private shipLadderTop = new THREE.Object3D();
  private upperDeckFloorMesh: THREE.Mesh | null = null;
  private shipUpperDeckHeight = 0;

  constructor(private wallCtrl: ViewWallController, roomId = 'bedroom') {
    this.roomId = roomId;
    const data = (ROOM_FILES[roomId] ?? roomData) as unknown as RoomFile;
    this.palette = data.palette;
    this.shellSize.set(data.shell.size.x, data.shell.size.z);
    const spawn = data.spawn?.player ?? [0, 0, 2];
    this.playerSpawn.set(spawn[0], spawn[1], spawn[2]);
    this.floorPlaneData = data.floor
      ? {
          position: [...data.floor.position] as [number, number, number],
          size: [...data.floor.size] as [number, number, number],
        }
      : {
          position: [0, -0.05, 0],
          size: [data.shell.size.x, 0.1, data.shell.size.z],
        };
    this.floorPlaneFromFile = Boolean(data.floor);
    if (data.floor_upper) {
      this.upperFloorPlaneData = {
        position: [...data.floor_upper.position] as [number, number, number],
        size: [...data.floor_upper.size] as [number, number, number],
      };
      this.upperFloorFromFile = true;
      this.shipUpperDeckHeight =
        data.floor_upper.position[1] + data.floor_upper.size[1] / 2;
    }
    this.root.add(this.propsRoot);
    this.root.add(this.hotspotsRoot);
    this.paintingReveal = new PaintingRevealController(
      new THREE.Vector3(0.9, 0.7, 0.05),
      this.color('wood_dark'),
    );
    this.nightstandDrawer = new NightstandDrawerController();
    this.wallNotesCluster = new WallNotesCluster();
    this.corkBoardCluster = new CorkBoardCluster();
    this.buildShell(data.shell);

    // Load custom layout from localStorage if it exists
    this.propsData = data.props;
    this.hotspotsData = data.hotspots;
    this.lightingData = data.lighting ?? {};
    this.cameraShotsData = mergeCameraShots(
      DEFAULT_CAMERA_SHOTS,
      data.camera_shots ?? undefined,
    );
    const savedLayout = localStorage.getItem(`dev_room_layout_${roomId}`);
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        if (Array.isArray(parsed.props)) {
          // Drop retired prop ids so a stale draft can't resurrect them.
          const retiredPropIds = new Set(['Typewriter', 'Bookshelf', 'Bookcase', 'ModernBookshelf']);
          parsed.props = parsed.props.filter((p: { id?: string }) => !retiredPropIds.has(p.id ?? ''));
          this.propsData = data.props.map((original) => {
            const saved = parsed.props.find((p: any) => p.id === original.id);
            if (saved) {
              return {
                ...original,
                position: saved.position,
                rotation: saved.rotation ?? original.rotation,
                scale: saved.scale ?? original.scale,
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
                position: saved.position,
                size: saved.size ?? original.size,
              };
            }
            return original;
          });
        }
        if (parsed.lighting) {
          this.lightingData = { ...this.lightingData };
          for (const key of Object.keys(parsed.lighting)) {
            if (this.lightingData[key]) {
              const saved = parsed.lighting[key];
              this.lightingData[key].position = [...saved.position];
              if (saved.color) this.lightingData[key].color = saved.color;
              if (saved.energy != null) this.lightingData[key].energy = saved.energy;
            }
          }
        }
        if (parsed.camera_shots) {
          this.cameraShotsData = mergeCameraShots(this.cameraShotsData, parsed.camera_shots);
        }
        if (parsed.floor?.position && parsed.floor?.size) {
          this.floorPlaneData = {
            position: [...parsed.floor.position] as [number, number, number],
            size: [...parsed.floor.size] as [number, number, number],
          };
          this.floorPlaneFromFile = true;
        }
        if (parsed.floor_upper?.position && parsed.floor_upper?.size) {
          this.upperFloorPlaneData = {
            position: [...parsed.floor_upper.position] as [number, number, number],
            size: [...parsed.floor_upper.size] as [number, number, number],
          };
          this.upperFloorFromFile = true;
          this.shipUpperDeckHeight =
            this.upperFloorPlaneData.position[1] + this.upperFloorPlaneData.size[1] / 2;
        }
      } catch (e) {
        console.error('Failed to load custom dev layout', e);
      }
    }

    this.buildProps(this.propsData);
    this.buildHotspots(this.hotspotsData);
    this.buildLighting(this.lightingData);

    if (roomId === 'bedroom') {
      // CorkBoard / WallNotes attach via prop entries when present; fall back if missing.
      if (!this.propsData.some((p) => p.id === 'WallNotes')) {
        const northWall = this.wallMeshes.get('north');
        if (northWall) {
          this.wallNotesCluster.group.position.set(WALL_NOTES_CLUSTER_OFFSET_X, 0, 0);
          this.wallNotesCluster.group.userData.wallFace = 'north';
          this.wallNotesCluster.attachToWall(northWall);
        }
      }
      if (!this.propsData.some((p) => p.id === 'CorkBoard')) {
        const southWall = this.wallMeshes.get('south');
        if (southWall) {
          this.corkBoardCluster.group.position.copy(CORK_BOARD_CLUSTER_OFFSET);
          this.corkBoardCluster.group.rotation.y = Math.PI;
          this.corkBoardCluster.group.userData.wallFace = 'south';
          this.corkBoardCluster.attachToWall(southWall);
        }
      }
      this.portalDefs.push(...(data.portals ?? []));
      this.buildPortals(this.portalDefs);
    }

    // Register walls with wallCtrl AFTER everything is parented and in rest position!
    for (const [face, wall] of this.wallMeshes) {
      this.wallCtrl.register(wall, face);
    }

    if (roomId === 'pirate_ship') {
      this.finalizePirateShipWorld();
    }
  }

  /** Ocean plane + float group so the deck rides on the water. */
  private finalizePirateShipWorld(): void {
    const floatRoot = new THREE.Group();
    floatRoot.name = 'ShipFloatRoot';

    const children = [...this.root.children];
    for (const child of children) {
      floatRoot.attach(child);
    }
    this.root.add(floatRoot);
    this.shipFloatRoot = floatRoot;
    this.shipFloat = new ShipFloatMotion(floatRoot, 0);

    this.oceanMesh = buildOceanPlane();
    this.root.add(this.oceanMesh);
  }

  getShipFloatY(): number {
    return this.shipFloatRoot?.position.y ?? 0;
  }

  /** World XZ + logical deck height (y) waypoints for climbing between decks. */
  buildDeckMovePath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const fromDeck = from.y;
    const toDeck = to.y;
    if (Math.abs(fromDeck - toDeck) < 0.2) {
      return [to.clone()];
    }

    const bottom = new THREE.Vector3();
    const top = new THREE.Vector3();
    this.shipLadderBottom.getWorldPosition(bottom);
    this.shipLadderTop.getWorldPosition(top);

    const upperH = this.shipUpperDeckHeight || toDeck || fromDeck;
    const bottomWp = new THREE.Vector3(bottom.x, 0, bottom.z);
    const topWp = new THREE.Vector3(top.x, upperH, top.z);
    const goingUp = toDeck > fromDeck;

    const path: THREE.Vector3[] = [];
    if (goingUp) {
      path.push(bottomWp);
      path.push(topWp);
    } else {
      path.push(topWp);
      path.push(bottomWp);
    }
    path.push(to.clone());
    return path;
  }

  /** XZ walk clamp for the player's current deck. */
  getWalkBoundsForDeck(deckHeight: number): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    const pad = 0.2;
    const halfX = this.shellSize.x / 2 - 0.15;
    const halfZ = this.shellSize.y / 2 - 0.15;
    const main = {
      minX: -halfX + pad,
      maxX: halfX - pad,
      minZ: -halfZ + pad,
      maxZ: halfZ - pad,
    };

    const upperH = this.shipUpperDeckHeight;
    if (upperH <= 0) return main;

    // While climbing, keep the larger main-deck bounds so the step isn't blocked.
    if (deckHeight > 0.15 && deckHeight < upperH - 0.15) {
      return main;
    }

    if (deckHeight > upperH * 0.5 && this.upperDeckFloorMesh) {
      const box = new THREE.Box3().setFromObject(this.upperDeckFloorMesh);
      return {
        minX: box.min.x + pad,
        maxX: box.max.x - pad,
        minZ: box.min.z + pad,
        maxZ: box.max.z - pad,
      };
    }
    return main;
  }

  updateShipWorld(dt: number): void {
    this.shipFloat?.update(dt);
    if (this.oceanMesh) updateOceanDrift(this.oceanMesh, dt);
  }

  getPrimaryFloorMesh(): THREE.Mesh | null {
    const mesh = this.floorMeshes[0];
    return mesh && (mesh as THREE.Mesh).isMesh ? (mesh as THREE.Mesh) : null;
  }

  getUpperFloorMesh(): THREE.Mesh | null {
    return this.upperDeckFloorMesh;
  }

  hasUpperFloor(): boolean {
    return Boolean(this.upperDeckFloorMesh && this.upperFloorPlaneData);
  }

  /** Apply floorPlaneData to the walkable mesh + player bounds. */
  applyFloorPlane(): void {
    const mesh = this.getPrimaryFloorMesh();
    if (!mesh) return;

    const { position, size } = this.floorPlaneData;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.name = mesh.name || 'FloorPlane';
    mesh.userData.deckHeight = 0;

    if (this.shipFloorLocal) {
      const ship = this.propsRoot.getObjectByName('PirateShip');
      const yawDeg = ship
        ? THREE.MathUtils.radToDeg(ship.rotation.y)
        : 0;
      const swapped = Math.abs(Math.abs(yawDeg) % 180 - 90) < 1;
      const worldX = swapped ? size[2] : size[0];
      const worldZ = swapped ? size[0] : size[2];
      this.shellSize.set(worldX, worldZ);
      this.fitShipRailsToDeck(worldX, worldZ);
    } else {
      this.shellSize.set(size[0], size[2]);
    }

    // Keep upper deck registered for clicks after main-deck edits.
    if (this.upperDeckFloorMesh && !this.floorMeshes.includes(this.upperDeckFloorMesh)) {
      this.floorMeshes.push(this.upperDeckFloorMesh);
    }
  }

  /** Apply upperFloorPlaneData to the secondary walk mesh + climb markers. */
  applyUpperFloorPlane(): void {
    const mesh = this.upperDeckFloorMesh;
    const data = this.upperFloorPlaneData;
    if (!mesh || !data) return;

    const { position, size } = data;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.name = 'UpperDeckFloor';
    const topY = position[1] + size[1] / 2;
    mesh.userData.deckHeight = topY;
    this.shipUpperDeckHeight = topY;
    this.syncClimbMarkersFromUpperFloor();

    if (!this.floorMeshes.includes(mesh)) {
      this.floorMeshes.push(mesh);
    }
  }

  private syncClimbMarkersFromUpperFloor(): void {
    const data = this.upperFloorPlaneData;
    if (!data) return;
    const { position, size } = data;
    const topY = position[1] + size[1] / 2;
    // Forward lip toward midships (+Z from the aft deck center in ship-local space).
    const lipZ = position[2] + size[2] / 2;
    this.shipLadderBottom.position.set(position[0], 0, lipZ + 0.85);
    this.shipLadderTop.position.set(position[0], topY, lipZ - 0.45);
  }

  /**
   * Show/hide a translucent helper on the selected walkable floor (Layout editing).
   * target: 'main' | 'upper'
   */
  updateFloorEditHelper(visible: boolean, target: 'main' | 'upper' = 'main'): void {
    if (this.floorEditHelper) {
      this.floorEditHelper.parent?.remove(this.floorEditHelper);
      this.floorEditHelper.geometry.dispose();
      (this.floorEditHelper.material as THREE.Material).dispose();
      this.floorEditHelper = null;
    }
    if (!visible) return;

    const mesh =
      target === 'upper' ? this.getUpperFloorMesh() : this.getPrimaryFloorMesh();
    const data =
      target === 'upper' ? this.upperFloorPlaneData : this.floorPlaneData;
    if (!mesh || !data) return;

    const { size } = data;
    const sx = size[0];
    const sy = Math.max(size[1], 0.04);
    const sz = size[2];
    this.floorEditHelper = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshBasicMaterial({
        color: target === 'upper' ? 0xf4a261 : 0x4ecdc4,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    this.floorEditHelper.name = 'FloorEditHelper';
    this.floorEditHelper.raycast = () => {};
    this.floorEditHelper.position.set(0, 0, 0);
    mesh.add(this.floorEditHelper);
  }

  /** Resize invisible rail walls to match the walkable deck footprint. */
  private fitShipRailsToDeck(deckX: number, deckZ: number): void {
    if (this.roomId !== 'pirate_ship') return;
    const wallH = 0.35;
    const halfX = deckX / 2;
    const halfZ = deckZ / 2;
    const specs: Array<{ face: WallFace; pos: [number, number, number]; size: [number, number, number] }> = [
      { face: 'north', pos: [0, wallH / 2, -halfZ], size: [deckX, wallH, 0.12] },
      { face: 'south', pos: [0, wallH / 2, halfZ], size: [deckX, wallH, 0.12] },
      { face: 'west', pos: [-halfX, wallH / 2, 0], size: [0.12, wallH, deckZ] },
      { face: 'east', pos: [halfX, wallH / 2, 0], size: [0.12, wallH, deckZ] },
    ];
    for (const spec of specs) {
      const wall = this.wallMeshes.get(spec.face);
      if (!wall) continue;
      wall.geometry.dispose();
      wall.geometry = new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
      wall.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
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
      mesh.userData.deckHeight = 0;
      mesh.layers.set(0);
      this.floorMeshes.push(mesh);
    }
    return mesh;
  }

  private buildShell(shell: RoomFile['shell']): void {
    const centerZ = 0;
    const isShip = this.roomId === 'pirate_ship';

    if (!isShip) {
      const size = this.floorPlaneData.size;
      const pos = this.floorPlaneData.position;
      const floor = this.makeBox(
        new THREE.Vector3(size[0], size[1], size[2]),
        this.color(shell.floor_color),
        true,
      );
      floor.name = 'FloorPlane';
      floor.position.set(pos[0], pos[1], pos[2] !== 0 ? pos[2] : centerZ);
      this.root.add(floor);
      this.shellSize.set(size[0], size[2]);
    }
    // Pirate ship: walkable ground comes from the ship deck (registered when GLB loads).

    const wallH = shell.wall_height;
    const halfX = this.shellSize.x / 2;
    const halfZ = this.shellSize.y / 2;

    const walls: Array<{ id: string; face: WallFace; pos: [number, number, number]; size: [number, number, number] }> = [
      { id: 'wall_north', face: 'north', pos: [0, wallH / 2, centerZ - halfZ], size: [this.shellSize.x, wallH, 0.15] },
      { id: 'wall_south', face: 'south', pos: [0, wallH / 2, centerZ + halfZ], size: [this.shellSize.x, wallH, 0.15] },
      { id: 'wall_west', face: 'west', pos: [-halfX, wallH / 2, centerZ], size: [0.15, wallH, this.shellSize.y] },
      { id: 'wall_east', face: 'east', pos: [halfX, wallH / 2, centerZ], size: [0.15, wallH, this.shellSize.y] },
    ];

    for (const w of walls) {
      const wall = this.makeBox(
        new THREE.Vector3(w.size[0], w.size[1], w.size[2]),
        this.color(shell.wall_color),
      );
      wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wall.name = w.id;
      wall.userData.wallFace = w.face;
      if (isShip) {
        // Keep wall meshes for view/controller bookkeeping, but hide the old translucent bounds.
        wall.visible = false;
        wall.raycast = () => {};
      }
      this.root.add(wall);
      this.wallMeshes.set(w.face, wall);
    }
  }

  private buildProps(props: RoomFile['props']): void {
    const loader = new GLTFLoader();

    for (const prop of props) {
      const applyScale = (obj: THREE.Object3D) => {
        obj.scale.setScalar(prop.scale ?? 1);
      };

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
            applyScale(group);
            wallMesh.add(group);
          } else {
            applyScale(group);
            this.propsRoot.add(group);
          }
        } else {
          applyScale(group);
          this.propsRoot.add(group);
        }
        continue;
      }

      if (prop.id === 'CorkBoard' || prop.id === 'WallNotes') {
        const group =
          prop.id === 'CorkBoard' ? this.corkBoardCluster.group : this.wallNotesCluster.group;
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        } else if (prop.id === 'CorkBoard') {
          group.rotation.y = Math.PI;
        }
        const face = prop.wall ?? inferWallFace(prop.position[0], prop.position[2]);
        group.userData.wallFace = face;
        group.userData.devEditable = true;
        if (face !== 'floor') {
          const wallMesh = this.wallMeshes.get(face);
          if (wallMesh) {
            group.position.sub(wallMesh.position);
            applyScale(group);
            wallMesh.add(group);
          } else {
            applyScale(group);
            this.propsRoot.add(group);
          }
        } else {
          applyScale(group);
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
        applyScale(group);
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
        applyScale(group);
        this.propsRoot.add(group);
        continue;
      }

      if (prop.id === 'CabinetLampLeft' || prop.id === 'CabinetLampRight') {
        const group = buildVintageTableLamp(prop.id);
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        group.userData.devEditable = true;
        applyScale(group);
        this.propsRoot.add(group);
        this.attachLightsForProp(prop.id);
        continue;
      }

      if (prop.id.startsWith('WallOutlet')) {
        const group = buildWallOutlet();
        group.name = prop.id;
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
        group.userData.devEditable = true;
        if (face !== 'floor') {
          const wallMesh = this.wallMeshes.get(face);
          if (wallMesh) {
            group.position.sub(wallMesh.position);
            applyScale(group);
            wallMesh.add(group);
          } else {
            applyScale(group);
            this.propsRoot.add(group);
          }
        } else {
          applyScale(group);
          this.propsRoot.add(group);
        }
        continue;
      }

      if (prop.id === 'Wastebin') {
        loadWastebin((group) => {
          group.position.set(prop.position[0], prop.position[1], prop.position[2]);
          if (prop.rotation) {
            group.rotation.set(
              THREE.MathUtils.degToRad(prop.rotation[0]),
              THREE.MathUtils.degToRad(prop.rotation[1]),
              THREE.MathUtils.degToRad(prop.rotation[2]),
            );
          }
          group.userData.wallFace = 'floor';
          group.userData.devEditable = true;
          applyScale(group);
          this.propsRoot.add(group);
          this.attachLightsForProp(prop.id);
        });
        continue;
      }

      if (prop.id === 'WardrobeTypewriter') {
        loadTypewriter((group) => {
          group.position.set(prop.position[0], prop.position[1], prop.position[2]);
          if (prop.rotation) {
            group.rotation.set(
              THREE.MathUtils.degToRad(prop.rotation[0]),
              THREE.MathUtils.degToRad(prop.rotation[1]),
              THREE.MathUtils.degToRad(prop.rotation[2]),
            );
          }
          group.userData.wallFace = 'floor';
          group.userData.devEditable = true;
          applyScale(group);
          this.propsRoot.add(group);
          this.attachLightsForProp(prop.id);
        }, 'WardrobeTypewriter');
        continue;
      }

      if (prop.id === 'WallBookcase') {
        loadModernBookshelf((group) => {
          group.name = 'WallBookcase';
          const model = group.children[0] ?? group;
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const target = new THREE.Vector3(prop.size[0], prop.size[1], prop.size[2]);
          const fit = Math.min(
            target.x / (size.x || 1),
            target.y / (size.y || 1),
            target.z / (size.z || 1),
          );
          model.scale.setScalar(fit);
          const scaled = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          scaled.getCenter(center);
          model.position.set(-center.x, -scaled.min.y, -center.z);

          group.position.set(prop.position[0], prop.position[1], prop.position[2]);
          if (prop.rotation) {
            group.rotation.set(
              THREE.MathUtils.degToRad(prop.rotation[0]),
              THREE.MathUtils.degToRad(prop.rotation[1]),
              THREE.MathUtils.degToRad(prop.rotation[2]),
            );
          }
          const face = prop.wall ?? 'east';
          group.userData.wallFace = face;
          group.userData.devEditable = true;
          if (face !== 'floor') {
            const wallMesh = this.wallMeshes.get(face);
            if (wallMesh) {
              // Async load may finish after walls start folding — always use rest pose.
              const rest = this.getWallRestPosition(face) ?? wallMesh.position;
              group.position.sub(rest);
              applyScale(group);
              wallMesh.add(group);
            } else {
              applyScale(group);
              this.propsRoot.add(group);
            }
          } else {
            applyScale(group);
            this.propsRoot.add(group);
          }
          this.attachLightsForProp(prop.id);
        });
        continue;
      }

      if (prop.id === 'RedYarnBall') {
        const group = buildRedYarnBall();
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        group.userData.devEditable = true;
        applyScale(group);
        this.propsRoot.add(group);
        continue;
      }

      if (prop.id === 'CorkBoardClutter') {
        const group = buildCorkBoardClutterPile();
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        group.userData.devEditable = true;
        applyScale(group);
        this.propsRoot.add(group);
        continue;
      }

      if (prop.id === 'PirateShip') {
        loadSailShip(({ group, deckFloor, deckSize, upperDeck }) => {
          group.position.set(prop.position[0], prop.position[1], prop.position[2]);
          if (prop.rotation) {
            group.rotation.set(
              THREE.MathUtils.degToRad(prop.rotation[0]),
              THREE.MathUtils.degToRad(prop.rotation[1]),
              THREE.MathUtils.degToRad(prop.rotation[2]),
            );
          }
          group.userData.wallFace = 'floor';
          group.userData.devEditable = true;
          applyScale(group);
          this.propsRoot.add(group);

          this.shipFloorLocal = true;
          if (!this.floorPlaneFromFile) {
            this.floorPlaneData = {
              position: [deckFloor.position.x, deckFloor.position.y, deckFloor.position.z],
              size: [deckSize.x, 0.06, deckSize.z],
            };
          }

          this.floorMeshes.length = 0;
          this.floorMeshes.push(deckFloor);
          this.applyFloorPlane();

          if (upperDeck) {
            this.upperDeckFloorMesh = upperDeck.floor;
            if (!this.upperFloorFromFile || !this.upperFloorPlaneData) {
              const geo = upperDeck.floor.geometry as THREE.BoxGeometry;
              const p = geo.parameters;
              this.upperFloorPlaneData = {
                position: [
                  upperDeck.floor.position.x,
                  upperDeck.floor.position.y,
                  upperDeck.floor.position.z,
                ],
                size: [p.width, p.height, p.depth],
              };
            }
            this.applyUpperFloorPlane();
            group.add(this.shipLadderBottom);
            group.add(this.shipLadderTop);
          }

          this.onTargetsChanged?.();
        });
        continue;
      }

      if (prop.id === 'NightstandReadingLight') {
        const group = buildNightstandReadingLight();
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        applyScale(group);
        this.propsRoot.add(group);
        continue;
      }

      if (prop.id === 'CalendarScrap') {
        const group = buildCalendarScrap();
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        applyScale(group);
        this.propsRoot.add(group);
        continue;
      }

      if (prop.id === 'Sketchbook') {
        const group = buildSketchbook();
        group.position.set(prop.position[0], prop.position[1], prop.position[2]);
        if (prop.rotation) {
          group.rotation.set(
            THREE.MathUtils.degToRad(prop.rotation[0]),
            THREE.MathUtils.degToRad(prop.rotation[1]),
            THREE.MathUtils.degToRad(prop.rotation[2]),
          );
        }
        group.userData.wallFace = 'floor';
        applyScale(group);
        this.propsRoot.add(group);
        continue;
      }

      if (prop.id === 'WindowFrame') {
        const group = buildWindowFrame(
          new THREE.Vector3(prop.size[0], prop.size[1], prop.size[2]),
          this.color(prop.color),
          this.color('window_cool'),
        );
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
            applyScale(group);
            wallMesh.add(group);
          } else {
            applyScale(group);
            this.propsRoot.add(group);
          }
        } else {
          applyScale(group);
          this.propsRoot.add(group);
        }
        continue;
      }

      if (prop.id === 'WindowGlass') {
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
                const origMat = meshChild.material as THREE.MeshStandardMaterial;
                const paletteTint = prop.color && this.palette[prop.color]
                  ? this.color(prop.color)
                  : null;
                meshChild.material = new THREE.MeshStandardMaterial({
                  color: paletteTint ?? origMat.color ?? new THREE.Color(0xffffff),
                  map: paletteTint ? null : (origMat.map || null),
                  roughness: 0.85,
                  metalness: 0.1,
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

          if (prop.id === 'Nightstand') {
            this.nightstandDrawer.attachToNightstand(
              group,
              model,
              this.color(prop.color ?? 'wood'),
            );
            this.applyNightstandDrawerState();
          }

          const face = prop.wall ?? (FLOOR_ONLY_PROPS.has(prop.id) ? 'floor' : inferWallFace(prop.position[0], prop.position[2]));
          group.userData.wallFace = face;

          if (face !== 'floor') {
            const wallMesh = this.wallMeshes.get(face);
            if (wallMesh) {
              group.position.sub(wallMesh.position);
              applyScale(group);
              wallMesh.add(group);
            } else {
              applyScale(group);
              this.propsRoot.add(group);
            }
          } else {
            applyScale(group);
            this.propsRoot.add(group);
          }
          this.attachLightsForProp(prop.id);
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
            applyScale(mesh);
            wallMesh.add(mesh);
          } else {
            applyScale(mesh);
            this.propsRoot.add(mesh);
          }
        } else {
          applyScale(mesh);
          this.propsRoot.add(mesh);
        }
      }

      // Add obstacles for player collisions
      if (OBSTACLE_IDS.has(prop.id)) {
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
    const isShip = this.roomId === 'pirate_ship';
    const ambient = new THREE.AmbientLight(
      isShip ? 0xcfe4ff : 0x404860,
      isShip ? 1.5 : 0.55,
    );
    this.root.add(ambient);

    if (isShip) {
      const sun = new THREE.DirectionalLight(0xfff3da, 1.8);
      sun.position.set(4, 9, 5);
      this.root.add(sun);
    }

    for (const [key, spec] of Object.entries(lighting ?? {})) {
      const light = new THREE.PointLight(
        new THREE.Color(spec.color),
        spec.energy,
        6,
      );
      light.name = `light_${key}`;
      light.position.set(spec.position[0], spec.position[1], spec.position[2]);
      this.root.add(light);
      this.lights.set(key, light);

      const parentId = LIGHT_PARENTS[key];
      if (parentId) {
        this.attachLightToProp(key, parentId);
      }
    }
  }

  /** Parent a room light to a prop so it moves/rotates/scales with that object. */
  attachLightToProp(lightKey: string, parentId: string): boolean {
    const light = this.lights.get(lightKey);
    const spec = this.lightingData?.[lightKey];
    if (!light || !spec) return false;

    const parentMesh =
      this.propsRoot.getObjectByName(parentId) || this.root.getObjectByName(parentId);
    if (!parentMesh) return false;

    parentMesh.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3(spec.position[0], spec.position[1], spec.position[2]);
    const localPos = parentMesh.worldToLocal(worldPos.clone());

    parentMesh.add(light);
    light.position.copy(localPos);
    light.userData.parentPropId = parentId;
    light.userData.localOffset = localPos.clone();
    return true;
  }

  /** Re-attach any lights that belong to this prop (e.g. after async GLB load). */
  attachLightsForProp(propId: string): void {
    for (const [lightKey, parentId] of Object.entries(LIGHT_PARENTS)) {
      if (parentId === propId) {
        this.attachLightToProp(lightKey, parentId);
      }
    }
  }

  /** Write each light's current world position back into lightingData (for save). */
  syncLightWorldPositions(lightKeys?: Iterable<string>): void {
    const keys = lightKeys
      ? [...lightKeys]
      : [...this.lights.keys()];
    for (const key of keys) {
      const light = this.lights.get(key);
      const spec = this.lightingData?.[key];
      if (!light || !spec) continue;
      light.updateMatrixWorld(true);
      const world = new THREE.Vector3();
      light.getWorldPosition(world);
      spec.position[0] = world.x;
      spec.position[1] = world.y;
      spec.position[2] = world.z;
    }
  }

  applyLightSettings(key: string): void {
    const spec = this.lightingData?.[key];
    const light = this.lights.get(key);
    if (!spec || !light) return;
    light.color.set(spec.color);
    light.intensity = spec.energy;
  }

  setHotspotVisible(id: string, visible: boolean): void {
    const hs = this.hotspots.find((h) => h.id === id);
    if (hs) {
      hs.mesh.userData.puzzleHidden = !visible;
      if (!visible) hs.mesh.visible = false;
    }
  }

  setPropVisible(id: string, visible: boolean): void {
    const mesh = this.propsRoot.getObjectByName(id) || this.root.getObjectByName(id);
    if (mesh) mesh.visible = visible;
  }

  /** Wall rest pose for parenting math — never the folded/animated wall position. */
  getWallRestPosition(face: WallFace): THREE.Vector3 | null {
    const fromCtrl = this.wallCtrl.getRestPositionForFace(face);
    if (fromCtrl) return fromCtrl;
    const wall = this.wallMeshes.get(face);
    return wall ? wall.position.clone() : null;
  }

  getHotspotWorldPosition(id: string): THREE.Vector3 | null {
    const hs = this.hotspots.find((h) => h.id === id);
    if (!hs) return null;
    hs.mesh.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    hs.mesh.getWorldPosition(pos);
    return pos;
  }

  getHotspotWallFace(id: string): WallFace | null {
    const hs = this.hotspots.find((h) => h.id === id);
    if (!hs) return null;
    return (hs.mesh.userData.wallFace as WallFace) ?? 'floor';
  }

  rebuildObstacles(): void {
    this.obstacles.length = 0;
    for (const prop of this.propsData) {
      if (OBSTACLE_IDS.has(prop.id)) {
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

  getPortalTarget(portalId: string): string | null {
    return this.portals.get(portalId)?.target ?? null;
  }

  getCameraShot(id: string): CameraShotDef | null {
    return this.cameraShotsData[id] ?? DEFAULT_CAMERA_SHOTS[id] ?? null;
  }

  setCameraShot(id: string, shot: CameraShotDef): void {
    this.cameraShotsData[id] = {
      ...shot,
      target: [...shot.target] as [number, number, number],
    };
  }

  private buildPortals(defs: PortalDef[]): void {
    for (const def of defs) {
      const group = new THREE.Group();
      group.name = def.id;
      const radius = def.radius ?? 0.5;
      const face = def.wall ?? 'floor';
      group.userData.wallFace = face;

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({ color: 0x000000 }),
      );
      this.orientPortalDisc(disc, face);
      group.add(disc);

      const swirl = new PortalSwirlParticles(radius);
      disc.add(swirl.points);

      group.position.set(def.position[0], def.position[1], def.position[2]);
      group.visible = false;
      this.portals.set(def.id, { group, target: def.target, disc, swirl });
      this.attachPortal(group, face);
    }
  }

  private orientPortalDisc(disc: THREE.Mesh, face: WallFace): void {
    if (face === 'floor') {
      disc.rotation.x = -Math.PI / 2;
      return;
    }
    if (face === 'north') return;
    if (face === 'south') {
      disc.rotation.y = Math.PI;
      return;
    }
    if (face === 'east') {
      disc.rotation.y = -Math.PI / 2;
      return;
    }
    if (face === 'west') {
      disc.rotation.y = Math.PI / 2;
    }
  }

  private attachPortal(group: THREE.Group, face: WallFace): void {
    if (face !== 'floor') {
      const wallMesh = this.wallMeshes.get(face);
      if (wallMesh) {
        group.position.sub(wallMesh.position);
        wallMesh.add(group);
        return;
      }
    }
    this.propsRoot.add(group);
  }

  /** Animate bedroom portals into view (defaults to all registered portals). */
  revealPortals(portalIds?: string[]): void {
    const ids = portalIds ?? [...this.portals.keys()];
    let delay = 0;
    for (const id of ids) {
      const entry = this.portals.get(id);
      if (!entry) continue;
      const target = entry.group;
      target.visible = true;
      target.scale.setScalar(0.01);
      const startAt = performance.now() + delay;
      delay += 120;
      const dur = 650;
      const animate = (t: number): void => {
        const k = Math.min(1, (t - startAt) / dur);
        if (k < 0) {
          requestAnimationFrame(animate);
          return;
        }
        const eased = 1 - Math.pow(1 - k, 3);
        target.scale.setScalar(eased);
        if (k < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }
  }

  syncPortals(revealedIds: string[], solvedIds: string[]): void {
    const revealed = new Set(revealedIds);
    const solved = new Set(solvedIds);
    for (const [id, entry] of this.portals) {
      entry.group.visible = revealed.has(id);
      entry.group.scale.setScalar(1);
      const mat = entry.disc.material as THREE.MeshBasicMaterial;
      const solvedPortal = solved.has(id);
      if (solvedPortal) {
        mat.color.setHex(0x111111);
        mat.opacity = 0.55;
        mat.transparent = true;
      } else {
        mat.color.setHex(0x000000);
        mat.opacity = 1;
        mat.transparent = false;
      }
      entry.swirl.setDimmed(solvedPortal);
    }
  }

  updatePortals(dt: number): void {
    for (const entry of this.portals.values()) {
      if (entry.group.visible) {
        entry.swirl.update(dt);
      }
    }
  }

  disposePortals(): void {
    for (const entry of this.portals.values()) {
      entry.swirl.dispose();
    }
  }

  setPortalSolved(portalId: string): void {
    const entry = this.portals.get(portalId);
    if (!entry) return;
    const mat = entry.disc.material as THREE.MeshBasicMaterial;
    mat.color.setHex(0x111111);
    mat.opacity = 0.55;
    mat.transparent = true;
    entry.swirl.setDimmed(true);
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

  syncNightstandDrawer(unlocked: boolean, animate = false): void {
    this.nightstandDrawerUnlocked = unlocked;
    if (animate) this.nightstandDrawerAnimate = true;
    if (unlocked) {
      this.nightstandDrawer.open(animate);
    } else {
      this.nightstandDrawerAnimate = false;
      this.nightstandDrawer.close();
    }
  }

  private applyNightstandDrawerState(): void {
    if (!this.nightstandDrawerUnlocked) return;
    this.nightstandDrawer.open(this.nightstandDrawerAnimate);
    this.nightstandDrawerAnimate = false;
  }
}
