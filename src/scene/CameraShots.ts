import * as THREE from 'three';
import type { IsoCamera } from './IsoCamera';
import { ISO_PITCH } from './IsoCamera';

export type CameraShotLock =
  | 'desk_surface'
  | 'wall_notes'
  | 'cork_board'
  | 'player_head';

/** Named camera moves used by gameplay zooms / meditation. */
export type CameraShotDef = {
  label: string;
  /** World-space rig focus point (used when unlocked). */
  target: [number, number, number];
  /** Orthographic frustum size (smaller = closer). */
  size: number;
  /** Pitch in degrees (negative looks down). */
  pitch_deg: number;
  /**
   * Yaw in degrees. `null` keeps the current view yaw
   * (or player facing for meditate).
   */
  yaw_deg: number | null;
  /** Lerp damp for this move (higher = snappier). Default 9. */
  damp?: number;
  /**
   * When set, runtime resolves target from the live prop/player
   * instead of the stored target (until Capture unlocks it).
   */
  lock_to?: CameraShotLock;
};

export const DEFAULT_CAMERA_SHOTS: Record<string, CameraShotDef> = {
  desk_in: {
    label: 'Desk zoom in',
    target: [1.8, 0.802, 0],
    size: 1.4,
    pitch_deg: -90,
    yaw_deg: 0,
    damp: 9,
  },
  desk_out: {
    label: 'Desk zoom out',
    target: [1.8, 0.9, 0],
    size: 3.5,
    pitch_deg: THREE.MathUtils.radToDeg(ISO_PITCH),
    yaw_deg: null,
    damp: 9,
  },
  wall_notes_in: {
    label: 'Wall notes zoom in',
    target: [-1.1, 1.55, -2.92],
    size: 1.15,
    pitch_deg: 0,
    yaw_deg: 0,
    damp: 9,
  },
  cork_board_in: {
    label: 'Cork board zoom in',
    target: [0.85, 1.45, 2.92],
    size: 1.15,
    pitch_deg: 0,
    yaw_deg: 180,
    damp: 9,
  },
  room_overview: {
    label: 'Room overview',
    target: [0, 0.9, 0],
    size: 10,
    pitch_deg: THREE.MathUtils.radToDeg(ISO_PITCH),
    yaw_deg: null,
    damp: 9,
  },
  meditate: {
    label: 'Meditation close-up',
    target: [0, 1.5, 0],
    size: 0.88,
    pitch_deg: -6,
    yaw_deg: null,
    damp: 9,
    lock_to: 'player_head',
  },
};

export function cloneCameraShots(
  shots: Record<string, CameraShotDef>,
): Record<string, CameraShotDef> {
  const out: Record<string, CameraShotDef> = {};
  for (const [id, shot] of Object.entries(shots)) {
    out[id] = {
      ...shot,
      target: [...shot.target] as [number, number, number],
    };
  }
  return out;
}

export function mergeCameraShots(
  base: Record<string, CameraShotDef>,
  overlay?: Record<string, Partial<CameraShotDef>> | null,
): Record<string, CameraShotDef> {
  const merged = cloneCameraShots(base);
  if (!overlay) return merged;
  for (const [id, patch] of Object.entries(overlay)) {
    const prev = merged[id] ?? DEFAULT_CAMERA_SHOTS[id];
    if (!prev && !patch) continue;
    const fallback = prev ?? {
      label: id,
      target: [0, 0.9, 0] as [number, number, number],
      size: 10,
      pitch_deg: THREE.MathUtils.radToDeg(ISO_PITCH),
      yaw_deg: null as number | null,
      damp: 9,
    };
    const next: CameraShotDef = {
      ...fallback,
      ...patch,
      target: (patch.target
        ? [...patch.target]
        : [...fallback.target]) as [number, number, number],
      label: patch.label ?? fallback.label,
    };
    // File/draft entries omit lock_to to mean unlocked — don't keep base lock.
    if (!('lock_to' in patch)) {
      delete next.lock_to;
    } else if (!patch.lock_to) {
      delete next.lock_to;
    }
    merged[id] = next;
  }
  return merged;
}

export function applyCameraShot(
  camera: IsoCamera,
  shot: CameraShotDef,
  opts?: {
    targetOverride?: THREE.Vector3;
    yawOverride?: number;
  },
): void {
  const target = opts?.targetOverride
    ?? new THREE.Vector3(shot.target[0], shot.target[1], shot.target[2]);
  const pitch = THREE.MathUtils.degToRad(shot.pitch_deg);
  let yaw: number | undefined;
  if (opts?.yawOverride !== undefined) {
    yaw = opts.yawOverride;
  } else if (shot.yaw_deg !== null && shot.yaw_deg !== undefined) {
    yaw = THREE.MathUtils.degToRad(shot.yaw_deg);
  }
  camera.zoomTo(target, shot.size, pitch, yaw, shot.damp ?? 9);
}
