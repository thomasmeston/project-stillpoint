"""
Blender helper — export hero props for LonnieCrow Room 1.

Run inside Blender (Scripting workspace) or:
  blender --background --python scripts/tools/blender_export_helpers.py

Adjust OUTPUT_DIR to your machine if needed.
"""

import bpy
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "assets" / "props"


def export_selected(name: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )
    print(f"Exported {path}")


# Example: select your mesh in Blender, then call export_selected("wall_safe")
