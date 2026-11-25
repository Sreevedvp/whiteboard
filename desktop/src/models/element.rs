use crate::models::geometry::{
    distance_to_segment, point_in_polygon, Point2D, Rect2D, ResizeHandle,
};
use crate::models::id::ElementId;
use crate::models::style::{ElementStyle, FontStyle};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ShapeKind {
    Rectangle {
        corner_radius: f32,
    },
    Polygon {
        points: Vec<Point2D>,
        #[serde(default)]
        is_diamond: bool,
    },
    Ellipse {
        rx: f32,
        ry: f32,
    },
    Arrow {
        start: Point2D,
        end: Point2D,
    },
    Text {
        content: String,
        font_size: f32,
        #[serde(default)]
        is_crayon: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CommonObject {
    pub id: ElementId,
    pub kind: ShapeKind,
    pub bounds: Rect2D,
    pub style: ElementStyle,
    #[serde(default)]
    pub clip_content: bool,
    #[serde(default)]
    pub z_index: i32,
    #[serde(default)]
    pub parent_id: Option<ElementId>,
    #[serde(default)]
    pub manager_hash: Option<String>,
}

impl CommonObject {
    pub fn new_rectangle(x: f32, y: f32, width: f32, height: f32, style: ElementStyle) -> Self {
        let corner_radius = style.corner_radius;
        Self {
            id: ElementId::new("el"),
            kind: ShapeKind::Rectangle { corner_radius },
            bounds: Rect2D::from_xywh(x, y, width, height),
            style,
            clip_content: false,
            z_index: 0,
            parent_id: None,
            manager_hash: None,
        }
    }

    pub fn new_diamond(x: f32, y: f32, width: f32, height: f32, style: ElementStyle) -> Self {
        let mid_x = x + width * 0.5;
        let mid_y = y + height * 0.5;
        let points = vec![
            Point2D::new(mid_x, y),
            Point2D::new(x + width, mid_y),
            Point2D::new(mid_x, y + height),
            Point2D::new(x, mid_y),
        ];
        Self {
            id: ElementId::new("el"),
            kind: ShapeKind::Polygon {
                points,
                is_diamond: true,
            },
            bounds: Rect2D::from_xywh(x, y, width, height),
            style,
            clip_content: false,
            z_index: 0,
            parent_id: None,
            manager_hash: None,
        }
    }

    pub fn new_ellipse(x: f32, y: f32, width: f32, height: f32, style: ElementStyle) -> Self {
        Self {
            id: ElementId::new("el"),
            kind: ShapeKind::Ellipse {
                rx: width * 0.5,
                ry: height * 0.5,
            },
            bounds: Rect2D::from_xywh(x, y, width, height),
            style,
            clip_content: false,
            z_index: 0,
            parent_id: None,
            manager_hash: None,
        }
    }

    pub fn new_arrow(start: Point2D, end: Point2D, style: ElementStyle) -> Self {
        let bounds = Rect2D::from_points(&[start, end]).expand(style.stroke_width + 8.0);
        Self {
            id: ElementId::new("el"),
            kind: ShapeKind::Arrow { start, end },
            bounds,
            style,
            clip_content: false,
            z_index: 0,
            parent_id: None,
            manager_hash: None,
        }
    }

    pub fn new_text(x: f32, y: f32, content: String, style: ElementStyle) -> Self {
        let is_crayon = matches!(style.font_style, FontStyle::Crayon);
        let char_count = content.chars().count().max(1) as f32;
        let width = (char_count * (style.font_size * 0.65)).max(40.0);
        let height = (style.font_size * 1.5).max(30.0);
        Self {
            id: ElementId::new("el"),
            kind: ShapeKind::Text {
                content,
                font_size: style.font_size,
                is_crayon,
            },
            bounds: Rect2D::from_xywh(x, y, width, height),
            style,
            clip_content: false,
            z_index: 0,
            parent_id: None,
            manager_hash: None,
        }
    }

    #[inline(always)]
    pub fn type_name(&self) -> &'static str {
        match self.kind {
            ShapeKind::Rectangle { .. } => "rectangle",
            ShapeKind::Polygon { .. } => "polygon",
            ShapeKind::Ellipse { .. } => "ellipse",
            ShapeKind::Arrow { .. } => "arrow",
            ShapeKind::Text { .. } => "text",
        }
    }

    pub fn hit_test(&self, point: Point2D) -> bool {
        match &self.kind {
            ShapeKind::Rectangle { .. } | ShapeKind::Text { .. } => {
                self.bounds.contains_point(point)
            }
            ShapeKind::Polygon { points, .. } => point_in_polygon(point, points),
            ShapeKind::Ellipse { rx, ry } => {
                let center = self.bounds.center();
                if *rx <= 0.0 || *ry <= 0.0 {
                    return false;
                }
                let dx = (point.x - center.x) / rx;
                let dy = (point.y - center.y) / ry;
                (dx * dx + dy * dy) <= 1.0
            }
            ShapeKind::Arrow { start, end } => {
                let threshold = (self.style.stroke_width + 8.0).max(10.0);
                distance_to_segment(point, *start, *end) <= threshold
            }
        }
    }

    pub fn translate(&mut self, delta: Point2D) {
        self.bounds.min_x += delta.x;
        self.bounds.max_x += delta.x;
        self.bounds.min_y += delta.y;
        self.bounds.max_y += delta.y;

        match &mut self.kind {
            ShapeKind::Polygon { points, .. } => {
                for p in points.iter_mut() {
                    *p = *p + delta;
                }
            }
            ShapeKind::Arrow { start, end } => {
                *start = *start + delta;
                *end = *end + delta;
            }
            _ => {}
        }
    }

    pub fn resize(&mut self, handle: ResizeHandle, new_pos: Point2D) {
        let old_bounds = self.bounds;
        let mut min_x = old_bounds.min_x;
        let mut max_x = old_bounds.max_x;
        let mut min_y = old_bounds.min_y;
        let mut max_y = old_bounds.max_y;

        match handle {
            ResizeHandle::Nw => {
                min_x = new_pos.x.min(max_x - 10.0);
                min_y = new_pos.y.min(max_y - 10.0);
            }
            ResizeHandle::Ne => {
                max_x = new_pos.x.max(min_x + 10.0);
                min_y = new_pos.y.min(max_y - 10.0);
            }
            ResizeHandle::Se => {
                max_x = new_pos.x.max(min_x + 10.0);
                max_y = new_pos.y.max(min_y + 10.0);
            }
            ResizeHandle::Sw => {
                min_x = new_pos.x.min(max_x - 10.0);
                max_y = new_pos.y.max(min_y + 10.0);
            }
            ResizeHandle::N => {
                min_y = new_pos.y.min(max_y - 10.0);
            }
            ResizeHandle::S => {
                max_y = new_pos.y.max(min_y + 10.0);
            }
            ResizeHandle::E => {
                max_x = new_pos.x.max(min_x + 10.0);
            }
            ResizeHandle::W => {
                min_x = new_pos.x.min(max_x - 10.0);
            }
        }

        let new_bounds = Rect2D {
            min_x,
            min_y,
            max_x,
            max_y,
        };

        let old_w = old_bounds.width().max(1.0);
        let old_h = old_bounds.height().max(1.0);
        let scale_x = new_bounds.width() / old_w;
        let scale_y = new_bounds.height() / old_h;

        match &mut self.kind {
            ShapeKind::Polygon { points, is_diamond } => {
                if *is_diamond {
                    let mid_x = new_bounds.min_x + new_bounds.width() * 0.5;
                    let mid_y = new_bounds.min_y + new_bounds.height() * 0.5;
                    *points = vec![
                        Point2D::new(mid_x, new_bounds.min_y),
                        Point2D::new(new_bounds.max_x, mid_y),
                        Point2D::new(mid_x, new_bounds.max_y),
                        Point2D::new(new_bounds.min_x, mid_y),
                    ];
                } else {
                    for p in points.iter_mut() {
                        let rel_x = (p.x - old_bounds.min_x) * scale_x;
                        let rel_y = (p.y - old_bounds.min_y) * scale_y;
                        p.x = new_bounds.min_x + rel_x;
                        p.y = new_bounds.min_y + rel_y;
                    }
                }
            }
            ShapeKind::Ellipse { rx, ry } => {
                *rx = new_bounds.width() * 0.5;
                *ry = new_bounds.height() * 0.5;
            }
            ShapeKind::Arrow { start, end } => match handle {
                ResizeHandle::Nw | ResizeHandle::Sw | ResizeHandle::W => {
                    *start = new_pos;
                }
                ResizeHandle::Ne | ResizeHandle::Se | ResizeHandle::E => {
                    *end = new_pos;
                }
                _ => {}
            },
            _ => {}
        }

        self.bounds = new_bounds;
    }
}
