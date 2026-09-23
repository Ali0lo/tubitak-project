"""WebSocket collaboration server for real-time Yjs CRDT synchronization and presence."""
import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("yjs_websocket")


class YjsConnectionManager:
    """Manages active WebSockets by document room (page_id)."""

    def __init__(self):
        # page_id -> set of active WebSockets
        self.rooms: Dict[str, Set[WebSocket]] = {}
        # websocket -> {user_id, name, color, cursor}
        self.presences: Dict[WebSocket, dict] = {}
        self._lock = asyncio.Lock()

    async def connect(self, page_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            if page_id not in self.rooms:
                self.rooms[page_id] = set()
            self.rooms[page_id].add(websocket)
        logger.info(f"Client connected to room {page_id}. Total: {len(self.rooms[page_id])}")

    async def disconnect(self, page_id: str, websocket: WebSocket):
        async with self._lock:
            if page_id in self.rooms and websocket in self.rooms[page_id]:
                self.rooms[page_id].remove(websocket)
                if not self.rooms[page_id]:
                    del self.rooms[page_id]
            left_presence = self.presences.pop(websocket, None)

        if left_presence:
            # Broadcast user left event
            await self.broadcast(
                page_id,
                json.dumps(
                    {
                        "type": "presence_leave",
                        "clientId": left_presence.get("clientId"),
                        "user": left_presence.get("user"),
                    }
                ),
                sender=None,
            )
        logger.info(f"Client disconnected from room {page_id}")

    async def broadcast(self, page_id: str, message: str, sender: WebSocket = None):
        """Broadcast text/JSON message to all peers in the room except sender."""
        async with self._lock:
            peers = list(self.rooms.get(page_id, []))

        for peer in peers:
            if peer != sender:
                try:
                    await peer.send_text(message)
                except Exception as e:
                    logger.warning(f"Error sending message to peer: {e}")

    async def broadcast_bytes(self, page_id: str, data: bytes, sender: WebSocket = None):
        """Broadcast raw binary Yjs update to peers."""
        async with self._lock:
            peers = list(self.rooms.get(page_id, []))

        for peer in peers:
            if peer != sender:
                try:
                    await peer.send_bytes(data)
                except Exception as e:
                    logger.warning(f"Error sending bytes to peer: {e}")

    async def handle_presence_update(
        self, page_id: str, websocket: WebSocket, presence_data: dict
    ):
        """Store and broadcast awareness/cursor state."""
        self.presences[websocket] = presence_data
        await self.broadcast(
            page_id,
            json.dumps({"type": "presence_update", "presence": presence_data}),
            sender=websocket,
        )

    def get_room_presences(self, page_id: str) -> list:
        presences = []
        peers = self.rooms.get(page_id, set())
        for peer in peers:
            if peer in self.presences:
                presences.append(self.presences[peer])
        return presences


yjs_manager = YjsConnectionManager()
