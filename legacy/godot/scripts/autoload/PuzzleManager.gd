extends Node
## PuzzleManager — loads puzzle data, gates, consequences.

signal gate_updated(hotspot_id: String)
signal puzzle_open_requested(puzzle_id: String, puzzle_type: String)
signal hotspot_state_changed(hotspot_id: String)

const PUZZLES_PATH := "res://data/puzzles/bedroom.json"

var _data: Dictionary = {}
var _puzzles: Dictionary = {}
var _gates: Dictionary = {}
var _hotspots: Dictionary = {}
var _item_uses: Array = []


func _ready() -> void:
	_load_data()


func _load_data() -> void:
	_data = DataLoader.load_json(PUZZLES_PATH)
	for puzzle in _data.get("puzzles", []):
		_puzzles[puzzle.get("id", "")] = puzzle
	for gate in _data.get("gates", []):
		_gates[gate.get("hotspot", "")] = gate
	for hotspot in _data.get("hotspots", []):
		_hotspots[hotspot.get("id", "")] = hotspot
	_item_uses = _data.get("item_uses", [])


func get_hotspot_def(hotspot_id: String) -> Dictionary:
	return _hotspots.get(hotspot_id, {})


func is_hotspot_available(hotspot_id: String) -> bool:
	var def := get_hotspot_def(hotspot_id)
	if def.is_empty():
		return true
	if def.get("disabled", false):
		return false
	if def.has("requires_flag") and not GameState.has_flag(def["requires_flag"]):
		return false
	if def.has("requires_puzzle") and not GameState.is_puzzle_solved(def["requires_puzzle"]):
		return false
	return _check_requirements(_gates.get(hotspot_id, {}).get("requires", []))


func get_hotspot_action(hotspot_id: String) -> String:
	if not is_hotspot_available(hotspot_id):
		return "locked"
	return get_hotspot_def(hotspot_id).get("action", "examine")


func _check_requirements(requirements: Array) -> bool:
	for req in requirements:
		if not _evaluate_requirement(str(req)):
			return false
	return true


func _evaluate_requirement(req: String) -> bool:
	if req.begins_with("flag:"):
		return GameState.has_flag(req.substr(5))
	if req.begins_with("not_flag:"):
		return not GameState.has_flag(req.substr(9))
	if req.begins_with("item:"):
		return InventoryManager.has_item(req.substr(5))
	if req.begins_with("puzzle:"):
		return GameState.is_puzzle_solved(req.substr(7))
	if req.begins_with("not_puzzle:"):
		return not GameState.is_puzzle_solved(req.substr(11))
	return true


func on_flag_changed(_flag_name: String) -> void:
	for hotspot_id in _hotspots.keys():
		hotspot_state_changed.emit(hotspot_id)


func request_puzzle(puzzle_id: String) -> void:
	if not _puzzles.has(puzzle_id):
		return
	if GameState.is_puzzle_solved(puzzle_id):
		return
	var puzzle: Dictionary = _puzzles[puzzle_id]
	puzzle_open_requested.emit(puzzle_id, puzzle.get("type", ""))


func submit_puzzle(puzzle_id: String, answer: Variant) -> bool:
	if not _puzzles.has(puzzle_id):
		return false
	if GameState.is_puzzle_solved(puzzle_id):
		return true
	var puzzle: Dictionary = _puzzles[puzzle_id]
	if not _validate_answer(puzzle, answer):
		return false
	GameState.mark_puzzle_solved(puzzle_id)
	for consequence in puzzle.get("on_success", []):
		apply_consequence(str(consequence))
	on_flag_changed("")
	return true


func _validate_answer(puzzle: Dictionary, answer: Variant) -> bool:
	var puzzle_type: String = puzzle.get("type", "")
	match puzzle_type:
		"clock":
			if typeof(answer) != TYPE_DICTIONARY:
				return false
			var solution: Dictionary = puzzle.get("solution", {})
			return int(answer.get("hour", -1)) == int(solution.get("hour", -2)) \
				and int(answer.get("minute", -1)) == int(solution.get("minute", -2))
		"photo_cipher":
			return str(answer).to_upper() == str(puzzle.get("solution", "")).to_upper()
		"padlock":
			return str(answer).to_upper().replace("-", "") == str(puzzle.get("solution", "")).to_upper().replace("-", "")
		_:
			return false


func apply_consequence(consequence: String) -> void:
	if consequence.begins_with("set_flag:"):
		GameState.set_flag(consequence.substr(9))
	elif consequence.begins_with("clear_flag:"):
		GameState.set_flag(consequence.substr(11), false)
	elif consequence.begins_with("give_item:"):
		InventoryManager.add_item(consequence.substr(10))
	elif consequence.begins_with("remove_item:"):
		InventoryManager.remove_item(consequence.substr(12))
	elif consequence.begins_with("journal:"):
		NarrativeManager.add_journal_entry(consequence.substr(8))
	elif consequence.begins_with("thought:"):
		NarrativeManager.show_thought(consequence.substr(8))
	elif consequence.begins_with("disable_hotspot:"):
		_disable_hotspot(consequence.substr(16))
	elif consequence.begins_with("enable_hotspot:"):
		_enable_hotspot(consequence.substr(15))


func try_use_item_on_hotspot(item_id: String, hotspot_id: String) -> bool:
	for use_def in _item_uses:
		if use_def.get("item", "") != item_id or use_def.get("hotspot", "") != hotspot_id:
			continue
		if not _check_requirements(use_def.get("requires", [])):
			return false
		for consequence in use_def.get("on_success", []):
			apply_consequence(str(consequence))
		if use_def.get("consume_item", false):
			InventoryManager.remove_item(item_id)
		InventoryManager.select_item("")
		return true
	return false


func _disable_hotspot(hotspot_id: String) -> void:
	if _hotspots.has(hotspot_id):
		_hotspots[hotspot_id]["disabled"] = true
		hotspot_state_changed.emit(hotspot_id)


func _enable_hotspot(hotspot_id: String) -> void:
	if _hotspots.has(hotspot_id):
		_hotspots[hotspot_id]["disabled"] = false
		hotspot_state_changed.emit(hotspot_id)
