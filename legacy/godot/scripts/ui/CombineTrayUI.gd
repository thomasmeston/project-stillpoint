extends PanelContainer
## CombineTrayUI — combine two inventory items.

signal combine_requested(item_a: String, item_b: String)

@onready var _slot_a: OptionButton = $Margin/VBox/SlotA
@onready var _slot_b: OptionButton = $Margin/VBox/SlotB
@onready var _combine: Button = $Margin/VBox/Combine
@onready var _close: Button = $Margin/VBox/Close


func _ready() -> void:
	visible = false
	_combine.pressed.connect(_on_combine)
	_close.pressed.connect(close)
	InventoryManager.inventory_changed.connect(_refresh_options)


func open() -> void:
	_refresh_options()
	visible = true


func close() -> void:
	visible = false


func _refresh_options() -> void:
	for slot in [_slot_a, _slot_b]:
		slot.clear()
		slot.add_item("(select)")
		for item_id in InventoryManager.items:
			slot.add_item(InventoryManager.get_item_label(item_id))


func _on_combine() -> void:
	if _slot_a.selected <= 0 or _slot_b.selected <= 0:
		return
	var item_a := InventoryManager.items[_slot_a.selected - 1]
	var item_b := InventoryManager.items[_slot_b.selected - 1]
	combine_requested.emit(item_a, item_b)
	close()
