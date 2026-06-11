extends PanelContainer
## JournalPanel — clue log sidebar.

@onready var _list: ItemList = $Margin/VBox/List
@onready var _detail: RichTextLabel = $Margin/VBox/Detail
@onready var _toggle: Button = $Margin/VBox/ToggleButton


func _ready() -> void:
	visible = false
	_toggle.pressed.connect(_on_toggle)
	_list.item_selected.connect(_on_item_selected)
	refresh()


func refresh() -> void:
	_list.clear()
	for entry in NarrativeManager.get_journal_list():
		_list.add_item(entry["title"])
	_list.select(0 if _list.item_count > 0 else -1)
	_on_item_selected(0 if _list.item_count > 0 else -1)


func toggle_panel() -> void:
	visible = not visible
	if visible:
		refresh()


func _on_toggle() -> void:
	toggle_panel()


func _on_item_selected(index: int) -> void:
	if index < 0:
		_detail.text = ""
		return
	var entries := NarrativeManager.get_journal_list()
	if index >= entries.size():
		return
	_detail.text = entries[index]["body"]
