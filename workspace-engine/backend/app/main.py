"""WorkspaceEngine FastAPI application entry point."""

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import Base, engine
from app.websocket.yjs_server import yjs_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("workspace_engine")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schemas verified and initialized.")
    # Initialize Redis Pub/Sub if available
    try:
        await yjs_manager.get_redis()
    except Exception as e:
        logger.warning(f"Initial Redis connection deferred: {e}")
    yield
    # Cleanup Redis connection and room listeners
    await yjs_manager.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


# Real-time Collaborative Yjs WebSocket Gateway
@app.websocket("/ws/collaboration/{page_id}")
async def websocket_collaboration_endpoint(websocket: WebSocket, page_id: str):
    """Real-time Yjs CRDT binary sync and presence cursor awareness protocol."""
    await yjs_manager.connect(page_id, websocket)

    # Send current room presences to the newly connected peer
    existing_presences = yjs_manager.get_room_presences(page_id)
    await websocket.send_text(
        json.dumps(
            {
                "type": "room_state",
                "pageId": page_id,
                "presences": existing_presences,
            }
        )
    )

    try:
        while True:
            # We receive either text JSON (for awareness/cursors) or bytes (for Yjs binary sync updates)
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                # Binary Yjs state update: relay directly to room peers
                await yjs_manager.broadcast_bytes(
                    page_id, message["bytes"], sender=websocket
                )
            elif "text" in message and message["text"]:
                text_data = message["text"]
                try:
                    payload = json.loads(text_data)
                    msg_type = payload.get("type")

                    if msg_type == "presence_update":
                        await yjs_manager.handle_presence_update(
                            page_id, websocket, payload.get("presence", {})
                        )
                    elif msg_type == "block_sync":
                        # Client sent debounced block snapshot; relay to peers
                        await yjs_manager.broadcast(
                            page_id, text_data, sender=websocket
                        )
                    else:
                        # Relay other custom sync messages
                        await yjs_manager.broadcast(
                            page_id, text_data, sender=websocket
                        )
                except json.JSONDecodeError:
                    await yjs_manager.broadcast(page_id, text_data, sender=websocket)

    except WebSocketDisconnect:
        await yjs_manager.disconnect(page_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error in room {page_id}: {e}")
        await yjs_manager.disconnect(page_id, websocket)
