# Hero props (custom)

Custom Blender-authored GLB files for story-critical interactables.

## MVP hero props

| File | Hotspot id | Notes |
|------|------------|-------|
| `wall_safe.glb` | `wall_safe` | Small brass safe, wall-mounted |
| `wall_clock.glb` | `wall_clock` | Stopped clock, readable face |
| `door_chain.glb` | `door` | Door with chain + padlock |
| `photo_set.glb` | `painting` | Frame + reversible photos |
| `cipher_disk.glb` | `cipher_disk_pickup` | Cardboard cipher wheel |
| `crow_figurine.glb` | — | Desk flavor prop |

## Pipeline

1. Model in Blender (low-poly, flat materials).
2. Export GLB to this folder.
3. Add `MeshInstance3D` to `scenes/rooms/Bedroom.tscn` or extend `RoomBuilder` to load `prop.model` paths from JSON.

See `scripts/tools/blender_export_helpers.py` for export settings.
