extends PanelContainer
## ThoughtToast — short inner monologue overlay.

@onready var _label: Label = $Margin/Label
var _timer: float = 0.0


func _ready() -> void:
	visible = false
	modulate.a = 0.0


func show_thought(text: String) -> void:
	_label.text = text
	visible = true
	_timer = 4.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, 0.25)


func _process(delta: float) -> void:
	if not visible or _timer <= 0.0:
		return
	_timer -= delta
	if _timer <= 0.0:
		var tween := create_tween()
		tween.tween_property(self, "modulate:a", 0.0, 0.35)
		tween.tween_callback(func(): visible = false)
