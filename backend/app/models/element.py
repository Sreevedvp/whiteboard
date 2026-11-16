from datetime import datetime
from typing import Optional, Any
from sqlalchemy import String, Float, Integer, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class CanvasElement(Base):
    """
    Single-table canvas element model representing any whiteboard shape/node.
    Supports nullable parentclass (immediate parent) and managerclasshash (outermost manager polygon hash).
    """
    __tablename__ = "canvas_elements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    board_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)  # 'rectangle', 'text', 'polygon', etc.

    # Hierarchy & Manager pointers (both can be null)
    parentclass: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True, default=None)
    managerclasshash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True, default=None)

    # Spatial Coordinates & Transform
    x: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    y: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    width: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    height: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rotation: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    z_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # JSON payload for element-specific properties (points, text, stroke, fill, rough style)
    # Uses JSONB on Postgres or fallback to standard JSON
    properties: Mapped[dict[str, Any]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)

    # Sync and soft deletion
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
