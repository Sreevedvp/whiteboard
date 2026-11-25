use gpui::CursorStyle;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct Point2D {
    pub x: f32,
    pub y: f32,
}

impl Point2D {
    #[inline(always)]
    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    #[inline(always)]
    pub fn distance_to(self, other: Self) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx * dx + dy * dy).sqrt()
    }

    #[inline(always)]
    pub fn distance_sq(self, other: Self) -> f32 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        dx * dx + dy * dy
    }

    #[inline(always)]
    pub fn lerp(self, other: Self, t: f32) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
        }
    }
}

impl std::ops::Add for Point2D {
    type Output = Self;
    #[inline(always)]
    fn add(self, rhs: Self) -> Self::Output {
        Self::new(self.x + rhs.x, self.y + rhs.y)
    }
}

impl std::ops::Sub for Point2D {
    type Output = Self;
    #[inline(always)]
    fn sub(self, rhs: Self) -> Self::Output {
        Self::new(self.x - rhs.x, self.y - rhs.y)
    }
}

impl std::ops::Mul<f32> for Point2D {
    type Output = Self;
    #[inline(always)]
    fn mul(self, rhs: f32) -> Self::Output {
        Self::new(self.x * rhs, self.y * rhs)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct Size2D {
    pub width: f32,
    pub height: f32,
}

impl Size2D {
    #[inline(always)]
    pub const fn new(width: f32, height: f32) -> Self {
        Self { width, height }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct Rect2D {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

impl Rect2D {
    pub fn from_xywh(x: f32, y: f32, width: f32, height: f32) -> Self {
        let (min_x, max_x) = if width >= 0.0 {
            (x, x + width)
        } else {
            (x + width, x)
        };
        let (min_y, max_y) = if height >= 0.0 {
            (y, y + height)
        } else {
            (y + height, y)
        };
        Self {
            min_x,
            min_y,
            max_x,
            max_y,
        }
    }

    pub fn from_points(points: &[Point2D]) -> Self {
        if points.is_empty() {
            return Self::default();
        }
        let mut min_x = f32::MAX;
        let mut min_y = f32::MAX;
        let mut max_x = f32::MIN;
        let mut max_y = f32::MIN;
        for p in points {
            if p.x < min_x {
                min_x = p.x;
            }
            if p.x > max_x {
                max_x = p.x;
            }
            if p.y < min_y {
                min_y = p.y;
            }
            if p.y > max_y {
                max_y = p.y;
            }
        }
        Self {
            min_x,
            min_y,
            max_x,
            max_y,
        }
    }

    #[inline(always)]
    pub fn x(&self) -> f32 {
        self.min_x
    }

    #[inline(always)]
    pub fn y(&self) -> f32 {
        self.min_y
    }

    #[inline(always)]
    pub fn width(&self) -> f32 {
        (self.max_x - self.min_x).max(0.0)
    }

    #[inline(always)]
    pub fn height(&self) -> f32 {
        (self.max_y - self.min_y).max(0.0)
    }

    #[inline(always)]
    pub fn center(&self) -> Point2D {
        Point2D::new(
            (self.min_x + self.max_x) * 0.5,
            (self.min_y + self.max_y) * 0.5,
        )
    }

    #[inline(always)]
    pub fn area(&self) -> f32 {
        self.width() * self.height()
    }

    #[inline(always)]
    pub fn contains_point(&self, p: Point2D) -> bool {
        p.x >= self.min_x && p.x <= self.max_x && p.y >= self.min_y && p.y <= self.max_y
    }

    #[inline(always)]
    pub fn contains_rect(&self, other: &Rect2D) -> bool {
        other.min_x >= self.min_x
            && other.max_x <= self.max_x
            && other.min_y >= self.min_y
            && other.max_y <= self.max_y
    }

    #[inline(always)]
    pub fn intersects(&self, other: &Rect2D) -> bool {
        !(self.max_x < other.min_x
            || self.min_x > other.max_x
            || self.max_y < other.min_y
            || self.min_y > other.max_y)
    }

    pub fn intersection(&self, other: &Rect2D) -> Option<Rect2D> {
        let min_x = self.min_x.max(other.min_x);
        let min_y = self.min_y.max(other.min_y);
        let max_x = self.max_x.min(other.max_x);
        let max_y = self.max_y.min(other.max_y);
        if min_x <= max_x && min_y <= max_y {
            Some(Rect2D {
                min_x,
                min_y,
                max_x,
                max_y,
            })
        } else {
            None
        }
    }

    pub fn union(&self, other: &Rect2D) -> Rect2D {
        Rect2D {
            min_x: self.min_x.min(other.min_x),
            min_y: self.min_y.min(other.min_y),
            max_x: self.max_x.max(other.max_x),
            max_y: self.max_y.max(other.max_y),
        }
    }

    pub fn expand(&self, padding: f32) -> Rect2D {
        Rect2D {
            min_x: self.min_x - padding,
            min_y: self.min_y - padding,
            max_x: self.max_x + padding,
            max_y: self.max_y + padding,
        }
    }
}

/// Dynamic resize handles around selected elements
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResizeHandle {
    Nw,
    Ne,
    Se,
    Sw,
    N,
    S,
    E,
    W,
}

impl ResizeHandle {
    pub const ALL: [ResizeHandle; 8] = [
        ResizeHandle::Nw,
        ResizeHandle::Ne,
        ResizeHandle::Se,
        ResizeHandle::Sw,
        ResizeHandle::N,
        ResizeHandle::S,
        ResizeHandle::E,
        ResizeHandle::W,
    ];

    /// Returns the exact GPUI CursorStyle for this handle
    pub fn cursor_style(self) -> CursorStyle {
        match self {
            ResizeHandle::Nw | ResizeHandle::Se => CursorStyle::ResizeUpRightDownLeft, // nwse-resize
            ResizeHandle::Ne | ResizeHandle::Sw => CursorStyle::ResizeUpLeftDownRight, // nesw-resize
            ResizeHandle::N | ResizeHandle::S => CursorStyle::ResizeUpDown,            // ns-resize
            ResizeHandle::E | ResizeHandle::W => CursorStyle::ResizeLeftRight,         // ew-resize
        }
    }

    /// Returns the handle center point for the given bounding rectangle
    pub fn position(self, bounds: &Rect2D) -> Point2D {
        let min_x = bounds.min_x;
        let max_x = bounds.max_x;
        let min_y = bounds.min_y;
        let max_y = bounds.max_y;
        let mid_x = (min_x + max_x) * 0.5;
        let mid_y = (min_y + max_y) * 0.5;

        match self {
            ResizeHandle::Nw => Point2D::new(min_x, min_y),
            ResizeHandle::Ne => Point2D::new(max_x, min_y),
            ResizeHandle::Se => Point2D::new(max_x, max_y),
            ResizeHandle::Sw => Point2D::new(min_x, max_y),
            ResizeHandle::N => Point2D::new(mid_x, min_y),
            ResizeHandle::S => Point2D::new(mid_x, max_y),
            ResizeHandle::E => Point2D::new(max_x, mid_y),
            ResizeHandle::W => Point2D::new(min_x, mid_y),
        }
    }

    /// Check if a mouse coordinate hits this handle (with given handle radius in canvas coords)
    pub fn hit_test(self, bounds: &Rect2D, mouse: Point2D, handle_radius: f32) -> bool {
        let pos = self.position(bounds);
        mouse.distance_to(pos) <= handle_radius
    }
}

/// Ray-casting algorithm for point-in-polygon containment test
pub fn point_in_polygon(point: Point2D, vertices: &[Point2D]) -> bool {
    if vertices.len() < 3 {
        return false;
    }
    let mut inside = false;
    let mut j = vertices.len() - 1;
    for i in 0..vertices.len() {
        let vi = vertices[i];
        let vj = vertices[j];

        let intersect = ((vi.y > point.y) != (vj.y > point.y))
            && (point.x < (vj.x - vi.x) * (point.y - vi.y) / (vj.y - vi.y) + vi.x);
        if intersect {
            inside = !inside;
        }
        j = i;
    }
    inside
}

/// Shortest distance from point P to line segment AB
pub fn distance_to_segment(p: Point2D, a: Point2D, b: Point2D) -> f32 {
    let l2 = a.distance_sq(b);
    if l2 == 0.0 {
        return p.distance_to(a);
    }
    let t = (((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2).clamp(0.0, 1.0);
    let projection = Point2D::new(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
    p.distance_to(projection)
}
