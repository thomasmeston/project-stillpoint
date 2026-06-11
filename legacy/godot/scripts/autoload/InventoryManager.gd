extends Node
## InventoryManager — item storage, selection, combine rules.

signal inventory_changed
signal item_selected(item_id: String)
signal combine_failed(item_a: String, item_b: String)

const ITEMS_PATH := "res://data/items.json"

var items: Array[String] = []
var selected_item: String = ""
var _item_defs: Dictionary = {}
var _combine_rules: Array = []


func _ready() -> void:
	_load_definitions()


func _load_definitions() -> void:
	var data := DataLoader.load_json(ITEMS_PATH)
	_item_defs = data.get("items", {})
	_combine_rules = data.get("combine_rules", [])


func get_item_def(item_id: String) -> Dictionary:
	return _item_defs.get(item_id, {})


func get_item_label(item_id: String) -> String:
	return get_item_def(item_id).get("label", item_id)


func has_item(item_id: String) -> bool:
	return item_id in items


func add_item(item_id: String) -> bool:
	if item_id.is_empty() or has_item(item_id):
		return false
	if not _item_defs.has(item_id):
		push_warning("[Inventory] Unknown item: %s" % item_id)
	items.append(item_id)
	inventory_changed.emit()
	return true


func remove_item(item_id: String) -> bool:
	if not has_item(item_id):
		return false
	items.erase(item_id)
	if selected_item == item_id:
		selected_item = ""
	inventory_changed.emit()
	return true


func select_item(item_id: String) -> void:
	if item_id.is_empty():
		selected_item = ""
		item_selected.emit("")
		return
	if not has_item(item_id):
		return
	selected_item = item_id if selected_item != item_id else ""
	item_selected.emit(selected_item)


func try_combine(item_a: String, item_b: String) -> String:
	if item_a == item_b:
		return ""
	for rule in _combine_rules:
		var inputs: Array = rule.get("inputs", [])
		if inputs.size() < 2:
			continue
		var a: String = inputs[0]
		var b: String = inputs[1]
		if (item_a == a and item_b == b) or (item_a == b and item_b == a):
			if has_item(a) and has_item(b):
				var result: String = rule.get("result", "")
				remove_item(a)
				remove_item(b)
				add_item(result)
				for consequence in rule.get("on_success", []):
					PuzzleManager.apply_consequence(consequence)
				return result
	combine_failed.emit(item_a, item_b)
	return ""


func get_save_data() -> Dictionary:
	return {
		"items": items.duplicate(),
		"selected_item": selected_item,
	}


func load_save_data(data: Dictionary) -> void:
	items.assign(data.get("items", []))
	selected_item = data.get("selected_item", "")
	inventory_changed.emit()
