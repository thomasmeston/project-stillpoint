extends Node
## AudioManager — optional SFX and ambient playback.

var _ambient: AudioStreamPlayer
var _sfx: AudioStreamPlayer


func _ready() -> void:
	_ambient = AudioStreamPlayer.new()
	_ambient.bus = "Master"
	_ambient.volume_db = -12.0
	add_child(_ambient)
	_sfx = AudioStreamPlayer.new()
	add_child(_sfx)
	_try_play_ambient()


func play_sfx(stream_name: String) -> void:
	var path := "res://audio/%s.ogg" % stream_name
	if not ResourceLoader.exists(path):
		return
	_sfx.stream = load(path)
	_sfx.play()


func _try_play_ambient() -> void:
	var path := "res://audio/ambient_bedroom.ogg"
	if ResourceLoader.exists(path):
		_ambient.stream = load(path)
		_ambient.play()
