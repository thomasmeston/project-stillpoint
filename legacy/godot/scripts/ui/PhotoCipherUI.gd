extends PanelContainer
## PhotoCipherUI — reorder photo tiles to spell cipher word.

signal puzzle_submitted(puzzle_id: String, answer: String)

@onready var _tiles: HBoxContainer = $Margin/VBox/Tiles
@onready var _submit: Button = $Margin/VBox/Submit
@onready var _close: Button = $Margin/VBox/Close
@onready var _hint: Label = $Margin/VBox/Hint

var _puzzle_id: String = ""
var _letters: Array[String] = ["S", "T", "I", "L", "L"]


func _ready() -> void:
	visible = false
	_submit.pressed.connect(_on_submit)
	_close.pressed.connect(close)


func open(puzzle_id: String) -> void:
	_puzzle_id = puzzle_id
	_letters = ["L", "I", "T", "S", "L"]
	_rebuild_tiles()
	_hint.text = "Rearrange the photo backs to spell the word."
	visible = true


func close() -> void:
	visible = false


func _rebuild_tiles() -> void:
	for child in _tiles.get_children():
		child.queue_free()
	for i in range(_letters.size()):
		var btn := Button.new()
		btn.text = _letters[i]
		btn.custom_minimum_size = Vector2(48, 48)
		var index := i
		btn.pressed.connect(func(): _swap_with_next(index))
		_tiles.add_child(btn)


func _swap_with_next(index: int) -> void:
	var next := (index + 1) % _letters.size()
	var tmp := _letters[index]
	_letters[index] = _letters[next]
	_letters[next] = tmp
	_rebuild_tiles()


func _on_submit() -> void:
	var answer := "".join(_letters)
	puzzle_submitted.emit(_puzzle_id, answer)
