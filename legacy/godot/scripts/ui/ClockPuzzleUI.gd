extends PanelContainer
## ClockPuzzleUI — set hour/minute hands for clock puzzle.

signal puzzle_submitted(puzzle_id: String, hour: int, minute: int)

@onready var _hour: SpinBox = $Margin/VBox/Hour
@onready var _minute: SpinBox = $Margin/VBox/Minute
@onready var _submit: Button = $Margin/VBox/Submit
@onready var _close: Button = $Margin/VBox/Close

var _puzzle_id: String = ""


func _ready() -> void:
	visible = false
	_hour.min_value = 1
	_hour.max_value = 12
	_minute.min_value = 0
	_minute.max_value = 59
	_submit.pressed.connect(_on_submit)
	_close.pressed.connect(close)


func open(puzzle_id: String) -> void:
	_puzzle_id = puzzle_id
	_hour.value = 12
	_minute.value = 0
	visible = true


func close() -> void:
	visible = false


func _on_submit() -> void:
	puzzle_submitted.emit(_puzzle_id, int(_hour.value), int(_minute.value))
