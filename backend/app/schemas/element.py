from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class ElementBase(BaseModel):
    id: str
    board_id: str
    type: str
    parentclass: Optional[str] = None
    managerclasshash: Optional[str] = None
    x: float = 0.0
    y: float = 0.0
    width: float = 0.0
    height: float = 0.0
    rotation: float = 0.0
    z_index: int = 0
    properties: dict[str, Any] = Field(default_factory=dict)
    version: int = 1
    is_deleted: bool = False


class ElementCreate(ElementBase):
    pass


class ElementUpdate(BaseModel):
    parentclass: Optional[str] = None
    managerclasshash: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: Optional[float] = None
    z_index: Optional[int] = None
    properties: Optional[dict[str, Any]] = None
    version: Optional[int] = None
    is_deleted: Optional[bool] = None


class ElementResponse(ElementBase):
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkSyncRequest(BaseModel):
    board_id: str
    client_version: Optional[int] = None
    elements: list[ElementCreate]


class BulkSyncResponse(BaseModel):
    board_id: str
    server_time: datetime
    synced_count: int
    elements: list[ElementResponse]
