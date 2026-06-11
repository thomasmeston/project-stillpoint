extends ColorRect
## WinOverlay — end screen after escape.

@onready var _title: Label = $Panel/Margin/VBox/Title
@onready var _body: RichTextLabel = $Panel/Margin/VBox/Body
@onready var _restart: Button = $Panel/Margin/VBox/Restart


func _ready() -> void:
	visible = false
	_restart.pressed.connect(_on_restart)


func show_overlay(with_text: bool, title: String = "", body: String = "") -> void:
	visible = true
	if with_text:
		_title.text = title
		_body.text = body
	else:
		_title.text = "The door opens."
		_body.text = "..."


func _on_restart() -> void:
	get_tree().reload_current_scene()
