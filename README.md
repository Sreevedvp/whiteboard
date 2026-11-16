# Whiteboard App (Excalidraw-Inspired)

A high-performance whiteboard application inspired by [Excalidraw](https://excalidraw.com), engineered with an object-oriented instance model, dynamic containment hierarchy, and manager class synchronization.

## Tech Stack
- **Frontend**: Angular 22 (Zoneless with `provideZonelessChangeDetection()`, Signals reactive state)
- **Rendering**: HTML5 Canvas with [Rough.js](https://roughjs.com/) for hand-drawn aesthetic
- **Backend**: FastAPI (Python 3.13+) with async SQLAlchemy 2.0 & WebSockets
- **Database**: PostgreSQL with single-table design (`managerclasshash`, `parentclass`)

---

## Architecture Highlights
- **OOP Instance Model**: Every shape (`RectangleElement`, `EllipseElement`, `PolygonElement`, `ArrowElement`, `TextElement`) inherits from `CommonObjectClass` and `BasePolygonElement`.
- **Instance Lifecycle**: Supports `resetInstance()`, `removeInstance()`, and `updateProperties()` (color, stroke width, styles, font size).
- **Dynamic Parent-Child & Inversion**:
  - Small box placed within a large box automatically becomes a child.
  - Moving a parent moves all child instances proportionally.
  - When a child element expands beyond its parent, **dynamic inversion** occurs (child becomes parent).
- **ManagerClass Pattern**:
  - Only the **outermost bounding polygon** in a hierarchy tree receives the `ManagerClass` role and generates the deterministic `managerclasshash`.
  - All nested child instances carry this `managerclasshash` and immediate `parentclass` (nullable).
- **Single-Table Database Schema**: Only one `canvas_elements` table stores all board elements, spatial coordinates, properties JSONB, and hierarchy pointers.

---

## Quick Start

### 1. Start PostgreSQL (Docker)
```bash
docker compose up -d
```

### 2. Start FastAPI Backend
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
python run.py
```
API Documentation will be accessible at: `http://localhost:8000/docs`

### 3. Start Angular 22 Frontend
```bash
cd frontend
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npm start
```
Whiteboard will be accessible at: `http://localhost:4200`

---

## Testing
To run backend hierarchy containment and cycle tests:
```bash
PYTHONPATH=backend backend/venv/bin/pytest backend/test_hierarchy.py
```
# whiteboard
