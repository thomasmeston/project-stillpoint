extends Button
## InventorySlot — single inventory item button.

signal clicked(item_id: String)

var item_id: String = ""


func setup(id: String) -> void:
	item_id = id
	text = InventoryManager.get_item_label(id)
	pressed.connect(func(): clicked.emit(item_id))


func set_selected(selected: bool) -> void:
	modulate = Color(1.2, 1.2, 0.9) if selected else Color.WHITE
