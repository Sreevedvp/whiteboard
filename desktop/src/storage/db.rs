use crate::models::element::{CommonObject, ShapeKind};
use crate::models::geometry::{Point2D, Rect2D};
use crate::models::id::ElementId;
use crate::models::style::{ColorRgba, ElementStyle, FontStyle, RenderMode, StrokeStyle};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize)]
struct PropertiesPayload {
    stroke: String,
    fill: String,
    stroke_width: f32,
    stroke_style: StrokeStyle,
    corner_radius: f32,
    render_mode: RenderMode,
    font_style: FontStyle,
    font_size: f32,
    points: Option<Vec<Point2D>>,
    is_diamond: Option<bool>,
    rx: Option<f32>,
    ry: Option<f32>,
    start: Option<Point2D>,
    end: Option<Point2D>,
    text: Option<String>,
}

pub struct WhiteboardDb {
    conn: Connection,
}

impl WhiteboardDb {
    pub fn open_or_create(db_path: impl AsRef<Path>) -> rusqlite::Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS canvas_elements (
                id TEXT PRIMARY KEY,
                board_id TEXT NOT NULL,
                type TEXT NOT NULL,
                parentclass TEXT,
                managerclasshash TEXT,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                z_index INTEGER NOT NULL,
                clipcontent INTEGER NOT NULL DEFAULT 0,
                properties TEXT NOT NULL
            );",
            [],
        )?;
        Ok(Self { conn })
    }

    pub fn load_elements(&self, board_id: &str) -> rusqlite::Result<Vec<CommonObject>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, type, parentclass, managerclasshash, x, y, width, height, z_index, clipcontent, properties
             FROM canvas_elements
             WHERE board_id = ?
             ORDER BY z_index ASC",
        )?;

        let element_iter = stmt.query_map(params![board_id], |row| {
            let id: String = row.get(0)?;
            let el_type: String = row.get(1)?;
            let parentclass: Option<String> = row.get(2)?;
            let managerclasshash: Option<String> = row.get(3)?;
            let x: f32 = row.get(4)?;
            let y: f32 = row.get(5)?;
            let width: f32 = row.get(6)?;
            let height: f32 = row.get(7)?;
            let z_index: i32 = row.get(8)?;
            let clipcontent: i32 = row.get(9)?;
            let properties_json: String = row.get(10)?;

            let prop: PropertiesPayload =
                serde_json::from_str(&properties_json).unwrap_or_else(|_| PropertiesPayload {
                    stroke: "#1e1e1e".to_string(),
                    fill: "transparent".to_string(),
                    stroke_width: 2.0,
                    stroke_style: StrokeStyle::Solid,
                    corner_radius: 8.0,
                    render_mode: RenderMode::Polished,
                    font_style: FontStyle::Crayon,
                    font_size: 18.0,
                    points: None,
                    is_diamond: None,
                    rx: None,
                    ry: None,
                    start: None,
                    end: None,
                    text: None,
                });

            let style = ElementStyle {
                stroke_color: ColorRgba::from_hex(&prop.stroke),
                fill_color: ColorRgba::from_hex(&prop.fill),
                stroke_width: prop.stroke_width,
                stroke_style: prop.stroke_style,
                corner_radius: prop.corner_radius,
                render_mode: prop.render_mode,
                font_style: prop.font_style,
                font_size: prop.font_size,
            };

            let bounds = Rect2D::from_xywh(x, y, width, height);

            let kind = match el_type.as_str() {
                "polygon" => ShapeKind::Polygon {
                    points: prop.points.unwrap_or_else(|| {
                        vec![
                            Point2D::new(x + width * 0.5, y),
                            Point2D::new(x + width, y + height * 0.5),
                            Point2D::new(x + width * 0.5, y + height),
                            Point2D::new(x, y + height * 0.5),
                        ]
                    }),
                    is_diamond: prop.is_diamond.unwrap_or(true),
                },
                "ellipse" => ShapeKind::Ellipse {
                    rx: prop.rx.unwrap_or(width * 0.5),
                    ry: prop.ry.unwrap_or(height * 0.5),
                },
                "arrow" => ShapeKind::Arrow {
                    start: prop.start.unwrap_or(Point2D::new(x, y)),
                    end: prop.end.unwrap_or(Point2D::new(x + width, y + height)),
                },
                "text" => ShapeKind::Text {
                    content: prop.text.unwrap_or_else(|| "text".to_string()),
                    font_size: prop.font_size,
                    is_crayon: matches!(prop.font_style, FontStyle::Crayon),
                },
                _ => ShapeKind::Rectangle {
                    corner_radius: prop.corner_radius,
                },
            };

            Ok(CommonObject {
                id: ElementId(id),
                kind,
                bounds,
                style,
                clip_content: clipcontent != 0,
                z_index,
                parent_id: parentclass.map(ElementId),
                manager_hash: managerclasshash,
            })
        })?;

        let mut elements = Vec::new();
        for el in element_iter {
            if let Ok(e) = el {
                elements.push(e);
            }
        }
        Ok(elements)
    }

    pub fn save_elements(
        &mut self,
        board_id: &str,
        elements: &[CommonObject],
    ) -> rusqlite::Result<()> {
        let tx = self.conn.transaction()?;
        tx.execute(
            "DELETE FROM canvas_elements WHERE board_id = ?",
            params![board_id],
        )?;

        for el in elements {
            let mut prop = PropertiesPayload {
                stroke: el.style.stroke_color.to_hex(),
                fill: el.style.fill_color.to_hex(),
                stroke_width: el.style.stroke_width,
                stroke_style: el.style.stroke_style,
                corner_radius: el.style.corner_radius,
                render_mode: el.style.render_mode,
                font_style: el.style.font_style,
                font_size: el.style.font_size,
                points: None,
                is_diamond: None,
                rx: None,
                ry: None,
                start: None,
                end: None,
                text: None,
            };

            match &el.kind {
                ShapeKind::Polygon { points, is_diamond } => {
                    prop.points = Some(points.clone());
                    prop.is_diamond = Some(*is_diamond);
                }
                ShapeKind::Ellipse { rx, ry } => {
                    prop.rx = Some(*rx);
                    prop.ry = Some(*ry);
                }
                ShapeKind::Arrow { start, end } => {
                    prop.start = Some(*start);
                    prop.end = Some(*end);
                }
                ShapeKind::Text {
                    content, font_size, ..
                } => {
                    prop.text = Some(content.clone());
                    prop.font_size = *font_size;
                }
                _ => {}
            }

            let prop_json = serde_json::to_string(&prop).unwrap_or_else(|_| "{}".to_string());
            let parent_str = el.parent_id.as_ref().map(|p| p.as_str());

            tx.execute(
                "INSERT INTO canvas_elements (
                    id, board_id, type, parentclass, managerclasshash,
                    x, y, width, height, z_index, clipcontent, properties
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    el.id.as_str(),
                    board_id,
                    el.type_name(),
                    parent_str,
                    el.manager_hash.as_deref(),
                    el.bounds.x(),
                    el.bounds.y(),
                    el.bounds.width(),
                    el.bounds.height(),
                    el.z_index,
                    if el.clip_content { 1 } else { 0 },
                    prop_json,
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }
}
