use gpui::CursorStyle;
use whiteboard_desktop::models::element::CommonObject;
use whiteboard_desktop::models::geometry::{point_in_polygon, Point2D, Rect2D, ResizeHandle};
use whiteboard_desktop::models::manager::ManagerClass;
use whiteboard_desktop::models::style::ElementStyle;
use whiteboard_desktop::state::canvas_state::CanvasState;
use whiteboard_desktop::storage::db::WhiteboardDb;

#[test]
fn test_geometry_containment_and_handles() {
    let rect = Rect2D::from_xywh(100.0, 100.0, 200.0, 150.0);
    assert!(rect.contains_point(Point2D::new(150.0, 150.0)));
    assert!(!rect.contains_point(Point2D::new(50.0, 150.0)));

    // Diamond polygon
    let diamond_pts = vec![
        Point2D::new(200.0, 100.0),
        Point2D::new(300.0, 175.0),
        Point2D::new(200.0, 250.0),
        Point2D::new(100.0, 175.0),
    ];
    assert!(point_in_polygon(Point2D::new(200.0, 175.0), &diamond_pts));
    assert!(!point_in_polygon(Point2D::new(110.0, 110.0), &diamond_pts));

    // Handle cursors
    assert_eq!(
        ResizeHandle::Nw.cursor_style(),
        CursorStyle::ResizeUpRightDownLeft
    );
    assert_eq!(
        ResizeHandle::Se.cursor_style(),
        CursorStyle::ResizeUpRightDownLeft
    );
    assert_eq!(
        ResizeHandle::Ne.cursor_style(),
        CursorStyle::ResizeUpLeftDownRight
    );
    assert_eq!(
        ResizeHandle::Sw.cursor_style(),
        CursorStyle::ResizeUpLeftDownRight
    );
    assert_eq!(ResizeHandle::N.cursor_style(), CursorStyle::ResizeUpDown);
    assert_eq!(ResizeHandle::S.cursor_style(), CursorStyle::ResizeUpDown);
    assert_eq!(ResizeHandle::E.cursor_style(), CursorStyle::ResizeLeftRight);
    assert_eq!(ResizeHandle::W.cursor_style(), CursorStyle::ResizeLeftRight);
}

#[test]
fn test_manager_hierarchy_and_sticking_out_calculation() {
    let style = ElementStyle::default();

    // Large background container
    let container = CommonObject::new_rectangle(100.0, 100.0, 400.0, 300.0, style.clone());

    // Small box completely inside
    let inside_box = CommonObject::new_rectangle(150.0, 150.0, 100.0, 60.0, style.clone());

    // Small box sticking out (> 50% outside)
    let sticking_out_box = CommonObject::new_rectangle(450.0, 200.0, 120.0, 80.0, style.clone());

    let mut elements = vec![
        container.clone(),
        inside_box.clone(),
        sticking_out_box.clone(),
    ];
    ManagerClass::recalculate_all_hierarchies(&mut elements);

    // Verify inside_box has container as parent and manager hash
    let updated_inside = elements.iter().find(|e| e.bounds.min_x == 150.0).unwrap();
    assert_eq!(updated_inside.parent_id, Some(container.id.clone()));
    assert!(updated_inside.manager_hash.is_some());

    // Verify sticking_out_box does NOT have container as parent
    let updated_outside = elements.iter().find(|e| e.bounds.min_x == 450.0).unwrap();
    assert_eq!(updated_outside.parent_id, None);
    assert_eq!(updated_outside.manager_hash, None);
}

#[test]
fn test_topological_stacking_order_parents_behind_children() {
    let style = ElementStyle::default();

    let parent = CommonObject::new_rectangle(100.0, 100.0, 500.0, 400.0, style.clone());
    let child1 = CommonObject::new_rectangle(150.0, 150.0, 100.0, 80.0, style.clone());
    let child2 = CommonObject::new_text(180.0, 200.0, "Child Text".to_string(), style.clone());

    // Place children before parent in initial vector
    let mut elements = vec![child1.clone(), child2.clone(), parent.clone()];

    // Reorder hierarchies
    ManagerClass::recalculate_all_hierarchies(&mut elements);

    // Parent must now be at index 0 (rendered first/behind children)
    assert_eq!(elements[0].id, parent.id);
    assert_eq!(elements[0].z_index, 0);

    // Children must be at subsequent indices with higher z_index
    let p_idx = elements.iter().position(|e| e.id == parent.id).unwrap();
    let c1_idx = elements.iter().position(|e| e.id == child1.id).unwrap();
    let c2_idx = elements.iter().position(|e| e.id == child2.id).unwrap();

    assert!(p_idx < c1_idx, "Parent must render before child1");
    assert!(p_idx < c2_idx, "Parent must render before child2");
}

#[test]
fn test_layering_bring_front_and_send_back() {
    let mut state = CanvasState::new();
    let style = ElementStyle::default();

    let el1 = CommonObject::new_rectangle(50.0, 50.0, 80.0, 80.0, style.clone());
    let el2 = CommonObject::new_rectangle(200.0, 200.0, 80.0, 80.0, style.clone());
    let el3 = CommonObject::new_rectangle(350.0, 350.0, 80.0, 80.0, style.clone());

    let id1 = state.add_element(el1);
    let id2 = state.add_element(el2);
    let _id3 = state.add_element(el3);

    // Send el2 to back
    state.send_to_back(Some(&id2));
    assert_eq!(state.elements[0].id, id2);

    // Bring el1 to front
    state.bring_to_front(Some(&id1));
    assert_eq!(state.elements.last().unwrap().id, id1);
}

#[test]
fn test_sqlite_storage_roundtrip() {
    let temp_db_file = tempfile::NamedTempFile::new().unwrap();
    let db_path = temp_db_file.path().to_path_buf();

    let mut db = WhiteboardDb::open_or_create(&db_path).unwrap();

    let style = ElementStyle {
        corner_radius: 16.0,
        stroke_width: 4.0,
        ..ElementStyle::default()
    };
    let mut el = CommonObject::new_rectangle(120.0, 80.0, 240.0, 160.0, style);
    el.clip_content = true;

    db.save_elements("test_board", &[el.clone()]).unwrap();

    let loaded = db.load_elements("test_board").unwrap();
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].id, el.id);
    assert_eq!(loaded[0].bounds.width(), 240.0);
    assert_eq!(loaded[0].bounds.height(), 160.0);
    assert!(loaded[0].clip_content);
    assert_eq!(loaded[0].style.corner_radius, 16.0);
    assert_eq!(loaded[0].style.stroke_width, 4.0);
}
