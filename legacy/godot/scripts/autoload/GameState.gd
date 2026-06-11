extends Node
## GameState — global flags, puzzle progress, win state.

signal flag_changed(flag_name: String, value: bool)
signal puzzle_solved(puzzle_id: String)
signal game_won

var flags: Dictionary = {}
var solved_puzzles: Array[String] = []
var current_room: String = "bedroom"
var has_won: bool = false


func set_flag(flag_name: String, value: bool = true) -> void:
	if flags.get(flag_name, false) == value:
		return
	flags[flag_name] = value
	flag_changed.emit(flag_name, value)
	NarrativeManager.on_flag(flag_name)
	PuzzleManager.on_flag_changed(flag_name)
	if flag_name == "door_unlocked" and value:
		_win()


func has_flag(flag_name: String) -> bool:
	return flags.get(flag_name, false)


func mark_puzzle_solved(puzzle_id: String) -> void:
	if puzzle_id in solved_puzzles:
		return
	solved_puzzles.append(puzzle_id)
	puzzle_solved.emit(puzzle_id)


func is_puzzle_solved(puzzle_id: String) -> bool:
	return puzzle_id in solved_puzzles


func reset() -> void:
	flags.clear()
	solved_puzzles.clear()
	has_won = false
	current_room = "bedroom"


func get_save_data() -> Dictionary:
	return {
		"flags": flags.duplicate(),
		"solved_puzzles": solved_puzzles.duplicate(),
		"has_won": has_won,
		"current_room": current_room,
	}


func load_save_data(data: Dictionary) -> void:
	flags = data.get("flags", {}).duplicate()
	solved_puzzles.assign(data.get("solved_puzzles", []))
	has_won = data.get("has_won", false)
	current_room = data.get("current_room", "bedroom")


func _win() -> void:
	if has_won:
		return
	has_won = true
	game_won.emit()
	NarrativeManager.on_win()
