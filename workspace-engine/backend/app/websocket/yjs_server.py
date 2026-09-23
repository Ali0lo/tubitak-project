"""WebSocket collaboration server for real-time Yjs CRDT synchronization and presence with Redis Pub/Sub."""

import asyncio
import base64
import json
import logging
import uuid
from typing import Dict, List, Optional, Set

import redis.asyncio as aioredis
from fastapi import WebSocket
from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger("yjs_websocket")


class YjsConnectionManager:
    """Manages active WebSockets by document room (page_id) with multi-pod Redis Pub/Sub sync."""

    def __init__(self, redis_url: Optional[str] = None):
        self.pod_id: str = str(uuid.uuid4())
        # page_id -> set of active WebSockets
        self.rooms: Dict[str, Set[WebSocket]] = {}
        # websocket -> {user_id, name, color, cursor}
        self.presences: Dict[WebSocket, dict] = {}
        # page_id -> asyncio.Task running Redis listener
        self._listener_tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[Redis] = None
        self._redis_connected = False
        self._redis_warning_logged = False

    async def get_redis(self) -> Optional[Redis]:
        """Lazy-initialize Redis client connection."""
        if self._redis is not None:
            return self._redis

        try:
            client = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=False,
                socket_connect_timeout=2.0,
            )
            await client.ping()
            self._redis = client
            self._redis_connected = True
            logger.info(
                f"Connected to Redis Pub/Sub for Yjs at {self.redis_url} (pod={self.pod_id})"
            )
            return self._redis
        except Exception as e:
            if not self._redis_warning_logged:
                logger.warning(
                    f"Redis Pub/Sub unavailable ({e}). Operating in local in-memory collaboration mode."
                )
                self._redis_warning_logged = True
            self._redis_connected = False
            return None

    async def connect(self, page_id: str, websocket: WebSocket):
        await websocket.accept()
        is_first_peer = False
        async with self._lock:
            if page_id not in self.rooms:
                self.rooms[page_id] = set()
                is_first_peer = True
            self.rooms[page_id].add(websocket)

        if is_first_peer:
            await self._start_redis_listener(page_id)

        logger.info(
            f"Client connected to room {page_id}. Total local: {len(self.rooms.get(page_id, set()))}"
        )

    async def disconnect(self, page_id: str, websocket: WebSocket):
        is_last_peer = False
        async with self._lock:
            if page_id in self.rooms and websocket in self.rooms[page_id]:
                self.rooms[page_id].remove(websocket)
                if not self.rooms[page_id]:
                    del self.rooms[page_id]
                    is_last_peer = True
            left_presence = self.presences.pop(websocket, None)

        if is_last_peer:
            await self._stop_redis_listener(page_id)

        if left_presence:
            # Broadcast user left event locally and across pods
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

    async def _start_redis_listener(self, page_id: str):
        """Start background task listening to Redis Pub/Sub channel for page_id."""
        redis = await self.get_redis()
        if not redis:
            return

        async with self._lock:
            if page_id in self._listener_tasks:
                return
            task = asyncio.create_task(self._listen_redis_channel(page_id))
            self._listener_tasks[page_id] = task

    async def _stop_redis_listener(self, page_id: str):
        """Cancel and clean up Redis Pub/Sub listener for page_id."""
        async with self._lock:
            task = self._listener_tasks.pop(page_id, None)
        if task:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    async def _listen_redis_channel(self, page_id: str):
        """Listen to incoming Redis Pub/Sub messages and relay to local room peers."""
        channel_name = f"yjs:room:{page_id}"
        redis = await self.get_redis()
        if not redis:
            return

        pubsub = redis.pubsub()
        try:
            await pubsub.subscribe(channel_name)
            logger.debug(f"Subscribed to Redis channel {channel_name}")

            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message.get("type") == "message":
                    raw_data = message.get("data")
                    if isinstance(raw_data, bytes):
                        raw_data = raw_data.decode("utf-8")

                    try:
                        envelope = json.loads(raw_data)
                        sender_pod = envelope.get("sender_pod")
                        # Ignore self-pod messages to prevent loopback
                        if sender_pod == self.pod_id:
                            continue

                        msg_type = envelope.get("type")
                        data = envelope.get("data")

                        if msg_type == "binary" and data:
                            binary_bytes = base64.b64decode(data)
                            await self._broadcast_bytes_local(
                                page_id, binary_bytes, sender=None
                            )
                        elif msg_type == "text" and data:
                            await self._broadcast_text_local(
                                page_id, data, sender=None
                            )
                    except Exception as err:
                        logger.error(
                            f"Error handling Redis message on {channel_name}: {err}"
                        )

                await asyncio.sleep(0.01)

        except asyncio.CancelledError:
            try:
                await pubsub.unsubscribe(channel_name)
                await pubsub.close()
            except Exception:
                pass
            raise
        except Exception as e:
            logger.warning(f"Redis listener stopped for {channel_name}: {e}")

    async def _broadcast_text_local(
        self, page_id: str, message: str, sender: Optional[WebSocket] = None
    ):
        """Send text message to local peers in room except sender."""
        async with self._lock:
            peers = list(self.rooms.get(page_id, []))

        for peer in peers:
            if peer != sender:
                try:
                    await peer.send_text(message)
                except Exception as e:
                    logger.warning(f"Error sending text to peer: {e}")

    async def _broadcast_bytes_local(
        self, page_id: str, data: bytes, sender: Optional[WebSocket] = None
    ):
        """Send raw binary update to local peers in room except sender."""
        async with self._lock:
            peers = list(self.rooms.get(page_id, []))

        for peer in peers:
            if peer != sender:
                try:
                    await peer.send_bytes(data)
                except Exception as e:
                    logger.warning(f"Error sending bytes to peer: {e}")

    async def broadcast(
        self, page_id: str, message: str, sender: Optional[WebSocket] = None
    ):
        """Broadcast text/JSON message locally and publish to Redis for other pods."""
        # 1. Local broadcast
        await self._broadcast_text_local(page_id, message, sender=sender)

        # 2. Redis publish
        redis = await self.get_redis()
        if redis:
            try:
                envelope = json.dumps(
                    {
                        "sender_pod": self.pod_id,
                        "type": "text",
                        "data": message,
                    }
                )
                await redis.publish(f"yjs:room:{page_id}", envelope)
            except Exception as e:
                logger.warning(f"Failed to publish text to Redis: {e}")

    async def broadcast_bytes(
        self, page_id: str, data: bytes, sender: Optional[WebSocket] = None
    ):
        """Broadcast raw binary Yjs update locally and publish to Redis for other pods."""
        # 1. Local broadcast
        await self._broadcast_bytes_local(page_id, data, sender=sender)

        # 2. Redis publish
        redis = await self.get_redis()
        if redis:
            try:
                b64_data = base64.b64encode(data).decode("ascii")
                envelope = json.dumps(
                    {
                        "sender_pod": self.pod_id,
                        "type": "binary",
                        "data": b64_data,
                    }
                )
                await redis.publish(f"yjs:room:{page_id}", envelope)
            except Exception as e:
                logger.warning(f"Failed to publish bytes to Redis: {e}")

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

    def get_room_presences(self, page_id: str) -> List[dict]:
        presences = []
        peers = self.rooms.get(page_id, set())
        for peer in peers:
            if peer in self.presences:
                presences.append(self.presences[peer])
        return presences

    async def close(self):
        """Shutdown Redis connection and cancel all room listeners."""
        for task in list(self._listener_tasks.values()):
            task.cancel()
        self._listener_tasks.clear()

        if self._redis:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None


yjs_manager = YjsConnectionManager()
