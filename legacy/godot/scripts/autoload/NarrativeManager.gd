extends Node
## NarrativeManager — examine text, journal, thoughts, ending.

signal examine_shown(title: String, body: String)
signal thought_shown(text: String)
signal journal_updated
signal win_narrative_shown(title: String, body: String)

const STORY_PATH := "res://data/story/bedroom-script.json"

var _data: Dictionary = {}
var _journal_entries: Dictionary = {}
var _triggered: Dictionary = {}
var _opening_shown: bool = false


func _ready() -> void:
	_data = DataLoader.load_json(STORY_PATH)


func on_first_input() -> void:
	if _opening_shown:
		return
	_opening_shown = true
	var opening: String = _data.get("opening_thought", "")
	if not opening.is_empty():
		show_thought(opening)


func on_examine(hotspot_id: String) -> void:
	var examines: Dictionary = _data.get("examines", {})
	if not examines.has(hotspot_id):
		return
	var entry: Dictionary = examines[hotspot_id]
	examine_shown.emit(entry.get("title", hotspot_id), entry.get("body", ""))
	_fire_trigger("examine:%s" % hotspot_id, entry)


func on_flag(flag_name: String) -> void:
	var flag_entries: Dictionary = _data.get("on_flag", {})
	if flag_entries.has(flag_name):
		_fire_trigger("flag:%s" % flag_name, flag_entries[flag_name])


func on_win() -> void:
	var ending: Dictionary = _data.get("ending", {})
	win_narrative_shown.emit(ending.get("title", "Escaped"), ending.get("body", ""))
	if ending.has("journal_id"):
		add_journal_entry(str(ending["journal_id"]))


func show_thought(thought_id: String) -> void:
	if thought_id.is_empty():
		return
	var thoughts: Dictionary = _data.get("thoughts", {})
	if thoughts.has(thought_id):
		thought_shown.emit(thoughts[thought_id])
	else:
		thought_shown.emit(thought_id)


func add_journal_entry(entry_id: String) -> void:
	if _journal_entries.has(entry_id):
		return
	var entries: Dictionary = _data.get("journal_entries", {})
	if not entries.has(entry_id):
		return
	_journal_entries[entry_id] = entries[entry_id]
	journal_updated.emit()
	show_thought(entries[entry_id].get("thought", ""))


func get_journal_list() -> Array:
	var result: Array = []
	for entry_id in _journal_entries.keys():
		var entry: Dictionary = _journal_entries[entry_id]
		result.append({
			"id": entry_id,
			"title": entry.get("title", entry_id),
			"body": entry.get("body", ""),
		})
	result.sort_custom(func(a, b): return a["id"] < b["id"])
	return result


func _fire_trigger(trigger_key: String, entry: Dictionary) -> void:
	if _triggered.get(trigger_key, false):
		pass
	else:
		_triggered[trigger_key] = true
	if entry.has("thought"):
		show_thought(str(entry["thought"]))
	if entry.has("journal"):
		add_journal_entry(str(entry["journal"]))


func get_save_data() -> Dictionary:
	return {
		"journal_entries": _journal_entries.duplicate(),
		"triggered": _triggered.duplicate(),
		"opening_shown": _opening_shown,
	}


func load_save_data(data: Dictionary) -> void:
	_journal_entries = data.get("journal_entries", {}).duplicate()
	_triggered = data.get("triggered", {}).duplicate()
	_opening_shown = data.get("opening_shown", false)
	journal_updated.emit()
