export type WallFace = 'north' | 'south' | 'east' | 'west' | 'floor';

/** View index 0–3: which wall the camera faces. */
export const VIEW_FACING: WallFace[] = ['north', 'east', 'south', 'west'];

const OPPOSITE: Record<Exclude<WallFace, 'floor'>, WallFace> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export function oppositeWall(face: WallFace): WallFace | null {
  if (face === 'floor') return null;
  return OPPOSITE[face];
}

/** Opposite wall drops; facing and side walls stay raised. */
export function isWallRaised(face: WallFace, viewIndex: number): boolean {
  if (face === 'floor') return true;
  const facing = VIEW_FACING[viewIndex % 4];
  return face !== oppositeWall(facing);
}

export function inferWallFace(x: number, z: number): WallFace {
  if (z < -1.2) return 'north';
  if (z > 2.2) return 'south';
  if (x > 2.2) return 'east';
  if (x < -2.2) return 'west';
  return 'floor';
}
