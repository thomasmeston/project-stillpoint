import * as THREE from 'three';
import roomData from '../../data/rooms/bedroom.json';
import { Hotspot, type HotspotData } from './Hotspot';
import { inferWallFace, type WallFace } from './WallFace';
import type { ViewWallController } from './ViewWallController';

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
};

export class RoomBuilder {
  readonly root = new THREE.Group();
  readonly propsRoot = new THREE.Group();
  readonly hotspotsRoot = new THREE.Group();
  readonly hotspots: Hotspot[] = [];
  readonly floorMeshes: THREE.Object3D[] = [];

  private palette: Record<string, string>;
  private wallMeshes = new Map<WallFace, THREE.Mesh>();

  constructor(private wallCtrl: ViewWallController) {
    const data = roomData as unknown as RoomFile;
    this.palette = data.palette;
    this.root.add(this.propsRoot);
    this.root.add(this.hotspotsRoot);
    this.buildShell(data.shell);
    this.buildProps(data.props);
    this.buildHotspots(data.hotspots);
    this.buildLighting(data.lighting ?? {});

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
    for (const prop of props) {
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
      mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
      if (prop.rotation) {
        mesh.rotation.set(
          THREE.MathUtils.degToRad(prop.rotation[0]),
          THREE.MathUtils.degToRad(prop.rotation[1]),
          THREE.MathUtils.degToRad(prop.rotation[2]),
        );
      }
      mesh.name = prop.id;
      const face = prop.wall ?? inferWallFace(prop.position[0], prop.position[2]);
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
  }

  private buildHotspots(hotspots: RoomFile['hotspots']): void {
    for (const hs of hotspots) {
      const hotspot = new Hotspot(hs);
      const face = hs.wall ?? inferWallFace(hs.position[0], hs.position[2]);
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
    for (const spec of Object.values(lighting ?? {})) {
      const light = new THREE.PointLight(
        new THREE.Color(spec.color),
        spec.energy,
        6,
      );
      light.position.set(spec.position[0], spec.position[1], spec.position[2]);
      this.root.add(light);
    }
  }

  setHotspotVisible(id: string, visible: boolean): void {
    const hs = this.hotspots.find((h) => h.id === id);
    if (hs) {
      hs.mesh.userData.puzzleHidden = !visible;
      if (!visible) hs.mesh.visible = false;
    }
  }
}
