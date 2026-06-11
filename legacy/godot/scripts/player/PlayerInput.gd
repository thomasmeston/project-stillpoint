extends Node
## PlayerInput — dispatches click-to-move and hotspot interaction.

signal move_requested(target: Vector3)
signal hotspot_clicked(hotspot_id: String)

@export var camera: Camera3D
@export var player: CharacterBody3D
@export var hotspot_root: Node3D

var _first_input: bool = false


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_click(event.position)


func _handle_click(screen_pos: Vector2) -> void:
	if not _first_input:
		_first_input = true
		NarrativeManager.on_first_input()

	if _try_hotspot_click(screen_pos):
		return
	_try_floor_click(screen_pos)


func _try_hotspot_click(screen_pos: Vector2) -> bool:
	if camera == null:
		return false
	var origin := camera.project_ray_origin(screen_pos)
	var direction := camera.project_ray_normal(screen_pos)
	var space := get_viewport().get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * 100.0)
	query.collision_mask = 2
	var result := space.intersect_ray(query)
	if result.is_empty():
		return false
	var collider: Object = result.collider
	var hotspot: Hotspot = _find_hotspot(collider)
	if hotspot == null:
		return false
	hotspot_clicked.emit(hotspot.hotspot_id)
	return true


func _find_hotspot(node: Object) -> Hotspot:
	var current: Node = node as Node
	while current:
		if current is Hotspot:
			return current
		current = current.get_parent()
	return null


func _try_floor_click(screen_pos: Vector2) -> void:
	if camera == null:
		return
	var origin := camera.project_ray_origin(screen_pos)
	var direction := camera.project_ray_normal(screen_pos)
	var space := get_viewport().get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * 100.0)
	query.collision_mask = 1
	var result := space.intersect_ray(query)
	if result.is_empty():
		return
	move_requested.emit(result.position)
