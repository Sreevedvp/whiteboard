use crate::models::element::{CommonObject, ShapeKind};
use crate::models::geometry::{Point2D, Rect2D, ResizeHandle};
use crate::models::id::ElementId;
use crate::models::manager::{HierarchyNode, ManagerClass};
use crate::models::style::{ColorRgba, FontStyle, RenderMode, StrokeStyle};
use crate::state::canvas_state::{CanvasState, DragMode, Tool};
use crate::storage::db::WhiteboardDb;
use crate::ui::theme::Theme;
use gpui::prelude::*;
use gpui::{
    canvas, div, fill, point, px, quad, size, BorderStyle, Bounds, ContentMask, Context,
    CursorStyle, IntoElement, MouseDownEvent, MouseMoveEvent, MouseUpEvent, PathBuilder, Render,
    ScrollWheelEvent, SharedString, Window,
};
use std::collections::{HashMap, HashSet};

pub struct WhiteboardView {
    pub state: CanvasState,
    pub db: Option<WhiteboardDb>,
    pub board_id: String,
    pub last_mouse_pos: Point2D,
}

impl WhiteboardView {
    pub fn new(_window: &mut Window, _cx: &mut Context<Self>) -> Self {
        let board_id = "default_board".to_string();
        let db = WhiteboardDb::open_or_create("whiteboard_desktop.db").ok();

        let mut elements = Vec::new();
        if let Some(ref db_conn) = db {
            if let Ok(loaded) = db_conn.load_elements(&board_id) {
                elements = loaded;
            }
        }

        // If no elements exist, initialize with a beautiful default layout matching the reference
        if elements.is_empty() {
            let container = CommonObject::new_rectangle(
                430.0,
                280.0,
                290.0,
                180.0,
                crate::models::style::ElementStyle {
                    stroke_color: ColorRgba::from_hex("#f59f00"),
                    fill_color: ColorRgba::from_hex("#fff9db"),
                    stroke_width: 2.0,
                    stroke_style: StrokeStyle::Solid,
                    corner_radius: 8.0,
                    render_mode: RenderMode::Polished,
                    font_style: FontStyle::Crayon,
                    font_size: 18.0,
                },
            );

            let txt = CommonObject::new_text(
                455.0,
                310.0,
                "text".to_string(),
                crate::models::style::ElementStyle {
                    stroke_color: ColorRgba::from_hex("#1e1e1e"),
                    fill_color: ColorRgba::TRANSPARENT,
                    stroke_width: 2.0,
                    stroke_style: StrokeStyle::Solid,
                    corner_radius: 0.0,
                    render_mode: RenderMode::Polished,
                    font_style: FontStyle::Crayon,
                    font_size: 22.0,
                },
            );

            let arrow = CommonObject::new_arrow(
                Point2D::new(670.0, 345.0),
                Point2D::new(765.0, 345.0),
                crate::models::style::ElementStyle {
                    stroke_color: ColorRgba::from_hex("#f59f00"),
                    fill_color: ColorRgba::TRANSPARENT,
                    stroke_width: 2.0,
                    stroke_style: StrokeStyle::Solid,
                    corner_radius: 0.0,
                    render_mode: RenderMode::Polished,
                    font_style: FontStyle::Crayon,
                    font_size: 18.0,
                },
            );

            elements = vec![container, txt, arrow];
            ManagerClass::recalculate_all_hierarchies(&mut elements);
        }

        let mut state = CanvasState::new();
        state.elements = elements;
        if let Some(first) = state.elements.first() {
            state.selected_ids.insert(first.id.clone());
        }

        Self {
            state,
            db,
            board_id,
            last_mouse_pos: Point2D::new(0.0, 0.0),
        }
    }

    pub fn auto_save(&mut self) {
        if let Some(ref mut db) = self.db {
            if let Ok(()) = db.save_elements(&self.board_id, &self.state.elements) {
                self.state.autosave_status = "Autosaved ✓".to_string();
                self.state.is_dirty = false;
            }
        }
    }

    // ==========================================
    // Mouse Event Handlers
    // ==========================================

    pub fn handle_mouse_down(
        &mut self,
        ev: &MouseDownEvent,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let mouse_screen = Point2D::new(ev.position.x.into(), ev.position.y.into());
        let mouse_canvas = self.state.screen_to_canvas(mouse_screen);
        self.last_mouse_pos = mouse_screen;

        // Close context menu if open
        self.state.context_menu = None;

        if ev.button == gpui::MouseButton::Right {
            // Right-click context menu
            let hit = self
                .state
                .hit_test_element(mouse_canvas)
                .map(|e| e.id.clone());
            if let Some(ref id) = hit {
                self.state.select_only(id.clone());
            }
            self.state.context_menu = Some((mouse_screen, hit));
            cx.notify();
            return;
        }

        if ev.button != gpui::MouseButton::Left {
            return;
        }

        match self.state.active_tool {
            Tool::Pan => {
                self.state.drag_mode = DragMode::Panning {
                    start_pan: self.state.pan,
                    start_mouse: mouse_screen,
                };
            }
            Tool::Select => {
                // Check if user clicked a resize handle
                if let Some((handle, id)) = self.state.hit_test_handle(mouse_canvas) {
                    if let Some(el) = self.state.elements.iter().find(|e| e.id == id) {
                        self.state.drag_mode = DragMode::Resizing {
                            handle,
                            target_id: id,
                            initial_bounds: el.bounds,
                        };
                        cx.notify();
                        return;
                    }
                }

                // Check if user clicked an element
                if let Some(el) = self.state.hit_test_element(mouse_canvas) {
                    let id = el.id.clone();
                    self.state.select_only(id.clone());

                    let mut move_ids = HashSet::new();
                    move_ids.insert(id.clone());
                    self.state.collect_all_descendants(&id, &mut move_ids);

                    let mut initial_positions = HashMap::new();
                    for m_id in &move_ids {
                        if let Some(e) = self.state.elements.iter().find(|e| &e.id == m_id) {
                            initial_positions.insert(e.id.clone(), e.bounds);
                        }
                    }

                    self.state.drag_mode = DragMode::Dragging {
                        start_mouse: mouse_canvas,
                        initial_positions,
                    };
                } else {
                    self.state.clear_selection();
                }
            }
            tool => {
                // Drawing a new shape
                self.state.drag_mode = DragMode::Drawing {
                    tool,
                    start_pos: mouse_canvas,
                    current_pos: mouse_canvas,
                };
            }
        }
        cx.notify();
    }

    pub fn handle_mouse_move(
        &mut self,
        ev: &MouseMoveEvent,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let mouse_screen = Point2D::new(ev.position.x.into(), ev.position.y.into());
        let mouse_canvas = self.state.screen_to_canvas(mouse_screen);
        self.last_mouse_pos = mouse_screen;

        match self.state.drag_mode.clone() {
            DragMode::None => {
                // Update cursor based on hover
                let cursor = match self.state.active_tool {
                    Tool::Pan => CursorStyle::OpenHand,
                    Tool::Select => {
                        if let Some((handle, _)) = self.state.hit_test_handle(mouse_canvas) {
                            handle.cursor_style()
                        } else if self.state.hit_test_element(mouse_canvas).is_some() {
                            CursorStyle::PointingHand
                        } else {
                            CursorStyle::Arrow
                        }
                    }
                    _ => CursorStyle::Crosshair,
                };
                if self.state.hover_cursor != cursor {
                    self.state.hover_cursor = cursor;
                    cx.notify();
                }
            }
            DragMode::Panning {
                start_pan,
                start_mouse,
            } => {
                let dx = mouse_screen.x - start_mouse.x;
                let dy = mouse_screen.y - start_mouse.y;
                self.state.pan = Point2D::new(start_pan.x + dx, start_pan.y + dy);
                self.state.hover_cursor = CursorStyle::ClosedHand;
                cx.notify();
            }
            DragMode::Dragging {
                start_mouse,
                initial_positions,
            } => {
                let dx = mouse_canvas.x - start_mouse.x;
                let dy = mouse_canvas.y - start_mouse.y;

                for (id, initial_box) in &initial_positions {
                    if let Some(el) = self.state.elements.iter_mut().find(|e| &e.id == id) {
                        let cur_center = el.bounds.center();
                        let target_center = initial_box.center() + Point2D::new(dx, dy);
                        let delta = target_center - cur_center;
                        el.translate(delta);
                    }
                }
                self.state.is_dirty = true;
                self.state.hover_cursor = CursorStyle::PointingHand;
                cx.notify();
            }
            DragMode::Resizing {
                handle, target_id, ..
            } => {
                if let Some(el) = self.state.elements.iter_mut().find(|e| e.id == target_id) {
                    el.resize(handle, mouse_canvas);
                }
                self.state.recalculate_hierarchy();
                self.state.is_dirty = true;
                // Cursor locked to handle's resize cursor during resize
                self.state.hover_cursor = handle.cursor_style();
                cx.notify();
            }
            DragMode::Drawing {
                tool, start_pos, ..
            } => {
                self.state.drag_mode = DragMode::Drawing {
                    tool,
                    start_pos,
                    current_pos: mouse_canvas,
                };
                self.state.hover_cursor = CursorStyle::Crosshair;
                cx.notify();
            }
        }
    }

    pub fn handle_mouse_up(
        &mut self,
        _ev: &MouseUpEvent,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if let DragMode::Drawing {
            tool,
            start_pos,
            current_pos,
        } = self.state.drag_mode.clone()
        {
            let min_x = start_pos.x.min(current_pos.x);
            let min_y = start_pos.y.min(current_pos.y);
            let width = (start_pos.x - current_pos.x).abs().max(40.0);
            let height = (start_pos.y - current_pos.y).abs().max(30.0);

            let style = self.state.current_style.clone();
            let new_el = match tool {
                Tool::Rectangle => CommonObject::new_rectangle(min_x, min_y, width, height, style),
                Tool::Polygon => CommonObject::new_diamond(min_x, min_y, width, height, style),
                Tool::Ellipse => CommonObject::new_ellipse(min_x, min_y, width, height, style),
                Tool::Arrow => CommonObject::new_arrow(start_pos, current_pos, style),
                Tool::Text => {
                    CommonObject::new_text(min_x, min_y, "Text Instance".to_string(), style)
                }
                _ => CommonObject::new_rectangle(min_x, min_y, width, height, style),
            };

            let id = self.state.add_element(new_el);
            self.state.select_only(id);
            self.state.active_tool = Tool::Select;
            self.auto_save();
        } else if matches!(
            self.state.drag_mode,
            DragMode::Dragging { .. } | DragMode::Resizing { .. }
        ) {
            self.state.recalculate_hierarchy();
            self.auto_save();
        } else if self.state.is_dirty {
            self.auto_save();
        }

        self.state.drag_mode = DragMode::None;
        cx.notify();
    }

    pub fn handle_scroll_wheel(
        &mut self,
        ev: &ScrollWheelEvent,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let delta = ev.delta.pixel_delta(px(20.0));
        let delta_y: f32 = delta.y.into();
        let zoom_factor = if delta_y > 0.0 { 1.05 } else { 0.95 };
        let new_zoom = (self.state.zoom * zoom_factor).clamp(0.2, 3.0);

        // Zoom centered around mouse
        let mouse = self.last_mouse_pos;
        let c_mouse = self.state.screen_to_canvas(mouse);
        self.state.zoom = new_zoom;
        self.state.pan = Point2D::new(
            mouse.x - c_mouse.x * new_zoom,
            mouse.y - c_mouse.y * new_zoom,
        );

        cx.notify();
    }
}

impl Render for WhiteboardView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let elements_for_canvas = self.state.elements.clone();
        let selected_ids = self.state.selected_ids.clone();
        let pan = self.state.pan;
        let zoom = self.state.zoom;
        let drag_mode = self.state.drag_mode.clone();
        let hover_cursor = self.state.hover_cursor;

        // Calculate ancestor clip masks for clipping support
        let mut id_to_element: HashMap<ElementId, &CommonObject> = HashMap::new();
        for el in &self.state.elements {
            id_to_element.insert(el.id.clone(), el);
        }

        let mut clip_masks: HashMap<ElementId, Rect2D> = HashMap::new();
        for el in &self.state.elements {
            let mut curr_pid = el.parent_id.as_ref();
            while let Some(pid) = curr_pid {
                if let Some(parent) = id_to_element.get(pid) {
                    if parent.clip_content {
                        clip_masks.insert(el.id.clone(), parent.bounds);
                        break;
                    }
                    curr_pid = parent.parent_id.as_ref();
                } else {
                    break;
                }
            }
        }

        // Selected element reference
        let single_selected = self.state.single_selected_element().cloned();

        div()
            .size_full()
            .relative()
            .bg(Theme::BG_CANVAS)
            .overflow_hidden()
            .on_mouse_down(
                gpui::MouseButton::Left,
                cx.listener(|this, ev: &MouseDownEvent, window, cx| {
                    this.handle_mouse_down(ev, window, cx);
                }),
            )
            .on_mouse_down(
                gpui::MouseButton::Right,
                cx.listener(|this, ev: &MouseDownEvent, window, cx| {
                    this.handle_mouse_down(ev, window, cx);
                }),
            )
            .on_mouse_move(cx.listener(|this, ev: &MouseMoveEvent, window, cx| {
                this.handle_mouse_move(ev, window, cx);
            }))
            .on_mouse_up(
                gpui::MouseButton::Left,
                cx.listener(|this, ev: &MouseUpEvent, window, cx| {
                    this.handle_mouse_up(ev, window, cx);
                }),
            )
            .on_scroll_wheel(cx.listener(|this, ev: &ScrollWheelEvent, window, cx| {
                this.handle_scroll_wheel(ev, window, cx);
            }))
            // Low-level Canvas Painting
            .child(
                canvas(
                    move |_, _, _| {},
                    move |bounds, _, window, _| {
                        // Dynamically update window cursor safely during paint phase
                        window.set_window_cursor_style(hover_cursor);

                        let width = f32::from(bounds.size.width);
                        let height = f32::from(bounds.size.height);

                        // 1. Draw dot grid
                        let grid_spacing = 20.0 * zoom;
                        if grid_spacing >= 10.0 {
                            let start_x = (pan.x % grid_spacing + grid_spacing) % grid_spacing;
                            let start_y = (pan.y % grid_spacing + grid_spacing) % grid_spacing;

                            let mut x = start_x;
                            while x < width {
                                let mut y = start_y;
                                while y < height {
                                    window.paint_quad(fill(
                                        Bounds {
                                            origin: point(px(x), px(y)),
                                            size: size(px(1.5), px(1.5)),
                                        },
                                        Theme::GRID_DOT,
                                    ));
                                    y += grid_spacing;
                                }
                                x += grid_spacing;
                            }
                        }

                        // 2. Draw Elements in Topological Hierarchy Order
                        for el in &elements_for_canvas {
                            let el_bounds = el.bounds;
                            let screen_x = el_bounds.min_x * zoom + pan.x;
                            let screen_y = el_bounds.min_y * zoom + pan.y;
                            let screen_w = el_bounds.width() * zoom;
                            let screen_h = el_bounds.height() * zoom;
                            let screen_rect = Bounds {
                                origin: point(px(screen_x), px(screen_y)),
                                size: size(px(screen_w), px(screen_h)),
                            };

                            let border_style = match el.style.stroke_style {
                                StrokeStyle::Solid => BorderStyle::Solid,
                                _ => BorderStyle::Dashed,
                            };

                            let stroke_color = el.style.stroke_color.to_gpui_rgba();
                            let fill_color = el.style.fill_color.to_gpui_rgba();
                            let stroke_width = (el.style.stroke_width * zoom).max(1.0);

                            // Helper closure to paint the element shape
                            let paint_shape = |window: &mut Window| match &el.kind {
                                ShapeKind::Rectangle { corner_radius } => {
                                    let radius = px(*corner_radius * zoom);
                                    window.paint_quad(quad(
                                        screen_rect,
                                        radius,
                                        fill_color,
                                        px(stroke_width),
                                        stroke_color,
                                        border_style,
                                    ));
                                }
                                ShapeKind::Polygon { points, .. } => {
                                    if points.len() >= 3 {
                                        // Fill
                                        if el.style.fill_color.a > 0.001 {
                                            let mut fill_b = PathBuilder::fill();
                                            let p0 = point(
                                                px(points[0].x * zoom + pan.x),
                                                px(points[0].y * zoom + pan.y),
                                            );
                                            fill_b.move_to(p0);
                                            for p in &points[1..] {
                                                fill_b.line_to(point(
                                                    px(p.x * zoom + pan.x),
                                                    px(p.y * zoom + pan.y),
                                                ));
                                            }
                                            fill_b.close();
                                            if let Ok(path) = fill_b.build() {
                                                window.paint_path(path, fill_color);
                                            }
                                        }

                                        // Stroke
                                        let mut stroke_b = PathBuilder::stroke(px(stroke_width));
                                        if el.style.stroke_style != StrokeStyle::Solid {
                                            stroke_b = stroke_b.dash_array(&[px(6.0), px(4.0)]);
                                        }
                                        let p0 = point(
                                            px(points[0].x * zoom + pan.x),
                                            px(points[0].y * zoom + pan.y),
                                        );
                                        stroke_b.move_to(p0);
                                        for p in &points[1..] {
                                            stroke_b.line_to(point(
                                                px(p.x * zoom + pan.x),
                                                px(p.y * zoom + pan.y),
                                            ));
                                        }
                                        stroke_b.close();
                                        if let Ok(path) = stroke_b.build() {
                                            window.paint_path(path, stroke_color);
                                        }
                                    }
                                }
                                ShapeKind::Ellipse { rx: _, ry: _ } => {
                                    // Smooth rounded ellipse quad
                                    let radius = px(screen_h * 0.5);
                                    window.paint_quad(quad(
                                        screen_rect,
                                        radius,
                                        fill_color,
                                        px(stroke_width),
                                        stroke_color,
                                        border_style,
                                    ));
                                }
                                ShapeKind::Arrow { start, end } => {
                                    let s = point(
                                        px(start.x * zoom + pan.x),
                                        px(start.y * zoom + pan.y),
                                    );
                                    let e =
                                        point(px(end.x * zoom + pan.x), px(end.y * zoom + pan.y));

                                    // Line
                                    let mut line_b = PathBuilder::stroke(px(stroke_width));
                                    line_b.move_to(s);
                                    line_b.line_to(e);
                                    if let Ok(path) = line_b.build() {
                                        window.paint_path(path, stroke_color);
                                    }

                                    // Arrowhead
                                    let angle = (end.y - start.y).atan2(end.x - start.x);
                                    let head_len = (stroke_width * 4.0).max(12.0) * zoom;
                                    let ex = end.x * zoom + pan.x;
                                    let ey = end.y * zoom + pan.y;
                                    let p1 = point(
                                        px(ex - head_len * (angle - 0.45).cos()),
                                        px(ey - head_len * (angle - 0.45).sin()),
                                    );
                                    let p2 = point(
                                        px(ex - head_len * (angle + 0.45).cos()),
                                        px(ey - head_len * (angle + 0.45).sin()),
                                    );

                                    let mut head_b = PathBuilder::fill();
                                    head_b.move_to(point(px(ex), px(ey)));
                                    head_b.line_to(p1);
                                    head_b.line_to(p2);
                                    head_b.close();
                                    if let Ok(head_path) = head_b.build() {
                                        window.paint_path(head_path, stroke_color);
                                    }
                                }
                                ShapeKind::Text { .. } => {
                                    // Text background container if fill is specified
                                    if el.style.fill_color.a > 0.001 {
                                        window.paint_quad(quad(
                                            screen_rect,
                                            px(4.0),
                                            fill_color,
                                            px(0.0),
                                            Theme::TRANSPARENT,
                                            BorderStyle::Solid,
                                        ));
                                    }
                                }
                            };

                            // Check container clipping
                            if let Some(mask_box) = clip_masks.get(&el.id) {
                                let mask_screen_rect = Bounds {
                                    origin: point(
                                        px(mask_box.min_x * zoom + pan.x),
                                        px(mask_box.min_y * zoom + pan.y),
                                    ),
                                    size: size(
                                        px(mask_box.width() * zoom),
                                        px(mask_box.height() * zoom),
                                    ),
                                };
                                window.with_content_mask(
                                    Some(ContentMask {
                                        bounds: mask_screen_rect,
                                    }),
                                    |window| {
                                        paint_shape(window);
                                    },
                                );
                            } else {
                                paint_shape(window);
                            }
                        }

                        // 3. Draw Selection Highlight and Resize Handles
                        for sel_id in &selected_ids {
                            if let Some(el) = elements_for_canvas.iter().find(|e| &e.id == sel_id) {
                                let sel_b = el.bounds;
                                let sx = sel_b.min_x * zoom + pan.x;
                                let sy = sel_b.min_y * zoom + pan.y;
                                let sw = sel_b.width() * zoom;
                                let sh = sel_b.height() * zoom;

                                let sel_rect = Bounds {
                                    origin: point(px(sx), px(sy)),
                                    size: size(px(sw), px(sh)),
                                };

                                // Dashed selection frame
                                window.paint_quad(quad(
                                    sel_rect,
                                    px(0.0),
                                    Theme::TRANSPARENT,
                                    px(1.5),
                                    Theme::ACCENT,
                                    BorderStyle::Dashed,
                                ));

                                // 8 square resize handles
                                let handle_size = 7.0;
                                for handle in &ResizeHandle::ALL {
                                    let pos = handle.position(&sel_b);
                                    let hx = pos.x * zoom + pan.x - handle_size * 0.5;
                                    let hy = pos.y * zoom + pan.y - handle_size * 0.5;

                                    window.paint_quad(quad(
                                        Bounds {
                                            origin: point(px(hx), px(hy)),
                                            size: size(px(handle_size), px(handle_size)),
                                        },
                                        px(1.0),
                                        Theme::WHITE,
                                        px(1.5),
                                        Theme::ACCENT,
                                        BorderStyle::Solid,
                                    ));
                                }
                            }
                        }

                        // 4. Drawing Preview
                        if let DragMode::Drawing {
                            start_pos,
                            current_pos,
                            ..
                        } = drag_mode
                        {
                            let min_x = start_pos.x.min(current_pos.x) * zoom + pan.x;
                            let min_y = start_pos.y.min(current_pos.y) * zoom + pan.y;
                            let w = (start_pos.x - current_pos.x).abs() * zoom;
                            let h = (start_pos.y - current_pos.y).abs() * zoom;

                            window.paint_quad(quad(
                                Bounds {
                                    origin: point(px(min_x), px(min_y)),
                                    size: size(px(w), px(h)),
                                },
                                px(4.0),
                                Theme::ACCENT_LIGHT,
                                px(1.5),
                                Theme::ACCENT,
                                BorderStyle::Dashed,
                            ));
                        }
                    },
                )
                .size_full(),
            )
            // Text Overlays for native font rendering & crayon text
            .children(self.state.elements.iter().filter_map(|el| {
                if let ShapeKind::Text {
                    content, font_size, ..
                } = &el.kind
                {
                    let tx = el.bounds.min_x * zoom + pan.x;
                    let ty = el.bounds.min_y * zoom + pan.y;
                    let tw = el.bounds.width() * zoom;
                    let th = el.bounds.height() * zoom;
                    let font_px = font_size * zoom;

                    let color = el.style.stroke_color.to_gpui_rgba();

                    Some(
                        div()
                            .absolute()
                            .top(px(ty))
                            .left(px(tx))
                            .w(px(tw))
                            .h(px(th))
                            .flex()
                            .items_center()
                            .text_size(px(font_px))
                            .text_color(color)
                            .child(content.clone()),
                    )
                } else {
                    None
                }
            }))
            // Floating Top Toolbar
            .child(self.render_toolbar(cx))
            // Floating Left Properties Panel
            .when(
                self.state.show_properties && single_selected.is_some(),
                |d| d.child(self.render_properties_panel(single_selected.as_ref().unwrap(), cx)),
            )
            // Floating Right Hierarchy Tree Sidebar
            .when(self.state.show_hierarchy_tree, |d| {
                d.child(self.render_hierarchy_tree(cx))
            })
            // Right-Click Context Menu Popup
            .when(self.state.context_menu.is_some(), |d| {
                let (pos, target) = self.state.context_menu.as_ref().unwrap();
                d.child(self.render_context_menu(*pos, target.clone(), cx))
            })
            // Bottom Status Pill
            .child(
                div()
                    .absolute()
                    .bottom(px(16.0))
                    .right(px(16.0))
                    .bg(Theme::WHITE)
                    .px_3()
                    .py_1()
                    .rounded_full()
                    .shadow_md()
                    .border_1()
                    .border_color(Theme::PANEL_BORDER)
                    .flex()
                    .gap_3()
                    .text_xs()
                    .items_center()
                    .child(
                        div()
                            .flex()
                            .gap_1()
                            .items_center()
                            .child(div().size_2().rounded_full().bg(Theme::SUCCESS))
                            .child(format!("Instances: {}", self.state.elements.len())),
                    )
                    .child(format!("Cloud: {}", &self.state.autosave_status))
                    .child(format!(
                        "Zoom: {}%",
                        (self.state.zoom * 100.0).round() as i32
                    )),
            )
    }
}

// ==========================================
// Subcomponent Render Helpers
// ==========================================

impl WhiteboardView {
    fn render_toolbar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let active_tool = self.state.active_tool;
        let zoom_pct = (self.state.zoom * 100.0).round() as i32;
        let show_tree = self.state.show_hierarchy_tree;

        div()
            .absolute()
            .top(px(16.0))
            .left(px(0.0))
            .right(px(0.0))
            .flex()
            .justify_center()
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_1()
                    .bg(Theme::PANEL_BG)
                    .px_3()
                    .py_2()
                    .rounded_xl()
                    .shadow_lg()
                    .border_1()
                    .border_color(Theme::PANEL_BORDER)
                    // Tools
                    .child(self.tool_button("btn-tool-select", "↖", Tool::Select, active_tool, cx))
                    .child(self.tool_button("btn-tool-pan", "✋", Tool::Pan, active_tool, cx))
                    .child(self.tool_button("btn-tool-rect", "▭", Tool::Rectangle, active_tool, cx))
                    .child(self.tool_button("btn-tool-poly", "◇", Tool::Polygon, active_tool, cx))
                    .child(self.tool_button(
                        "btn-tool-ellipse",
                        "○",
                        Tool::Ellipse,
                        active_tool,
                        cx,
                    ))
                    .child(self.tool_button("btn-tool-arrow", "➔", Tool::Arrow, active_tool, cx))
                    .child(self.tool_button("btn-tool-text", "T", Tool::Text, active_tool, cx))
                    .child(div().w(px(1.0)).h(px(20.0)).bg(Theme::PANEL_BORDER).mx_2())
                    // "Create with Style" button
                    .child(
                        div()
                            .id("btn-create-with-style")
                            .flex()
                            .items_center()
                            .gap_1()
                            .px_3()
                            .py_1()
                            .rounded_md()
                            .bg(Theme::ACCENT_LIGHT)
                            .text_color(Theme::ACCENT)
                            .text_xs()
                            .cursor_pointer()
                            .on_click(cx.listener(|this, _, _, cx| {
                                let style = this.state.current_style.clone();
                                let center =
                                    this.state.screen_to_canvas(Point2D::new(500.0, 300.0));
                                let new_el = CommonObject::new_rectangle(
                                    center.x, center.y, 220.0, 140.0, style,
                                );
                                let id = this.state.add_element(new_el);
                                this.state.select_only(id);
                                this.auto_save();
                                cx.notify();
                            }))
                            .child("Create with Style ▼"),
                    )
                    .child(div().w(px(1.0)).h(px(20.0)).bg(Theme::PANEL_BORDER).mx_2())
                    // Reset, Delete, Save
                    .child(
                        div()
                            .id("btn-reset-all")
                            .px_2()
                            .py_1()
                            .rounded_md()
                            .text_xs()
                            .cursor_pointer()
                            .text_color(Theme::TEXT_MUTED)
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.state.elements.clear();
                                this.state.selected_ids.clear();
                                this.auto_save();
                                cx.notify();
                            }))
                            .child("Reset"),
                    )
                    .child(
                        div()
                            .id("btn-delete-all")
                            .px_2()
                            .py_1()
                            .rounded_md()
                            .text_xs()
                            .cursor_pointer()
                            .text_color(Theme::DANGER)
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.state.delete_selected();
                                this.auto_save();
                                cx.notify();
                            }))
                            .child("Delete"),
                    )
                    .child(
                        div()
                            .px_3()
                            .py_1()
                            .rounded_md()
                            .text_xs()
                            .bg(Theme::SUCCESS)
                            .text_color(Theme::WHITE)
                            .child("Saved ✓"),
                    )
                    .child(div().w(px(1.0)).h(px(20.0)).bg(Theme::PANEL_BORDER).mx_2())
                    // Zoom
                    .child(
                        div()
                            .id("btn-zoom-out")
                            .px_2()
                            .py_1()
                            .cursor_pointer()
                            .text_xs()
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.state.zoom = (this.state.zoom - 0.1).max(0.2);
                                cx.notify();
                            }))
                            .child("-"),
                    )
                    .child(
                        div()
                            .text_xs()
                            .text_color(Theme::TEXT_MUTED)
                            .child(format!("{}%", zoom_pct)),
                    )
                    .child(
                        div()
                            .id("btn-zoom-in")
                            .px_2()
                            .py_1()
                            .cursor_pointer()
                            .text_xs()
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.state.zoom = (this.state.zoom + 0.1).min(3.0);
                                cx.notify();
                            }))
                            .child("+"),
                    )
                    .child(div().w(px(1.0)).h(px(20.0)).bg(Theme::PANEL_BORDER).mx_2())
                    // Toggle Hierarchy Tree button
                    .child(
                        div()
                            .id("btn-toggle-tree")
                            .px_2()
                            .py_1()
                            .rounded_md()
                            .bg(if show_tree {
                                Theme::ACCENT_LIGHT
                            } else {
                                Theme::TRANSPARENT
                            })
                            .text_color(if show_tree {
                                Theme::ACCENT
                            } else {
                                Theme::TEXT_PRIMARY
                            })
                            .text_xs()
                            .cursor_pointer()
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.state.show_hierarchy_tree = !this.state.show_hierarchy_tree;
                                cx.notify();
                            }))
                            .child("▶ Hierarchy Tree"),
                    ),
            )
    }

    fn tool_button(
        &self,
        id: &'static str,
        label: &'static str,
        tool: Tool,
        active: Tool,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let is_active = tool == active;
        div()
            .id(id)
            .w(px(32.0))
            .h(px(32.0))
            .flex()
            .items_center()
            .justify_center()
            .rounded_lg()
            .cursor_pointer()
            .bg(if is_active {
                Theme::ACCENT_LIGHT
            } else {
                Theme::TRANSPARENT
            })
            .text_color(if is_active {
                Theme::ACCENT
            } else {
                Theme::TEXT_PRIMARY
            })
            .on_click(cx.listener(move |this, _, _, cx| {
                this.state.active_tool = tool;
                cx.notify();
            }))
            .child(label)
    }

    fn render_properties_panel(
        &self,
        el: &CommonObject,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let is_root = el.parent_id.is_none();
        let parent_str = el
            .parent_id
            .as_ref()
            .map(|p| p.as_str())
            .unwrap_or("null (No Parent)");
        let manager_str = el.manager_hash.as_deref().unwrap_or("null");

        let clip_content = el.clip_content;
        let stroke_width = el.style.stroke_width;
        let render_mode = el.style.render_mode;

        div()
            .absolute()
            .top(px(80.0))
            .left(px(16.0))
            .w(px(240.0))
            .bg(Theme::PANEL_BG)
            .p_4()
            .rounded_2xl()
            .shadow_xl()
            .border_1()
            .border_color(Theme::PANEL_BORDER)
            .flex()
            .flex_col()
            .gap_3()
            // Header
            .child(
                div()
                    .flex()
                    .justify_between()
                    .items_center()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::BOLD)
                            .text_color(Theme::TEXT_MUTED)
                            .child(format!("{} INSTANCE", el.type_name().to_uppercase())),
                    )
                    .child(
                        div()
                            .px_2()
                            .py_0p5()
                            .rounded_md()
                            .text_xs()
                            .bg(if is_root && el.manager_hash.is_some() {
                                Theme::BADGE_MANAGER_BG
                            } else if is_root {
                                Theme::BADGE_ROOT_BG
                            } else {
                                Theme::BADGE_CHILD_BG
                            })
                            .text_color(if is_root && el.manager_hash.is_some() {
                                Theme::BADGE_MANAGER_TEXT
                            } else if is_root {
                                Theme::BADGE_ROOT_TEXT
                            } else {
                                Theme::BADGE_CHILD_TEXT
                            })
                            .child(if is_root && el.manager_hash.is_some() {
                                "MANAGER INSTANCE"
                            } else if is_root {
                                "ROOT INSTANCE"
                            } else {
                                "CHILD INSTANCE"
                            }),
                    ),
            )
            // Metadata Card
            .child(
                div()
                    .bg(Theme::BADGE_ROOT_BG)
                    .p_2()
                    .rounded_lg()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .text_xs()
                    .child(format!("Parent ID: {}", parent_str))
                    .child(format!("Manager Hash: {}", manager_str))
                    .child(format!("Layer Z-Index: {}", el.z_index)),
            )
            // Clip Content Checkbox
            .child(
                div()
                    .id("btn-toggle-clip")
                    .flex()
                    .items_center()
                    .gap_2()
                    .cursor_pointer()
                    .on_click(cx.listener(move |this, _, _, cx| {
                        if let Some(e) = this.state.single_selected_element_mut() {
                            e.clip_content = !clip_content;
                        }
                        this.auto_save();
                        cx.notify();
                    }))
                    .child(
                        div()
                            .size_4()
                            .rounded_sm()
                            .border_1()
                            .border_color(Theme::ACCENT)
                            .flex()
                            .items_center()
                            .justify_center()
                            .bg(if clip_content {
                                Theme::ACCENT
                            } else {
                                Theme::WHITE
                            })
                            .text_color(Theme::WHITE)
                            .child(if clip_content { "✓" } else { "" }),
                    )
                    .child(div().text_xs().child("Clip Content (Inside Boundary)")),
            )
            // Layer Order (Front / Back)
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::BOLD)
                            .child("Layer Order (Front / Back)"),
                    )
                    .child(
                        div()
                            .flex()
                            .gap_1()
                            .child(self.layer_btn(
                                "layer-front",
                                "Front 🔝",
                                move |this| this.state.bring_to_front(None),
                                cx,
                            ))
                            .child(self.layer_btn(
                                "layer-fwd",
                                "Forward ⤊",
                                move |this| this.state.bring_forward(None),
                                cx,
                            ))
                            .child(self.layer_btn(
                                "layer-backw",
                                "Backward ⤋",
                                move |this| this.state.send_backward(None),
                                cx,
                            ))
                            .child(self.layer_btn(
                                "layer-back",
                                "Back 🔚",
                                move |this| this.state.send_to_back(None),
                                cx,
                            )),
                    ),
            )
            // Render Style (Polished vs Sketch)
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::BOLD)
                            .child("Render Style"),
                    )
                    .child(
                        div()
                            .flex()
                            .gap_1()
                            .child(
                                div()
                                    .id("btn-render-polished")
                                    .flex_1()
                                    .py_1()
                                    .rounded_md()
                                    .text_center()
                                    .text_xs()
                                    .cursor_pointer()
                                    .bg(if render_mode == RenderMode::Polished {
                                        Theme::ACCENT_LIGHT
                                    } else {
                                        Theme::BADGE_ROOT_BG
                                    })
                                    .text_color(if render_mode == RenderMode::Polished {
                                        Theme::ACCENT
                                    } else {
                                        Theme::TEXT_PRIMARY
                                    })
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        if let Some(e) = this.state.single_selected_element_mut() {
                                            e.style.render_mode = RenderMode::Polished;
                                        }
                                        this.auto_save();
                                        cx.notify();
                                    }))
                                    .child("Polished"),
                            )
                            .child(
                                div()
                                    .id("btn-render-sketch")
                                    .flex_1()
                                    .py_1()
                                    .rounded_md()
                                    .text_center()
                                    .text_xs()
                                    .cursor_pointer()
                                    .bg(if render_mode == RenderMode::Sketch {
                                        Theme::ACCENT_LIGHT
                                    } else {
                                        Theme::BADGE_ROOT_BG
                                    })
                                    .text_color(if render_mode == RenderMode::Sketch {
                                        Theme::ACCENT
                                    } else {
                                        Theme::TEXT_PRIMARY
                                    })
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        if let Some(e) = this.state.single_selected_element_mut() {
                                            e.style.render_mode = RenderMode::Sketch;
                                        }
                                        this.auto_save();
                                        cx.notify();
                                    }))
                                    .child("Sketch"),
                            ),
                    ),
            )
            // Stroke Color Swatches
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::BOLD)
                            .child("Stroke Color"),
                    )
                    .child(
                        div()
                            .flex()
                            .gap_1()
                            .child(self.color_swatch("swatch-stroke-blk", "#1e1e1e", cx, true))
                            .child(self.color_swatch("swatch-stroke-red", "#e03131", cx, true))
                            .child(self.color_swatch("swatch-stroke-grn", "#2f9e44", cx, true))
                            .child(self.color_swatch("swatch-stroke-blu", "#1971c2", cx, true))
                            .child(self.color_swatch("swatch-stroke-org", "#f08c00", cx, true))
                            .child(self.color_swatch("swatch-stroke-prp", "#9c36b5", cx, true)),
                    ),
            )
            // Fill Color Swatches
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::BOLD)
                            .child("Fill Color"),
                    )
                    .child(
                        div()
                            .flex()
                            .gap_1()
                            .child(self.color_swatch("swatch-fill-trans", "transparent", cx, false))
                            .child(self.color_swatch("swatch-fill-ylw", "#fff9db", cx, false))
                            .child(self.color_swatch("swatch-fill-red", "#ffe3e3", cx, false))
                            .child(self.color_swatch("swatch-fill-grn", "#ebfbee", cx, false))
                            .child(self.color_swatch("swatch-fill-blu", "#e7f5ff", cx, false))
                            .child(self.color_swatch("swatch-fill-prp", "#f3d9fa", cx, false)),
                    ),
            )
            // Stroke Width
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_1()
                    .child(
                        div()
                            .text_xs()
                            .font_weight(gpui::FontWeight::BOLD)
                            .child("Stroke Width"),
                    )
                    .child(
                        div()
                            .flex()
                            .gap_1()
                            .child(self.width_btn("w-1", 1.0, stroke_width, cx))
                            .child(self.width_btn("w-2", 2.0, stroke_width, cx))
                            .child(self.width_btn("w-4", 4.0, stroke_width, cx)),
                    ),
            )
    }

    fn layer_btn(
        &self,
        id: &'static str,
        label: &'static str,
        action: impl Fn(&mut Self) + 'static,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        div()
            .id(id)
            .flex_1()
            .py_1()
            .bg(Theme::BADGE_ROOT_BG)
            .rounded_md()
            .text_center()
            .text_xs()
            .cursor_pointer()
            .on_click(cx.listener(move |this, _, _, cx| {
                action(this);
                this.auto_save();
                cx.notify();
            }))
            .child(label)
    }

    fn color_swatch(
        &self,
        id: &'static str,
        hex: &'static str,
        cx: &mut Context<Self>,
        is_stroke: bool,
    ) -> impl IntoElement {
        let color = ColorRgba::from_hex(hex);
        div()
            .id(id)
            .size_5()
            .rounded_full()
            .border_1()
            .border_color(Theme::PANEL_BORDER)
            .cursor_pointer()
            .bg(color.to_gpui_rgba())
            .on_click(cx.listener(move |this, _, _, cx| {
                if let Some(e) = this.state.single_selected_element_mut() {
                    if is_stroke {
                        e.style.stroke_color = color;
                    } else {
                        e.style.fill_color = color;
                    }
                }
                this.auto_save();
                cx.notify();
            }))
    }

    fn width_btn(
        &self,
        id: &'static str,
        width: f32,
        current: f32,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let is_active = (width - current).abs() < 0.1;
        div()
            .id(id)
            .flex_1()
            .py_1()
            .rounded_md()
            .text_center()
            .text_xs()
            .cursor_pointer()
            .bg(if is_active {
                Theme::ACCENT_LIGHT
            } else {
                Theme::BADGE_ROOT_BG
            })
            .text_color(if is_active {
                Theme::ACCENT
            } else {
                Theme::TEXT_PRIMARY
            })
            .on_click(cx.listener(move |this, _, _, cx| {
                if let Some(e) = this.state.single_selected_element_mut() {
                    e.style.stroke_width = width;
                }
                this.auto_save();
                cx.notify();
            }))
            .child(format!("{}px", width as i32))
    }

    fn render_hierarchy_tree(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let tree = ManagerClass::build_hierarchy_tree(&self.state.elements);
        let selected_id = self.state.single_selected_element().map(|e| e.id.clone());

        div()
            .absolute()
            .top(px(80.0))
            .right(px(16.0))
            .w(px(260.0))
            .bg(Theme::PANEL_BG)
            .p_4()
            .rounded_2xl()
            .shadow_xl()
            .border_1()
            .border_color(Theme::PANEL_BORDER)
            .flex()
            .flex_col()
            .gap_3()
            // Header
            .child(
                div()
                    .flex()
                    .justify_between()
                    .items_center()
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(gpui::FontWeight::BOLD)
                                    .child("Hierarchy Tree"),
                            )
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(Theme::TEXT_MUTED)
                                    .child("What's inside what"),
                            ),
                    )
                    .child(
                        div()
                            .px_2()
                            .py_0p5()
                            .rounded_full()
                            .bg(Theme::BADGE_ROOT_BG)
                            .text_xs()
                            .child(format!("{} objects", self.state.elements.len())),
                    ),
            )
            // Tree Items
            .child(
                div().flex().flex_col().gap_2().children(
                    tree.into_iter()
                        .map(|root| self.render_tree_node(root, selected_id.as_ref(), 0, cx)),
                ),
            )
    }

    fn render_tree_node(
        &self,
        node: HierarchyNode,
        selected_id: Option<&ElementId>,
        depth: usize,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let id = node.id.clone();
        let is_selected = selected_id == Some(&id);
        let indent = depth as f32 * 16.0;
        let node_id_str = SharedString::from(format!("tree-node-{}", id.as_str()));

        div()
            .flex()
            .flex_col()
            .gap_1()
            .child(
                div()
                    .id(node_id_str)
                    .ml(px(indent))
                    .p_2()
                    .rounded_lg()
                    .border_1()
                    .cursor_pointer()
                    .border_color(if is_selected {
                        Theme::ACCENT
                    } else {
                        Theme::PANEL_BORDER
                    })
                    .bg(if is_selected {
                        Theme::ACCENT_LIGHT
                    } else {
                        Theme::WHITE
                    })
                    .flex()
                    .justify_between()
                    .items_center()
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.state.select_only(id.clone());
                        cx.notify();
                    }))
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_1()
                            .child(match node.type_name {
                                "rectangle" => "▭",
                                "polygon" => "◇",
                                "ellipse" => "○",
                                "arrow" => "➔",
                                "text" => "T",
                                _ => "▪",
                            })
                            .child(div().text_xs().child(format!(
                                "{} #{}",
                                node.type_name,
                                &node.id.as_str()[..node.id.as_str().len().min(6)]
                            ))),
                    )
                    .child(
                        div()
                            .px_1p5()
                            .py_0p5()
                            .rounded_sm()
                            .text_xs()
                            .bg(if node.is_manager {
                                Theme::BADGE_MANAGER_BG
                            } else if node.is_root {
                                Theme::BADGE_ROOT_BG
                            } else {
                                Theme::BADGE_CHILD_BG
                            })
                            .text_color(if node.is_manager {
                                Theme::BADGE_MANAGER_TEXT
                            } else if node.is_root {
                                Theme::BADGE_ROOT_TEXT
                            } else {
                                Theme::BADGE_CHILD_TEXT
                            })
                            .child(if node.is_manager {
                                "MANAGER"
                            } else if node.is_root {
                                "ROOT"
                            } else {
                                "CHILD"
                            }),
                    ),
            )
            .children(
                node.children
                    .into_iter()
                    .map(|child| self.render_tree_node(child, selected_id, depth + 1, cx)),
            )
    }

    fn render_context_menu(
        &self,
        pos: Point2D,
        target_id: Option<ElementId>,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        div()
            .absolute()
            .top(px(pos.y))
            .left(px(pos.x))
            .w(px(220.0))
            .bg(Theme::PANEL_BG)
            .p_2()
            .rounded_xl()
            .shadow_2xl()
            .border_1()
            .border_color(Theme::PANEL_BORDER)
            .flex()
            .flex_col()
            .gap_1()
            .child(
                div()
                    .id("ctx-edit-props")
                    .px_2()
                    .py_1()
                    .rounded_md()
                    .cursor_pointer()
                    .text_xs()
                    .flex()
                    .items_center()
                    .gap_2()
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.state.show_properties = true;
                        this.state.context_menu = None;
                        cx.notify();
                    }))
                    .child("✏️")
                    .child(
                        div().flex_col().child("Edit Properties").child(
                            div()
                                .text_xs()
                                .text_color(Theme::TEXT_MUTED)
                                .child("Sync to toolbar"),
                        ),
                    ),
            )
            .child(
                div()
                    .id("ctx-bring-front")
                    .px_2()
                    .py_1()
                    .rounded_md()
                    .cursor_pointer()
                    .text_xs()
                    .flex()
                    .items_center()
                    .gap_2()
                    .on_click(cx.listener({
                        let tid = target_id.clone();
                        move |this, _, _, cx| {
                            this.state.bring_to_front(tid.as_ref());
                            this.state.context_menu = None;
                            this.auto_save();
                            cx.notify();
                        }
                    }))
                    .child("🔝")
                    .child(
                        div().flex_col().child("Bring to Front").child(
                            div()
                                .text_xs()
                                .text_color(Theme::TEXT_MUTED)
                                .child("Move above shapes (])"),
                        ),
                    ),
            )
            .child(
                div()
                    .id("ctx-send-back")
                    .px_2()
                    .py_1()
                    .rounded_md()
                    .cursor_pointer()
                    .text_xs()
                    .flex()
                    .items_center()
                    .gap_2()
                    .on_click(cx.listener({
                        let tid = target_id.clone();
                        move |this, _, _, cx| {
                            this.state.send_to_back(tid.as_ref());
                            this.state.context_menu = None;
                            this.auto_save();
                            cx.notify();
                        }
                    }))
                    .child("🔚")
                    .child(
                        div().flex_col().child("Send to Back").child(
                            div()
                                .text_xs()
                                .text_color(Theme::TEXT_MUTED)
                                .child("Move behind shapes ([)"),
                        ),
                    ),
            )
            .child(div().h(px(1.0)).bg(Theme::PANEL_BORDER).my_1())
            .child(
                div()
                    .id("ctx-delete-inst")
                    .px_2()
                    .py_1()
                    .rounded_md()
                    .cursor_pointer()
                    .text_xs()
                    .text_color(Theme::DANGER)
                    .flex()
                    .items_center()
                    .gap_2()
                    .on_click(cx.listener({
                        let tid = target_id.clone();
                        move |this, _, _, cx| {
                            if let Some(ref id) = tid {
                                this.state.delete_element(id);
                            } else {
                                this.state.delete_selected();
                            }
                            this.state.context_menu = None;
                            this.auto_save();
                            cx.notify();
                        }
                    }))
                    .child("🗑️")
                    .child("Delete Instance"),
            )
    }
}
