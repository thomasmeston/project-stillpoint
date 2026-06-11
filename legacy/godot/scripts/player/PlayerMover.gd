extends CharacterBody3D
## PlayerMover — click-to-move via NavigationAgent3D.

@export var move_speed: float = 4.0
@export var stop_distance: float = 0.25

var _agent: NavigationAgent3D
var _moving: bool = false


func _ready() -> void:
	_agent = $NavigationAgent3D
	_agent.path_desired_distance = 0.2
	_agent.target_desired_distance = stop_distance
	_agent.avoidance_enabled = false
	await get_tree().physics_frame
	_agent.target_position = global_position


func _physics_process(delta: float) -> void:
	if not _moving:
		return
	if _agent.is_navigation_finished():
		_moving = false
		velocity = Vector3.ZERO
		return
	var next_pos := _agent.get_next_path_position()
	var direction := (next_pos - global_position)
	direction.y = 0.0
	if direction.length() < 0.05:
		return
	direction = direction.normalized()
	velocity = direction * move_speed
	move_and_slide()
	var look_target := global_position + direction
	look_at(Vector3(look_target.x, global_position.y, look_target.z), Vector3.UP)


func move_to(target: Vector3) -> void:
	_agent.target_position = target
	_moving = true


func stop() -> void:
	_moving = false
	velocity = Vector3.ZERO
	_agent.target_position = global_position
