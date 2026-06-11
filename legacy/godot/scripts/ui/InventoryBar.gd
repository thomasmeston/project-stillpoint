extends HBoxContainer
## InventoryBar — bottom item bar with selection.

signal item_clicked(item_id: String)

const SLOT_SCENE := preload("res://scenes/ui/InventorySlot.tscn")


func _ready() -> void:
	InventoryManager.inventory_changed.connect(_rebuild)
	InventoryManager.item_selected.connect(_on_item_selected)
	_rebuild()


func _rebuild() -> void:
	for child in get_children():
		child.queue_free()
	for item_id in InventoryManager.items:
		var slot := SLOT_SCENE.instantiate()
		slot.setup(item_id)
		slot.clicked.connect(_on_slot_clicked)
		add_child(slot)
	_on_item_selected(InventoryManager.selected_item)


func _on_slot_clicked(item_id: String) -> void:
	InventoryManager.select_item(item_id)
	item_clicked.emit(item_id)


func _on_item_selected(item_id: String) -> void:
	for child in get_children():
		if child.has_method("set_selected"):
			child.set_selected(child.item_id == item_id)
