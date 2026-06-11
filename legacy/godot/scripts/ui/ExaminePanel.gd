extends PanelContainer
## ExaminePanel — shows object examination text.

@onready var _title: Label = $Margin/VBox/Title
@onready var _body: RichTextLabel = $Margin/VBox/Body
@onready var _close: Button = $Margin/VBox/CloseButton


func _ready() -> void:
	visible = false
	_close.pressed.connect(func(): visible = false)


func show_entry(title: String, body: String) -> void:
	_title.text = title
	_body.text = body
	visible = true
