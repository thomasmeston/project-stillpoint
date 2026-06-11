extends Node3D
## RoomLighting — ambient and key lights from room data.

const ROOM_DATA_PATH := "res://data/rooms/bedroom.json"


func _ready() -> void:
	var data := DataLoader.load_json(ROOM_DATA_PATH)
	var lighting: Dictionary = data.get("lighting", {})
	_add_world_light()
	for key in lighting.keys():
		var spec: Dictionary = lighting[key]
		_add_point_light(spec)


func _add_world_light() -> void:
	var env := WorldEnvironment.new()
	var environment := Environment.new()
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.25, 0.27, 0.32)
	environment.ambient_light_energy = 0.45
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = environment
	add_child(env)


func _add_point_light(spec: Dictionary) -> void:
	var light := OmniLight3D.new()
	var pos: Array = spec.get("position", [0, 2, 0])
	light.position = Vector3(pos[0], pos[1], pos[2])
	light.light_color = Color(spec.get("color", "#ffffff"))
	light.light_energy = spec.get("energy", 1.0)
	light.omni_range = 4.0
	light.shadow_enabled = true
	add_child(light)
