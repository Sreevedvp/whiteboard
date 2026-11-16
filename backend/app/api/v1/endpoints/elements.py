from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.element import ElementResponse, BulkSyncRequest, BulkSyncResponse
from app.services.element_service import ElementService

router = APIRouter()


@router.get("/boards/{board_id}/elements", response_model=list[ElementResponse])
async def get_elements(
    board_id: str,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch all active elements for a given board.
    """
    elements = await ElementService.get_board_elements(db, board_id, include_deleted)
    return [ElementResponse.model_validate(e) for e in elements]


@router.post("/boards/{board_id}/elements/bulk-sync", response_model=BulkSyncResponse)
async def bulk_sync(
    board_id: str,
    request: BulkSyncRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Atomically upsert elements and synchronize hierarchy changes (parentclass, managerclasshash).
    """
    if request.board_id != board_id:
        raise HTTPException(status_code=400, detail="Board ID mismatch in request payload")
    
    return await ElementService.bulk_sync_elements(db, board_id, request.elements)
