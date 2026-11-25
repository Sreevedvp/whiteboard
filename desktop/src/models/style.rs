use gpui::{rgba, Hsla, Rgba};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ColorRgba {
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
}

impl ColorRgba {
    pub const TRANSPARENT: Self = Self {
        r: 0.0,
        g: 0.0,
        b: 0.0,
        a: 0.0,
    };
    pub const BLACK: Self = Self {
        r: 0.12,
        g: 0.12,
        b: 0.12,
        a: 1.0,
    };
    pub const WHITE: Self = Self {
        r: 1.0,
        g: 1.0,
        b: 1.0,
        a: 1.0,
    };

    pub const fn new(r: f32, g: f32, b: f32, a: f32) -> Self {
        Self { r, g, b, a }
    }

    pub fn from_hex(hex: &str) -> Self {
        let hex = hex.trim_start_matches('#');
        if hex.eq_ignore_ascii_case("transparent") || hex.is_empty() {
            return Self::TRANSPARENT;
        }
        if hex.len() == 6 {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f32 / 255.0;
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f32 / 255.0;
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f32 / 255.0;
            Self::new(r, g, b, 1.0)
        } else if hex.len() == 8 {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f32 / 255.0;
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f32 / 255.0;
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f32 / 255.0;
            let a = u8::from_str_radix(&hex[6..8], 16).unwrap_or(255) as f32 / 255.0;
            Self::new(r, g, b, a)
        } else {
            Self::BLACK
        }
    }

    pub fn to_hex(&self) -> String {
        if self.a <= 0.001 {
            return "transparent".to_string();
        }
        let r = (self.r.clamp(0.0, 1.0) * 255.0).round() as u8;
        let g = (self.g.clamp(0.0, 1.0) * 255.0).round() as u8;
        let b = (self.b.clamp(0.0, 1.0) * 255.0).round() as u8;
        if (self.a - 1.0).abs() < 0.01 {
            format!("#{:02x}{:02x}{:02x}", r, g, b)
        } else {
            let a = (self.a.clamp(0.0, 1.0) * 255.0).round() as u8;
            format!("#{:02x}{:02x}{:02x}{:02x}", r, g, b, a)
        }
    }

    pub fn to_gpui_rgba(&self) -> Rgba {
        rgba(
            ((self.r.clamp(0.0, 1.0) * 255.0).round() as u32) << 24
                | ((self.g.clamp(0.0, 1.0) * 255.0).round() as u32) << 16
                | ((self.b.clamp(0.0, 1.0) * 255.0).round() as u32) << 8
                | ((self.a.clamp(0.0, 1.0) * 255.0).round() as u32),
        )
    }

    pub fn to_gpui_hsla(&self) -> Hsla {
        self.to_gpui_rgba().into()
    }
}

impl Default for ColorRgba {
    fn default() -> Self {
        Self::BLACK
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum StrokeStyle {
    #[default]
    Solid,
    Dashed,
    Dotted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum RenderMode {
    #[default]
    Polished,
    Sketch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum FontStyle {
    Clean,
    #[default]
    Crayon,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ElementStyle {
    pub stroke_color: ColorRgba,
    pub fill_color: ColorRgba,
    pub stroke_width: f32,
    pub stroke_style: StrokeStyle,
    pub corner_radius: f32,
    pub render_mode: RenderMode,
    pub font_style: FontStyle,
    pub font_size: f32,
}

impl Default for ElementStyle {
    fn default() -> Self {
        Self {
            stroke_color: ColorRgba::from_hex("#1e1e1e"),
            fill_color: ColorRgba::from_hex("#fff9db"), // default subtle yellow tint like screenshot
            stroke_width: 2.0,
            stroke_style: StrokeStyle::Solid,
            corner_radius: 8.0,
            render_mode: RenderMode::Polished,
            font_style: FontStyle::Crayon,
            font_size: 18.0,
        }
    }
}
