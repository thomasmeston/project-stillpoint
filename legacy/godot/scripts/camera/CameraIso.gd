extends Node3D
## CameraIso — orthographic isometric camera with clamped pan.

@export var min_bounds: Vector3 = Vector3(-4, 0, -3)
@export var max_bounds: Vector3 = Vector3(4, 0, 5)
@export var zoom_min: float = 8.0
@export var zoom_max: float = 14.0
@export var zoom_step: float = 0.5

@onready var _camera: Camera3D = $Camera3D

var _dragging: bool = false
var _last_mouse: Vector2


func _ready() -> void:
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.size = 10.0
	rotation_degrees = Vector3(-35, 45, 0)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_MIDDLE:
			_dragging = event.pressed
			_last_mouse = event.position
		elif event.pressed:
			if event.button_index == MOUSE_BUTTON_WHEEL_UP:
				_camera.size = clamp(_camera.size - zoom_step, zoom_min, zoom_max)
			elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				_camera.size = clamp(_camera.size + zoom_step, zoom_min, zoom_max)
	if event is InputEventMouseMotion and _dragging:
		var delta: Vector2 = event.position - _last_mouse
		_last_mouse = event.position
		_pan_camera(delta)


func focus_on(target: Vector3, duration: float = 0.35) -> void:
	var tween := create_tween()
	var desired := Vector3(
		clamp(target.x, min_bounds.x, max_bounds.x),
		global_position.y,
		clamp(target.z, min_bounds.z, max_bounds.z)
	)
	tween.tween_property(self, "global_position", desired, duration).set_trans(Tween.TRANS_SINE)


func _pan_camera(screen_delta: Vector2) -> void:
	var right := global_transform.basis.x
	var forward := -global_transform.basis.z
	var move := (-right * screen_delta.x + forward * screen_delta.y) * 0.01
	global_position += Vector3(move.x, 0.0, move.z)
	global_position.x = clamp(global_position.x, min_bounds.x, max_bounds.x)
	global_position.z = clamp(global_position.z, min_bounds.z, max_bounds.z)
