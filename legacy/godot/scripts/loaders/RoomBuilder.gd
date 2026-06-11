extends Node3D
class_name RoomBuilder
## RoomBuilder — builds bedroom geometry and hotspots from room data.

const ROOM_DATA_PATH := "res://data/rooms/bedroom.json"

@onready var _props_root: Node3D = $Props
@onready var _hotspots_root: Node3D = $Hotspots

var _palette: Dictionary = {}


func _ready() -> void:
	var data := DataLoader.load_json(ROOM_DATA_PATH)
	_palette = data.get("palette", {})
	var shell: Dictionary = data.get("shell", {})
	_build_shell(shell)
	_build_props(data.get("props", []))
	_build_hotspots(data.get("hotspots", []))
	_build_navmesh(shell)


func _build_shell(shell: Dictionary) -> void:
	var floor_color := _color(shell.get("floor_color", "#8b7355"))
	var wall_color := _color(shell.get("wall_color", "#d4cfc4"))
	var size: Dictionary = shell.get("size", {"x": 6.0, "z": 5.0})
	var floor := _make_box(Vector3(size.get("x", 6.0), 0.1, size.get("z", 5.0)), floor_color)
	floor.position = Vector3(0, -0.05, 1.0)
	add_child(floor)
	var wall_h: float = shell.get("wall_height", 2.8)
	_add_wall(Vector3(0, wall_h * 0.5, -size.get("z", 5.0) * 0.5 + 1.0), Vector3(size.get("x", 6.0), wall_h, 0.15), wall_color)
	_add_wall(Vector3(-size.get("x", 6.0) * 0.5, wall_h * 0.5, 1.0), Vector3(0.15, wall_h, size.get("z", 5.0)), wall_color)
	_add_wall(Vector3(size.get("x", 6.0) * 0.5, wall_h * 0.5, 1.0), Vector3(0.15, wall_h, size.get("z", 5.0)), wall_color)


func _build_props(props: Array) -> void:
	for prop in props:
		var mesh_type: String = prop.get("mesh", "box")
		var color := _color(prop.get("color", "#888888"))
		var size_arr: Array = prop.get("size", [1, 1, 1])
		var size := Vector3(size_arr[0], size_arr[1], size_arr[2])
		var pos_arr: Array = prop.get("position", [0, 0, 0])
		var node: Node3D
		match mesh_type:
			"cylinder":
				node = _make_cylinder(size, color)
			"sphere":
				node = _make_sphere(size, color)
			_:
				node = _make_box(size, color)
		node.position = Vector3(pos_arr[0], pos_arr[1], pos_arr[2])
		node.rotation_degrees = Vector3(
			prop.get("rotation", [0, 0, 0])[0],
			prop.get("rotation", [0, 0, 0])[1],
			prop.get("rotation", [0, 0, 0])[2]
		)
		node.name = prop.get("id", "Prop")
		_props_root.add_child(node)


func _build_hotspots(hotspots: Array) -> void:
	var highlight := StandardMaterial3D.new()
	highlight.albedo_color = Color(1.0, 0.95, 0.7)
	highlight.emission_enabled = true
	highlight.emission = Color(0.35, 0.3, 0.15)
	for hs in hotspots:
		var hotspot := Hotspot.new()
		hotspot.hotspot_id = hs.get("id", "")
		hotspot.display_name = hs.get("label", hotspot.hotspot_id)
		var pos_arr: Array = hs.get("position", [0, 0.5, 0])
		hotspot.position = Vector3(pos_arr[0], pos_arr[1], pos_arr[2])
		var size_arr: Array = hs.get("size", [0.5, 0.5, 0.5])
		var col := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(size_arr[0], size_arr[1], size_arr[2])
		col.shape = shape
		hotspot.add_child(col)
		var mesh_inst := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = shape.size
		mesh_inst.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = _color(hs.get("color", "#ffcc66"))
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color.a = 0.35
		mesh_inst.material_override = mat
		hotspot.add_child(mesh_inst)
		hotspot.set_highlight_material(highlight)
		_hotspots_root.add_child(hotspot)


func _make_box(size: Vector3, color: Color) -> MeshInstance3D:
	var mesh_inst := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_inst.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.9
	mesh_inst.material_override = mat
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	col.shape = shape
	body.add_child(col)
	mesh_inst.add_child(body)
	return mesh_inst


func _make_cylinder(size: Vector3, color: Color) -> MeshInstance3D:
	var mesh_inst := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = size.x * 0.5
	mesh.bottom_radius = size.x * 0.5
	mesh.height = size.y
	mesh_inst.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mesh_inst.material_override = mat
	return mesh_inst


func _make_sphere(size: Vector3, color: Color) -> MeshInstance3D:
	var mesh_inst := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = size.x * 0.5
	mesh.height = size.y
	mesh_inst.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mesh_inst.material_override = mat
	return mesh_inst


func _add_wall(pos: Vector3, size: Vector3, color: Color) -> void:
	var wall := _make_box(size, color)
	wall.position = pos
	add_child(wall)


func _color(value: String) -> Color:
	if _palette.has(value):
		value = _palette[value]
	return Color(value) if value.begins_with("#") else Color.WHITE


func _build_navmesh(shell: Dictionary) -> void:
	var size: Dictionary = shell.get("size", {"x": 6.0, "z": 5.0})
	var region := NavigationRegion3D.new()
	var mesh := NavigationMesh.new()
	mesh.agent_radius = 0.25
	mesh.agent_height = 1.8
	var half_x: float = size.get("x", 6.0) * 0.5 - 0.35
	var half_z: float = size.get("z", 5.0) * 0.5 - 0.35
	var center_z: float = 1.0
	mesh.vertices = PackedVector3Array([
		Vector3(-half_x, 0.05, center_z - half_z),
		Vector3(half_x, 0.05, center_z - half_z),
		Vector3(half_x, 0.05, center_z + half_z),
		Vector3(-half_x, 0.05, center_z + half_z),
	])
	mesh.add_polygon(PackedInt32Array([0, 1, 2, 3]))
	region.navigation_mesh = mesh
	add_child(region)
