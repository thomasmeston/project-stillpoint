extends PanelContainer
## PadlockUI — text entry padlock for door chain.

signal puzzle_submitted(puzzle_id: String, answer: String)

@onready var _entry: LineEdit = $Margin/VBox/Entry
@onready var _submit: Button = $Margin/VBox/Submit
@onready var _close: Button = $Margin/VBox/Close
@onready var _hint: Label = $Margin/VBox/Hint

var _puzzle_id: String = ""


func _ready() -> void:
	visible = false
	_submit.pressed.connect(_on_submit)
	_close.pressed.connect(close)
	_entry.text_submitted.connect(func(_t): _on_submit())


func open(puzzle_id: String) -> void:
	_puzzle_id = puzzle_id
	_entry.text = ""
	_hint.text = "Enter the passphrase from the cipher disk and letter."
	visible = true


func close() -> void:
	visible = false


func _on_submit() -> void:
	puzzle_submitted.emit(_puzzle_id, _entry.text.strip_edges())
