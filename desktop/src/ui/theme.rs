use gpui::Rgba;

pub struct Theme;

impl Theme {
    pub const TRANSPARENT: Rgba = Rgba {
        r: 0.0,
        g: 0.0,
        b: 0.0,
        a: 0.0,
    };
    pub const WHITE: Rgba = Rgba {
        r: 1.0,
        g: 1.0,
        b: 1.0,
        a: 1.0,
    };
    pub const BLACK: Rgba = Rgba {
        r: 0.0,
        g: 0.0,
        b: 0.0,
        a: 1.0,
    };

    pub const BG_CANVAS: Rgba = Rgba {
        r: 0.97,
        g: 0.98,
        b: 0.98,
        a: 1.0,
    };
    pub const GRID_DOT: Rgba = Rgba {
        r: 0.81,
        g: 0.84,
        b: 0.87,
        a: 1.0,
    };

    pub const PANEL_BG: Rgba = Rgba {
        r: 1.0,
        g: 1.0,
        b: 1.0,
        a: 1.0,
    };
    pub const PANEL_BORDER: Rgba = Rgba {
        r: 0.90,
        g: 0.91,
        b: 0.92,
        a: 1.0,
    };

    pub const TEXT_PRIMARY: Rgba = Rgba {
        r: 0.07,
        g: 0.09,
        b: 0.15,
        a: 1.0,
    };
    pub const TEXT_MUTED: Rgba = Rgba {
        r: 0.42,
        g: 0.45,
        b: 0.50,
        a: 1.0,
    };
    pub const TEXT_ACCENT: Rgba = Rgba {
        r: 0.26,
        g: 0.22,
        b: 0.79,
        a: 1.0,
    };

    pub const ACCENT: Rgba = Rgba {
        r: 0.31,
        g: 0.27,
        b: 0.90,
        a: 1.0,
    };
    pub const ACCENT_LIGHT: Rgba = Rgba {
        r: 0.93,
        g: 0.91,
        b: 0.99,
        a: 1.0,
    };

    pub const BADGE_ROOT_BG: Rgba = Rgba {
        r: 0.95,
        g: 0.96,
        b: 0.96,
        a: 1.0,
    };
    pub const BADGE_ROOT_TEXT: Rgba = Rgba {
        r: 0.22,
        g: 0.25,
        b: 0.32,
        a: 1.0,
    };

    pub const BADGE_CHILD_BG: Rgba = Rgba {
        r: 0.94,
        g: 0.96,
        b: 1.0,
        a: 1.0,
    };
    pub const BADGE_CHILD_TEXT: Rgba = Rgba {
        r: 0.11,
        g: 0.31,
        b: 0.85,
        a: 1.0,
    };

    pub const BADGE_MANAGER_BG: Rgba = Rgba {
        r: 0.96,
        g: 0.95,
        b: 1.0,
        a: 1.0,
    };
    pub const BADGE_MANAGER_TEXT: Rgba = Rgba {
        r: 0.43,
        g: 0.16,
        b: 0.85,
        a: 1.0,
    };

    pub const DANGER: Rgba = Rgba {
        r: 0.94,
        g: 0.27,
        b: 0.27,
        a: 1.0,
    };
    pub const DANGER_LIGHT: Rgba = Rgba {
        r: 0.99,
        g: 0.95,
        b: 0.95,
        a: 1.0,
    };

    pub const SUCCESS: Rgba = Rgba {
        r: 0.06,
        g: 0.73,
        b: 0.51,
        a: 1.0,
    };
    pub const SUCCESS_LIGHT: Rgba = Rgba {
        r: 0.92,
        g: 0.99,
        b: 0.96,
        a: 1.0,
    };
}
