extends Node
## DataLoader — JSON file loading with cache.

var _cache: Dictionary = {}


func load_json(path: String, use_cache: bool = true) -> Dictionary:
	if use_cache and _cache.has(path):
		return _cache[path]
	if not FileAccess.file_exists(path):
		push_error("[DataLoader] Missing file: %s" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("[DataLoader] Cannot open: %s" % path)
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("[DataLoader] Invalid JSON object: %s" % path)
		return {}
	if use_cache:
		_cache[path] = parsed
	return parsed


func clear_cache() -> void:
	_cache.clear()
