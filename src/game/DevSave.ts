import type { RoomBuilder } from '../scene/RoomBuilder';
import {
  buildMergedItemsJson,
  buildMergedStoryJson,
  clearContentOverrides,
  getDevContentRoomId,
} from './DevContentOverrides';
import { getDevLevel, isDevLevelId, type DevLevelId } from './DevLevelConfig';

export type DevSavePayload = {
  roomId?: DevLevelId;
  room?: Record<string, unknown>;
  story?: Record<string, unknown>;
  items?: Record<string, unknown>;
};

export type DevSaveResult = {
  ok: boolean;
  method: 'api' | 'download';
  message: string;
};

function round3(value: number): number {
  return parseFloat(value.toFixed(3));
}

export function buildRoomJson(room: RoomBuilder): Record<string, unknown> {
  const level = getDevLevel(room.roomId);
  const baseRoom = level?.roomData ?? {};

  const cleanProps = room.propsData.map((p) => {
    const formatted: Record<string, unknown> = {
      id: p.id,
      mesh: p.mesh,
      color: p.color,
      size: p.size,
      position: [
        round3(p.position[0]),
        round3(p.position[1]),
        round3(p.position[2]),
      ],
    };

    if (p.rotation) {
      formatted.rotation = [
        round3(p.rotation[0]),
        round3(p.rotation[1]),
        round3(p.rotation[2]),
      ];
    }

    if (p.scale != null && p.scale !== 1) {
      formatted.scale = round3(p.scale);
    }

    if (p.wall) {
      formatted.wall = p.wall;
    }

    return formatted;
  });

  const cleanHotspots = room.hotspotsData.map((h) => {
    const formatted: Record<string, unknown> = {
      id: h.id,
      label: h.label,
      position: [
        round3(h.position[0]),
        round3(h.position[1]),
        round3(h.position[2]),
      ],
      size: h.size,
      color: (h as { color?: string }).color,
    };

    if (h.wall) {
      formatted.wall = h.wall;
    }

    return formatted;
  });

  const cleanLighting: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(room.lightingData || {})) {
    cleanLighting[key] = {
      position: [
        round3(spec.position[0]),
        round3(spec.position[1]),
        round3(spec.position[2]),
      ],
      color: spec.color,
      energy: spec.energy,
    };
  }

  const cleanCameraShots: Record<string, unknown> = {};
  for (const [id, shot] of Object.entries(room.cameraShotsData || {})) {
    cleanCameraShots[id] = {
      label: shot.label,
      target: [
        round3(shot.target[0]),
        round3(shot.target[1]),
        round3(shot.target[2]),
      ],
      size: round3(shot.size),
      pitch_deg: round3(shot.pitch_deg),
      yaw_deg: shot.yaw_deg === null || shot.yaw_deg === undefined
        ? null
        : round3(shot.yaw_deg),
      damp: round3(shot.damp ?? 9),
      ...(shot.lock_to ? { lock_to: shot.lock_to } : {}),
    };
  }

  const spawn = room.playerSpawn;
  const floor = room.floorPlaneData;
  const upperFloor = room.upperFloorPlaneData;
  const baseShell = (baseRoom as { shell?: Record<string, unknown> }).shell ?? {};

  const result: Record<string, unknown> = {
    ...baseRoom,
    shell: {
      ...baseShell,
      size: {
        x: round3(room.shellSize.x),
        z: round3(room.shellSize.y),
      },
    },
    floor: {
      position: [
        round3(floor.position[0]),
        round3(floor.position[1]),
        round3(floor.position[2]),
      ],
      size: [
        round3(floor.size[0]),
        round3(floor.size[1]),
        round3(floor.size[2]),
      ],
    },
    props: cleanProps,
    hotspots: cleanHotspots,
    lighting: cleanLighting,
    camera_shots: cleanCameraShots,
    spawn: {
      player: [round3(spawn.x), round3(spawn.y), round3(spawn.z)],
    },
  };

  if (upperFloor) {
    result.floor_upper = {
      position: [
        round3(upperFloor.position[0]),
        round3(upperFloor.position[1]),
        round3(upperFloor.position[2]),
      ],
      size: [
        round3(upperFloor.size[0]),
        round3(upperFloor.size[1]),
        round3(upperFloor.size[2]),
      ],
    };
  }

  return result;
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filenameFromPath(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export async function saveDevFiles(payload: DevSavePayload): Promise<DevSaveResult> {
  const roomId = payload.roomId;
  const level = roomId ? getDevLevel(roomId) : null;

  if (import.meta.env.DEV) {
    try {
      const res = await fetch('/__dev/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as { ok: boolean; written?: string[]; error?: string };
      if (res.ok && result.ok) {
        const files = result.written?.join(', ') ?? 'data files';
        return {
          ok: true,
          method: 'api',
          message: `Saved to ${files}. Reloading…`,
        };
      }
      return {
        ok: false,
        method: 'api',
        message: result.error ?? 'Dev save failed.',
      };
    } catch (err) {
      console.warn('Dev save API unavailable:', err);
    }
  }

  const downloads: string[] = [];
  if (payload.room && level) {
    downloadJson(payload.room, filenameFromPath(level.roomPath));
    downloads.push(`${level.roomPath}`);
  }
  if (payload.story && level) {
    downloadJson(payload.story, filenameFromPath(level.storyPath));
    downloads.push(`${level.storyPath}`);
  }
  if (payload.items && level?.itemsPath) {
    downloadJson(payload.items, filenameFromPath(level.itemsPath));
    downloads.push(`${level.itemsPath}`);
  }

  if (downloads.length === 0) {
    return { ok: false, method: 'download', message: 'Nothing to save.' };
  }

  return {
    ok: true,
    method: 'download',
    message:
      `Downloaded updated JSON file(s). Replace the matching files in the repo, then commit and push:\n\n${downloads.join('\n')}`,
  };
}

export async function saveLayoutToRepo(room: RoomBuilder): Promise<DevSaveResult> {
  if (!isDevLevelId(room.roomId)) {
    return { ok: false, method: 'api', message: `Dev layout save is not supported for room "${room.roomId}".` };
  }

  const result = await saveDevFiles({
    roomId: room.roomId,
    room: buildRoomJson(room),
  });
  if (result.ok && result.method === 'api') {
    localStorage.removeItem(`dev_room_layout_${room.roomId}`);
  }
  return result;
}

export async function saveContentToRepo(roomId?: DevLevelId): Promise<DevSaveResult> {
  const levelId = roomId ?? getDevContentRoomId();
  const level = getDevLevel(levelId);
  if (!level) {
    return { ok: false, method: 'api', message: `Dev text save is not supported for room "${levelId}".` };
  }

  const payload: DevSavePayload = {
    roomId: levelId,
    story: buildMergedStoryJson(levelId),
  };
  if (level.supportsItems) {
    payload.items = buildMergedItemsJson();
  }

  const result = await saveDevFiles(payload);
  if (result.ok && result.method === 'api') {
    clearContentOverrides(levelId);
  }
  return result;
}
