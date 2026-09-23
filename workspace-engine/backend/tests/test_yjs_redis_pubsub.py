"""Unit tests for Yjs real-time collaboration manager and multi-pod Redis sync."""

import base64
import json
from unittest.mock import AsyncMock

import pytest

from app.websocket.yjs_server import YjsConnectionManager


class MockWebSocket:
    def __init__(self):
        self.sent_texts = []
        self.sent_bytes = []
        self.accepted = False
        self.closed = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, text: str):
        self.sent_texts.append(text)

    async def send_bytes(self, data: bytes):
        self.sent_bytes.append(data)

    async def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_yjs_manager_local_text_broadcast():
    """Verify in-memory local broadcast reaches peer websockets but excludes sender."""
    manager = YjsConnectionManager()
    # Force offline Redis
    manager.get_redis = AsyncMock(return_value=None)

    ws1 = MockWebSocket()
    ws2 = MockWebSocket()
    ws3 = MockWebSocket()

    page_id = "page-test-123"
    await manager.connect(page_id, ws1)
    await manager.connect(page_id, ws2)
    await manager.connect(page_id, ws3)

    assert ws1.accepted and ws2.accepted and ws3.accepted
    assert len(manager.rooms[page_id]) == 3

    # ws1 sends broadcast
    await manager.broadcast(page_id, json.dumps({"action": "edit"}), sender=ws1)

    assert len(ws1.sent_texts) == 0
    assert len(ws2.sent_texts) == 1
    assert len(ws3.sent_texts) == 1
    assert json.loads(ws2.sent_texts[0]) == {"action": "edit"}

    await manager.disconnect(page_id, ws1)
    await manager.disconnect(page_id, ws2)
    await manager.disconnect(page_id, ws3)
    assert page_id not in manager.rooms


@pytest.mark.asyncio
async def test_yjs_manager_local_bytes_broadcast():
    """Verify Yjs binary CRDT state updates are relayed as bytes."""
    manager = YjsConnectionManager()
    manager.get_redis = AsyncMock(return_value=None)

    ws1 = MockWebSocket()
    ws2 = MockWebSocket()
    page_id = "page-crdt-binary"

    await manager.connect(page_id, ws1)
    await manager.connect(page_id, ws2)

    binary_crdt_payload = b"\x01\x02\x03\x04\x00\xff"
    await manager.broadcast_bytes(page_id, binary_crdt_payload, sender=ws1)

    assert len(ws1.sent_bytes) == 0
    assert len(ws2.sent_bytes) == 1
    assert ws2.sent_bytes[0] == binary_crdt_payload

    await manager.disconnect(page_id, ws1)
    await manager.disconnect(page_id, ws2)


@pytest.mark.asyncio
async def test_yjs_manager_publishes_to_redis():
    """Verify that when Redis is available, updates are published with pod envelope."""
    manager = YjsConnectionManager()
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    manager.get_redis = AsyncMock(return_value=mock_redis)

    ws1 = MockWebSocket()
    page_id = "page-redis-publish"
    await manager.connect(page_id, ws1)

    # 1. Text broadcast
    await manager.broadcast(page_id, '{"foo":"bar"}', sender=ws1)
    assert mock_redis.publish.called
    channel, envelope_str = mock_redis.publish.call_args[0]
    assert channel == f"yjs:room:{page_id}"
    envelope = json.loads(envelope_str)
    assert envelope["sender_pod"] == manager.pod_id
    assert envelope["type"] == "text"
    assert envelope["data"] == '{"foo":"bar"}'

    # 2. Binary broadcast
    mock_redis.publish.reset_mock()
    binary_data = b"\xde\xad\xbe\xef"
    await manager.broadcast_bytes(page_id, binary_data, sender=ws1)
    assert mock_redis.publish.called
    _, bin_envelope_str = mock_redis.publish.call_args[0]
    bin_envelope = json.loads(bin_envelope_str)
    assert bin_envelope["sender_pod"] == manager.pod_id
    assert bin_envelope["type"] == "binary"
    assert base64.b64decode(bin_envelope["data"]) == binary_data

    await manager.disconnect(page_id, ws1)


@pytest.mark.asyncio
async def test_yjs_manager_presence_and_leave():
    """Verify presence tracking and automatic leave event notification."""
    manager = YjsConnectionManager()
    manager.get_redis = AsyncMock(return_value=None)

    ws1 = MockWebSocket()
    ws2 = MockWebSocket()
    page_id = "page-presence"

    await manager.connect(page_id, ws1)
    await manager.connect(page_id, ws2)

    presence_payload = {
        "clientId": "client-abc",
        "user": {"name": "Alice", "color": "#ff0000"},
        "cursor": {"blockId": "b1", "offset": 5},
    }

    await manager.handle_presence_update(page_id, ws1, presence_payload)
    assert len(manager.get_room_presences(page_id)) == 1
    assert manager.get_room_presences(page_id)[0] == presence_payload
    # ws2 receives presence update
    assert len(ws2.sent_texts) == 1
    assert json.loads(ws2.sent_texts[0])["type"] == "presence_update"

    # ws1 disconnects, should trigger presence_leave
    await manager.disconnect(page_id, ws1)
    assert len(ws2.sent_texts) == 2
    leave_msg = json.loads(ws2.sent_texts[1])
    assert leave_msg["type"] == "presence_leave"
    assert leave_msg["clientId"] == "client-abc"
