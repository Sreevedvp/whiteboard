import json
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # Maps board_id to set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, board_id: str, websocket: WebSocket):
        await websocket.accept()
        if board_id not in self.active_connections:
            self.active_connections[board_id] = set()
        self.active_connections[board_id].add(websocket)

    def disconnect(self, board_id: str, websocket: WebSocket):
        if board_id in self.active_connections:
            self.active_connections[board_id].discard(websocket)
            if not self.active_connections[board_id]:
                del self.active_connections[board_id]

    async def broadcast(self, board_id: str, message: dict, sender: WebSocket):
        if board_id in self.active_connections:
            data = json.dumps(message)
            for connection in self.active_connections[board_id]:
                if connection != sender:
                    await connection.send_text(data)


ws_manager = ConnectionManager()


@router.websocket("/boards/{board_id}/live")
async def websocket_endpoint(websocket: WebSocket, board_id: str):
    await ws_manager.connect(board_id, websocket)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                payload = json.loads(data_text)
                await ws_manager.broadcast(board_id, payload, sender=websocket)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(board_id, websocket)
