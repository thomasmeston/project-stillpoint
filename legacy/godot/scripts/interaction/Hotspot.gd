extends Area3D
class_name Hotspot
## Hotspot — clickable interactable with id and highlight.

signal interacted(hotspot_id: String)

@export var hotspot_id: String = ""
@export var display_name: String = ""

var _base_material: StandardMaterial3D
var _highlight_material: StandardMaterial3D
var _mesh: MeshInstance3D


func _ready() -> void:
	if display_name.is_empty():
		display_name = hotspot_id
	collision_layer = 2
	collision_mask = 0
	monitoring = true
	input_ray_pickable = true
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)
	input_event.connect(_on_input_event)
	PuzzleManager.hotspot_state_changed.connect(_on_hotspot_state_changed)
	_cache_mesh()
	_update_visibility()


func _cache_mesh() -> void:
	for child in get_children():
		if child is MeshInstance3D:
			_mesh = child
			if child.material_override is StandardMaterial3D:
				_base_material = child.material_override.duplicate()
			break


func interact() -> void:
	if hotspot_id.is_empty():
		return
	interacted.emit(hotspot_id)


func get_cursor_hint() -> String:
	if not PuzzleManager.is_hotspot_available(hotspot_id):
		return "Locked"
	var action := PuzzleManager.get_hotspot_action(hotspot_id)
	match action:
		"pickup":
			return "Take"
		"open_puzzle":
			return "Use"
		"use_item":
			return "Use item"
		_:
			return "Examine"


func _on_mouse_entered() -> void:
	if _mesh and _highlight_material:
		_mesh.material_override = _highlight_material


func _on_mouse_exited() -> void:
	if _mesh and _base_material:
		_mesh.material_override = _base_material


func _on_input_event(
	_camera: Node,
	event: InputEvent,
	_position: Vector3,
	_normal: Vector3,
	_shape_idx: int
) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		interact()


func _on_hotspot_state_changed(changed_id: String) -> void:
	if changed_id == hotspot_id or changed_id.is_empty():
		_update_visibility()


func _update_visibility() -> void:
	var def := PuzzleManager.get_hotspot_def(hotspot_id)
	visible = not def.get("disabled", false)


func set_highlight_material(mat: StandardMaterial3D) -> void:
	_highlight_material = mat
	_base_material = mat.duplicate()
	_base_material.emission_enabled = false
	if _mesh:
		_mesh.material_override = _base_material
