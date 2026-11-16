from datetime import datetime, timezone
from typing import Sequence
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.element import CanvasElement
from app.schemas.element import ElementCreate, BulkSyncResponse, ElementResponse
from app.services.hierarchy_service import HierarchyService


class ElementService:
    @staticmethod
    async def get_board_elements(db: AsyncSession, board_id: str, include_deleted: bool = False) -> Sequence[CanvasElement]:
        query = select(CanvasElement).where(CanvasElement.board_id == board_id)
        if not include_deleted:
            query = query.where(CanvasElement.is_deleted.is_(False))
        query = query.order_by(CanvasElement.z_index.asc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def bulk_sync_elements(db: AsyncSession, board_id: str, elements_data: list[ElementCreate]) -> BulkSyncResponse:
        # Validate parent cyclic hierarchy
        HierarchyService.validate_parent_cycles(elements_data)

        # 1. Soft-delete any elements belonging to this board that were removed on the client
        incoming_ids = {item.id for item in elements_data}
        query_existing = select(CanvasElement).where(
            and_(
                CanvasElement.board_id == board_id,
                CanvasElement.is_deleted.is_(False)
            )
        )
        res = await db.execute(query_existing)
        existing_board_elements = res.scalars().all()
        for el in existing_board_elements:
            if el.id not in incoming_ids:
                el.is_deleted = True
                el.updated_at = datetime.now(timezone.utc)

        # 2. Upsert incoming active elements
        synced_elements: list[CanvasElement] = []

        for item in elements_data:
            existing = await db.get(CanvasElement, item.id)
            if existing:
                existing.board_id = item.board_id
                existing.type = item.type
                existing.parentclass = item.parentclass
                existing.managerclasshash = item.managerclasshash
                existing.x = item.x
                existing.y = item.y
                existing.width = item.width
                existing.height = item.height
                existing.rotation = item.rotation
                existing.z_index = item.z_index
                existing.properties = item.properties
                existing.version = item.version + 1
                existing.is_deleted = False
                existing.updated_at = datetime.now(timezone.utc)
                synced_elements.append(existing)
            else:
                new_element = CanvasElement(
                    id=item.id,
                    board_id=item.board_id,
                    type=item.type,
                    parentclass=item.parentclass,
                    managerclasshash=item.managerclasshash,
                    x=item.x,
                    y=item.y,
                    width=item.width,
                    height=item.height,
                    rotation=item.rotation,
                    z_index=item.z_index,
                    properties=item.properties,
                    version=item.version,
                    is_deleted=False
                )
                db.add(new_element)
                synced_elements.append(new_element)

        await db.commit()
        for elem in synced_elements:
            await db.refresh(elem)

        return BulkSyncResponse(
            board_id=board_id,
            server_time=datetime.now(timezone.utc),
            synced_count=len(synced_elements),
            elements=[ElementResponse.model_validate(e) for e in synced_elements]
        )
