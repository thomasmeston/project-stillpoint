extends Label
## CursorLabel — shows interaction hint near mouse.


func _process(_delta: float) -> void:
	position = get_viewport().get_mouse_position() + Vector2(16, 16)
	var hotspot := _hotspot_under_mouse()
	if hotspot:
		text = hotspot.get_cursor_hint()
	else:
		text = "Walk"


func _hotspot_under_mouse() -> Hotspot:
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		return null
	var mouse := get_viewport().get_mouse_position()
	var origin := camera.project_ray_origin(mouse)
	var direction := camera.project_ray_normal(mouse)
	var space := get_viewport().get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * 100.0)
	query.collision_mask = 2
	var result := space.intersect_ray(query)
	if result.is_empty():
		return null
	var node: Node = result.collider as Node
	while node:
		if node is Hotspot:
			return node
		node = node.get_parent()
	return null
