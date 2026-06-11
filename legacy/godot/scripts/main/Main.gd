extends Node3D
## Main — wires room, player, input, HUD, and interaction flow.

@onready var _player: PlayerMover = $Player
@onready var _camera_rig: CameraIso = $IsoCameraRig
@onready var _player_input: PlayerInput = $PlayerInput
@onready var _hud: CanvasLayer = $HUD
@onready var _room: RoomBuilder = $Bedroom

var _ui: Dictionary = {}


func _ready() -> void:
	_player_input.camera = _camera_rig.get_node("Camera3D")
	_player_input.player = _player
	_player_input.hotspot_root = _room.get_node("Hotspots")
	_player_input.move_requested.connect(_on_move_requested)
	_player_input.hotspot_clicked.connect(_on_hotspot_clicked)
	_cache_ui()
	_connect_signals()
	_player.global_position = Vector3(0, 0, 2)


func _cache_ui() -> void:
	_ui = {
		"examine": _hud.get_node("ExaminePanel"),
		"journal": _hud.get_node("JournalPanel"),
		"thought": _hud.get_node("ThoughtToast"),
		"inventory": _hud.get_node("InventoryBar"),
		"cursor": _hud.get_node("CursorLabel"),
		"clock": _hud.get_node("PuzzleLayer/ClockPuzzleUI"),
		"photo": _hud.get_node("PuzzleLayer/PhotoCipherUI"),
		"combine": _hud.get_node("PuzzleLayer/CombineTrayUI"),
		"padlock": _hud.get_node("PuzzleLayer/PadlockUI"),
		"win": _hud.get_node("WinOverlay"),
	}


func _connect_signals() -> void:
	NarrativeManager.examine_shown.connect(_on_examine_shown)
	NarrativeManager.thought_shown.connect(_on_thought_shown)
	NarrativeManager.journal_updated.connect(_on_journal_updated)
	NarrativeManager.win_narrative_shown.connect(_on_win_shown)
	PuzzleManager.puzzle_open_requested.connect(_on_puzzle_open_requested)
	GameState.game_won.connect(_on_game_won)
	_ui["clock"].puzzle_submitted.connect(_on_clock_submitted)
	_ui["photo"].puzzle_submitted.connect(_on_photo_submitted)
	_ui["padlock"].puzzle_submitted.connect(_on_padlock_submitted)
	_ui["combine"].combine_requested.connect(_on_combine_requested)
	for hotspot in _room.get_node("Hotspots").get_children():
		if hotspot is Hotspot:
			hotspot.interacted.connect(_on_hotspot_clicked)


func _on_move_requested(target: Vector3) -> void:
	_player.move_to(target)


func _on_hotspot_clicked(hotspot_id: String) -> void:
	AudioManager.play_sfx("click")
	var action := PuzzleManager.get_hotspot_action(hotspot_id)
	if action == "locked":
		NarrativeManager.show_thought("locked_hint")
		return
	if not InventoryManager.selected_item.is_empty():
		if PuzzleManager.try_use_item_on_hotspot(InventoryManager.selected_item, hotspot_id):
			return
	match action:
		"pickup":
			_handle_pickup(hotspot_id)
		"open_puzzle":
			_open_puzzle_for_hotspot(hotspot_id)
		"combine":
			_ui["combine"].open()
		"examine":
			_handle_examine(hotspot_id)
		_:
			NarrativeManager.on_examine(hotspot_id)


func _handle_examine(hotspot_id: String) -> void:
	match hotspot_id:
		"desk_drawer":
			if GameState.has_flag("desk_drawer_unlocked"):
				if not InventoryManager.has_item("photo_set"):
					InventoryManager.add_item("photo_set")
				if not InventoryManager.has_item("receipt_stub"):
					InventoryManager.add_item("receipt_stub")
		"wall_safe":
			if GameState.has_flag("painting_moved") and not InventoryManager.has_item("key_blade"):
				InventoryManager.add_item("key_blade")
	NarrativeManager.on_examine(hotspot_id)


func _handle_pickup(hotspot_id: String) -> void:
	var def := PuzzleManager.get_hotspot_def(hotspot_id)
	var item_id: String = def.get("item", "")
	if item_id.is_empty():
		NarrativeManager.on_examine(hotspot_id)
		return
	if InventoryManager.add_item(item_id):
		PuzzleManager.apply_consequence("disable_hotspot:%s" % hotspot_id)
		NarrativeManager.on_examine(hotspot_id)


func _open_puzzle_for_hotspot(hotspot_id: String) -> void:
	var def := PuzzleManager.get_hotspot_def(hotspot_id)
	var puzzle_id: String = def.get("puzzle", "")
	if puzzle_id.is_empty():
		NarrativeManager.on_examine(hotspot_id)
		return
	_camera_rig.focus_on(_player.global_position)
	PuzzleManager.request_puzzle(puzzle_id)


func _on_puzzle_open_requested(puzzle_id: String, puzzle_type: String) -> void:
	match puzzle_type:
		"clock":
			_ui["clock"].open(puzzle_id)
		"photo_cipher":
			_ui["photo"].open(puzzle_id)
		"padlock":
			_ui["padlock"].open(puzzle_id)
		_:
			pass


func _on_clock_submitted(puzzle_id: String, hour: int, minute: int) -> void:
	if PuzzleManager.submit_puzzle(puzzle_id, {"hour": hour, "minute": minute}):
		_ui["clock"].close()


func _on_photo_submitted(puzzle_id: String, answer: String) -> void:
	if PuzzleManager.submit_puzzle(puzzle_id, answer):
		_ui["photo"].close()


func _on_padlock_submitted(puzzle_id: String, answer: String) -> void:
	if PuzzleManager.submit_puzzle(puzzle_id, answer):
		_ui["padlock"].close()


func _on_combine_requested(item_a: String, item_b: String) -> void:
	InventoryManager.try_combine(item_a, item_b)


func _on_examine_shown(title: String, body: String) -> void:
	_ui["examine"].show_entry(title, body)


func _on_thought_shown(text: String) -> void:
	_ui["thought"].show_thought(text)


func _on_journal_updated() -> void:
	_ui["journal"].refresh()


func _on_game_won() -> void:
	AudioManager.play_sfx("door_unlock")


func _on_win_shown(title: String, body: String) -> void:
	_ui["win"].show_overlay(true, title, body)
	SaveLoad.delete_save()


func _process(_delta: float) -> void:
	_update_cursor()
