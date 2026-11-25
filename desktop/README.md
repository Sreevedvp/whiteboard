# Whiteboard Desktop (GPUI / Rust)

A native, high-performance macOS desktop application for Whiteboard built using **Zed's GPUI framework** in Rust.

## Architecture & Rust Best Practices

### 1. Ownership & Zero-Cost Abstractions
- **Single-Owner Canvas State**: The canvas state (`CanvasState`) maintains a contiguous, cache-friendly `Vec<CommonObject>` of elements.
- **Strongly Typed Identifiers**: Elements are referenced by `ElementId`, avoiding pointer loops, reference counting cycles, and unnecessary clones.
- **Tagged Enum Hierarchy (`ShapeKind`)**: All shapes (`Rectangle`, `Polygon`, `Ellipse`, `Arrow`, `Text`) are stored in a contiguous tagged enum, avoiding heap indirection (`Box<dyn Trait>`) and maximizing branch-prediction efficiency and cache locality.

### 2. Topological Stacking Order (Front & Back)
- **Topological In-Degree Sorting (`ensure_hierarchy_order`)**:
  - Automatically ensures **parents and container shapes always render behind their children** (`z_index = 0, 1, 2, ...`).
  - Stacking adjustments (`bring_to_front`, `send_to_back`, `bring_forward`, `send_backward`) respect and propagate hierarchy so children are never hidden behind their container surfaces.

### 3. Container Boundary Clipping
- **`clip_content` Flag**: When enabled on a container (rectangle, polygon, ellipse), GPUI's low-level GPU `window.with_content_mask(...)` automatically clips child shapes outside the container boundaries.

### 4. Dynamic Directional Cursors
- **8 Resize Handles**:
  - `Nw` / `Se` &rarr; `CursorStyle::ResizeUpRightDownLeft` (`nwse-resize`)
  - `Ne` / `Sw` &rarr; `CursorStyle::ResizeUpLeftDownRight` (`nesw-resize`)
  - `N` / `S` &rarr; `CursorStyle::ResizeUpDown` (`ns-resize`)
  - `E` / `W` &rarr; `CursorStyle::ResizeLeftRight` (`ew-resize`)
- When dragging to resize, the window cursor is locked to the handle's directional resize cursor throughout the entire operation.

### 5. Local SQLite Persistence & Autosave
- Uses `rusqlite` to persist all canvas elements to `whiteboard_desktop.db` matching the web backend's single-table schema.
- Changes automatically trigger autosave with live status indicator (`Autosaved ✓`).

## Running the Application

### Development Build
```bash
cargo check
cargo test
cargo run
```

### Release Build
```bash
cargo build --release
```
