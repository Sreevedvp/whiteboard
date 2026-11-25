use crate::models::element::CommonObject;
use crate::models::geometry::{Point2D, Rect2D, ResizeHandle};
use crate::models::id::ElementId;
use crate::models::manager::ManagerClass;
use crate::models::style::ElementStyle;
use gpui::CursorStyle;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Tool {
    #[default]
    Select,
    Pan,
    Rectangle,
    Polygon,
    Ellipse,
    Arrow,
    Text,
}

#[derive(Debug, Clone)]
pub enum DragMode {
    None,
    Panning {
        start_pan: Point2D,
        start_mouse: Point2D,
    },
    Dragging {
        start_mouse: Point2D,
        initial_positions: HashMap<ElementId, Rect2D>,
    },
    Resizing {
        handle: ResizeHandle,
        target_id: ElementId,
        initial_bounds: Rect2D,
    },
    Drawing {
        tool: Tool,
        start_pos: Point2D,
        current_pos: Point2D,
    },
}

pub struct CanvasState {
    pub elements: Vec<CommonObject>,
    pub selected_ids: HashSet<ElementId>,
    pub active_tool: Tool,
    pub pan: Point2D,
    pub zoom: f32,
    pub current_style: ElementStyle,
    pub drag_mode: DragMode,
    pub hover_cursor: CursorStyle,

    // UI overlays and sidebar states
    pub show_properties: bool,
    pub show_hierarchy_tree: bool,
    pub context_menu: Option<(Point2D, Option<ElementId>)>,
    pub editing_text_id: Option<ElementId>,
    pub autosave_status: String,
    pub is_dirty: bool,
}

impl Default for CanvasState {
    fn default() -> Self {
        Self::new()
    }
}

impl CanvasState {
    pub fn new() -> Self {
        Self {
            elements: Vec::new(),
            selected_ids: HashSet::new(),
            active_tool: Tool::Select,
            pan: Point2D::new(0.0, 0.0),
            zoom: 1.0,
            current_style: ElementStyle::default(),
            drag_mode: DragMode::None,
            hover_cursor: CursorStyle::Arrow,
            show_properties: true,
            show_hierarchy_tree: true,
            context_menu: None,
            editing_text_id: None,
            autosave_status: "Ready".to_string(),
            is_dirty: false,
        }
    }

    /// Screen point to canvas space transformation
    #[inline(always)]
    pub fn screen_to_canvas(&self, screen_pt: Point2D) -> Point2D {
        Point2D::new(
            (screen_pt.x - self.pan.x) / self.zoom,
            (screen_pt.y - self.pan.y) / self.zoom,
        )
    }

    /// Canvas point to screen space transformation
    #[inline(always)]
    pub fn canvas_to_screen(&self, canvas_pt: Point2D) -> Point2D {
        Point2D::new(
            canvas_pt.x * self.zoom + self.pan.x,
            canvas_pt.y * self.zoom + self.pan.y,
        )
    }

    /// Returns the single selected element if exactly one is selected
    pub fn single_selected_element(&self) -> Option<&CommonObject> {
        if self.selected_ids.len() == 1 {
            let id = self.selected_ids.iter().next().unwrap();
            self.elements.iter().find(|e| &e.id == id)
        } else {
            None
        }
    }

    /// Returns mutable reference to the single selected element
    pub fn single_selected_element_mut(&mut self) -> Option<&mut CommonObject> {
        if self.selected_ids.len() == 1 {
            let id = self.selected_ids.iter().next().cloned().unwrap();
            self.elements.iter_mut().find(|e| e.id == id)
        } else {
            None
        }
    }

    pub fn select_only(&mut self, id: ElementId) {
        self.selected_ids.clear();
        self.selected_ids.insert(id);
    }

    pub fn clear_selection(&mut self) {
        self.selected_ids.clear();
        self.editing_text_id = None;
    }

    /// Recursively collects all descendants of an element into a set
    pub fn collect_all_descendants(&self, parent_id: &ElementId, set: &mut HashSet<ElementId>) {
        for el in &self.elements {
            if el.parent_id.as_ref() == Some(parent_id) && !set.contains(&el.id) {
                set.insert(el.id.clone());
                self.collect_all_descendants(&el.id, set);
            }
        }
    }

    /// Find top-most element at canvas coordinate
    pub fn hit_test_element(&self, pt: Point2D) -> Option<&CommonObject> {
        // Iterate backwards from highest z_index (front) to lowest (back)
        self.elements.iter().rev().find(|el| el.hit_test(pt))
    }

    /// Check if point hits any resize handle of the currently single-selected element
    pub fn hit_test_handle(&self, canvas_pt: Point2D) -> Option<(ResizeHandle, ElementId)> {
        let el = self.single_selected_element()?;
        let bounds = el.bounds;
        let handle_radius = 8.0 / self.zoom; // constant visual size on screen

        for &handle in &ResizeHandle::ALL {
            if handle.hit_test(&bounds, canvas_pt, handle_radius) {
                return Some((handle, el.id.clone()));
            }
        }
        None
    }

    /// Adds a shape and recalculates hierarchy
    pub fn add_element(&mut self, mut el: CommonObject) -> ElementId {
        let id = el.id.clone();
        el.z_index = self.elements.len() as i32;
        self.elements.push(el);
        self.recalculate_hierarchy();
        self.is_dirty = true;
        id
    }

    /// Deletes currently selected elements
    pub fn delete_selected(&mut self) {
        if self.selected_ids.is_empty() {
            return;
        }
        self.elements.retain(|e| !self.selected_ids.contains(&e.id));
        self.selected_ids.clear();
        self.editing_text_id = None;
        self.recalculate_hierarchy();
        self.is_dirty = true;
    }

    pub fn delete_element(&mut self, id: &ElementId) {
        self.elements.retain(|e| &e.id != id);
        self.selected_ids.remove(id);
        if self.editing_text_id.as_ref() == Some(id) {
            self.editing_text_id = None;
        }
        self.recalculate_hierarchy();
        self.is_dirty = true;
    }

    pub fn recalculate_hierarchy(&mut self) {
        ManagerClass::recalculate_all_hierarchies(&mut self.elements);
    }

    // ==========================================
    // Layering / Stacking Order (Front & Back)
    // ==========================================

    pub fn bring_to_front(&mut self, target_id: Option<&ElementId>) {
        let id = match target_id {
            Some(i) => i.clone(),
            None => match self.single_selected_element() {
                Some(e) => e.id.clone(),
                None => return,
            },
        };

        let mut target_set = HashSet::new();
        target_set.insert(id.clone());
        self.collect_all_descendants(&id, &mut target_set);

        let mut targets = Vec::new();
        let mut others = Vec::new();

        for el in self.elements.drain(..) {
            if target_set.contains(&el.id) {
                targets.push(el);
            } else {
                others.push(el);
            }
        }

        self.elements = others;
        self.elements.extend(targets);
        self.recalculate_hierarchy();
        self.is_dirty = true;
    }

    pub fn send_to_back(&mut self, target_id: Option<&ElementId>) {
        let id = match target_id {
            Some(i) => i.clone(),
            None => match self.single_selected_element() {
                Some(e) => e.id.clone(),
                None => return,
            },
        };

        let mut target_set = HashSet::new();
        target_set.insert(id.clone());
        self.collect_all_descendants(&id, &mut target_set);

        let mut targets = Vec::new();
        let mut others = Vec::new();

        for el in self.elements.drain(..) {
            if target_set.contains(&el.id) {
                targets.push(el);
            } else {
                others.push(el);
            }
        }

        let mut combined = targets;
        combined.extend(others);
        self.elements = combined;
        self.recalculate_hierarchy();
        self.is_dirty = true;
    }

    pub fn bring_forward(&mut self, target_id: Option<&ElementId>) {
        let id = match target_id {
            Some(i) => i.clone(),
            None => match self.single_selected_element() {
                Some(e) => e.id.clone(),
                None => return,
            },
        };

        if let Some(pos) = self.elements.iter().position(|e| e.id == id) {
            if pos + 1 < self.elements.len() {
                self.elements.swap(pos, pos + 1);
                self.recalculate_hierarchy();
                self.is_dirty = true;
            }
        }
    }

    pub fn send_backward(&mut self, target_id: Option<&ElementId>) {
        let id = match target_id {
            Some(i) => i.clone(),
            None => match self.single_selected_element() {
                Some(e) => e.id.clone(),
                None => return,
            },
        };

        if let Some(pos) = self.elements.iter().position(|e| e.id == id) {
            if pos > 0 {
                self.elements.swap(pos, pos - 1);
                self.recalculate_hierarchy();
                self.is_dirty = true;
            }
        }
    }
}
