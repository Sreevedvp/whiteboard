use gpui::prelude::*;
use gpui::{
    px, size, App, Application, Bounds, Menu, TitlebarOptions, WindowBounds, WindowOptions,
};
use whiteboard_desktop::ui::WhiteboardView;

fn main() {
    Application::new().run(|cx: &mut App| {
        cx.set_menus(vec![Menu {
            name: "Whiteboard".into(),
            items: vec![],
        }]);

        let window_bounds = Bounds::centered(None, size(px(1280.0), px(840.0)), cx);

        cx.open_window(
            WindowOptions {
                titlebar: Some(TitlebarOptions {
                    title: Some("Whiteboard Desktop (GPUI)".into()),
                    ..Default::default()
                }),
                window_bounds: Some(WindowBounds::Windowed(window_bounds)),
                focus: true,
                ..Default::default()
            },
            |window, cx| cx.new(|cx| WhiteboardView::new(window, cx)),
        )
        .unwrap();

        cx.on_window_closed(|cx| {
            cx.quit();
        })
        .detach();

        cx.activate(true);
    });
}
