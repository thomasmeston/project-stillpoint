extends CanvasLayer
## HUDRoot — applies consistent UI styling for polish.

func _ready() -> void:
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.12, 0.14, 0.18, 0.92)
	panel_style.border_color = Color(0.45, 0.4, 0.32, 0.8)
	panel_style.set_border_width_all(1)
	panel_style.set_corner_radius_all(6)
	panel_style.content_margin_left = 8
	panel_style.content_margin_right = 8
	panel_style.content_margin_top = 8
	panel_style.content_margin_bottom = 8
	for node in find_children("*", "PanelContainer", true, false):
		node.add_theme_stylebox_override("panel", panel_style)
