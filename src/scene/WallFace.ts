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

const RAISED_WALLS_BY_VIEW: Record<number, WallFace[]> = {
  0: ['north', 'west'], // Facing north (looking NW): north and west raised
  1: ['south', 'west'], // Facing east (looking SW): south and west raised
  2: ['south', 'east'], // Facing south (looking SE): south and east raised
  3: ['north', 'east'], // Facing west (looking NE): north and east raised
};

/** Only the two back corner walls stay raised to form a background corner, folding down foreground walls. */
export function isWallRaised(face: WallFace, viewIndex: number): boolean {
  if (face === 'floor') return true;
  const index = ((viewIndex % 4) + 4) % 4;
  const raised = RAISED_WALLS_BY_VIEW[index];
  return raised.includes(face);
}

export function inferWallFace(x: number, z: number): WallFace {
  if (z < -1.2) return 'north';
  if (z > 2.2) return 'south';
  if (x > 2.2) return 'east';
  if (x < -2.2) return 'west';
  return 'floor';
}
