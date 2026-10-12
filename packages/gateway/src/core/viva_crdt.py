import asyncio
import base64
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
from typing import Any, AsyncGenerator, Dict, Optional
import uuid

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import decode_token
from ..database import get_db, get_session_factory
from ..models.campus import (
    CampusRole,
    InterviewRoom,
    MembershipStatus,
    OrgMembership,
)
from ..models.entities import User
from ..queue import QueueBroker

logger = logging.getLogger("cloudjudge.core.viva_crdt")


@asynccontextmanager
async def _get_db_session(websocket: WebSocket, session_factory=None) -> AsyncGenerator[AsyncSession, None]:
    """Yield database session respecting FastAPI dependency overrides."""
    override = getattr(websocket.app, "dependency_overrides", {}).get(get_db)
    if override:
        gen = override()
        session = await gen.__anext__()
        try:
            yield session
        finally:
            try:
                await gen.__anext__()
            except (StopAsyncIteration, Exception):
                pass
    else:
        factory = session_factory or get_session_factory()
        async with factory() as session:
            yield session


async def handle_viva_crdt_websocket(
    websocket: WebSocket,
    room_code: str,
    broker: QueueBroker,
    session_factory=None,
) -> None:
    """Handles real-time multiplayer Viva examination WebSockets.

    Supports Yjs CRDT binary updates and JSON awareness envelopes (cursors, selections),
    relaying changes across Redis Pub/Sub topic campus:viva:{room_code}:events.
    """
    # 1. Extract authentication token
    token = websocket.query_params.get("token")
    if not token:
        auth_hdr = websocket.headers.get("authorization", "")
        if auth_hdr.lower().startswith("bearer "):
            token = auth_hdr[7:].strip()
        elif auth_hdr:
            token = auth_hdr.strip()
    if not token:
        token = websocket.cookies.get("access_token")

    if not token:
        try:
            await websocket.accept()
            init_frame = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
            token = init_frame.get("token")
        except Exception:
            token = None

    if not token:
        try:
            await websocket.close(code=1008, reason="Missing authentication token")
        except Exception:
            pass
        return

    # 2. Decode JWT claims
    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise ValueError("Token missing 'sub' claim")
        user_uuid = uuid.UUID(str(user_id_str))
    except Exception as e:
        logger.warning(f"Viva WS token decoding error: {e}")
        try:
            await websocket.close(code=1008, reason=f"Invalid token: {e}")
        except Exception:
            pass
        return

    # 3. Query interview room and verify permissions
    async with _get_db_session(websocket, session_factory=session_factory) as db:
        stmt = select(InterviewRoom).where(InterviewRoom.room_code == room_code)
        room = (await db.execute(stmt)).scalars().first()
        if not room:
            try:
                await websocket.close(code=1008, reason=f"Viva room '{room_code}' not found")
            except Exception:
                pass
            return

        is_host = (user_uuid == room.host_user_id)
        is_candidate = (user_uuid == room.candidate_user_id)

        # If not direct host/candidate, check if user is instructor in room's organization
        if not is_host and not is_candidate and room.org_id:
            stmt_mem = select(OrgMembership).where(
                OrgMembership.org_id == room.org_id,
                OrgMembership.user_id == user_uuid,
                OrgMembership.status == MembershipStatus.ACTIVE.value,
            )
            membership = (await db.execute(stmt_mem)).scalars().first()
            if membership and str(membership.role) in (CampusRole.INSTRUCTOR.value, CampusRole.ORG_ADMIN.value):
                is_host = True

        if not is_host and not is_candidate:
            try:
                await websocket.close(code=1008, reason="Unauthorized: User unaffiliated with this viva room")
            except Exception:
                pass
            return

        user = await db.get(User, user_uuid)
        username = user.username if user else payload.get("username", "collaborator")
        role = "host" if is_host else "candidate"
        initial_editor_code = room.editor_code
        initial_status = room.status

    # 4. Accept connection and send welcome handshake frame
    if getattr(websocket, "client_state", None) is not None and websocket.client_state.name != "CONNECTED":
        await websocket.accept()

    await websocket.send_json({
        "event_type": "connected",
        "room_code": room_code,
        "role": role,
        "user_id": str(user_uuid),
        "username": username,
        "editor_code": initial_editor_code,
        "status": initial_status,
    })

    channel = f"campus:viva:{room_code}:events"

    # Broadcast peer join notification
    broker.publish(channel, {
        "event_type": "peer_joined",
        "room_code": room_code,
        "user_id": str(user_uuid),
        "username": username,
        "role": role,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # 5. Coordinate concurrent send/receive loops
    async def _forwarder():
        """Listen to Redis channel and forward updates to client, filtering sender echoes."""
        async for event in broker.listen_channel(channel):
            if event.get("sender_id") == str(user_uuid):
                continue
            if event.get("event_type") == "crdt_binary" and "data_b64" in event:
                try:
                    raw_bytes = base64.b64decode(event["data_b64"])
                    await websocket.send_bytes(raw_bytes)
                except Exception:
                    await websocket.send_json(event)
            else:
                await websocket.send_json(event)

    async def _handle_message_payload(msg: Dict[str, Any]):
        msg_type = msg.get("type") or msg.get("event_type")

        # A. Awareness updates (cursor, selection, color)
        if msg_type == "awareness":
            broker.publish(channel, {
                "event_type": "awareness",
                "room_code": room_code,
                "sender_id": str(user_uuid),
                "user_id": str(user_uuid),
                "username": username,
                "role": role,
                "cursor": msg.get("cursor"),
                "selection": msg.get("selection"),
                "color": msg.get("color", "#e4f222"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        # B. CRDT sync / update envelope
        elif msg_type in {"sync", "update", "crdt_update"}:
            broker.publish(channel, {
                "event_type": "crdt_update",
                "room_code": room_code,
                "sender_id": str(user_uuid),
                "payload": msg.get("payload") or msg.get("update") or msg.get("data"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        # C. Code snapshot and status persistence
        elif msg_type in {"code_snapshot", "editor_snapshot", "editor_update"}:
            new_code = msg.get("code") if "code" in msg else msg.get("editor_code")
            new_status = msg.get("status")

            async with _get_db_session(websocket, session_factory=session_factory) as db:
                stmt = select(InterviewRoom).where(InterviewRoom.room_code == room_code)
                rm = (await db.execute(stmt)).scalars().first()
                if rm:
                    if new_code is not None:
                        rm.editor_code = new_code
                    if new_status is not None:
                        rm.status = new_status
                    await db.commit()

            broker.publish(channel, {
                "event_type": "code_snapshot",
                "room_code": room_code,
                "sender_id": str(user_uuid),
                "code": new_code,
                "status": new_status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        # D. Ping / Pong liveness
        elif msg_type == "ping":
            await websocket.send_json({"event_type": "pong"})
            return

        # Acknowledge processed message frame
        try:
            await websocket.send_json({
                "event_type": "ack",
                "type": msg_type,
                "status": "recorded",
            })
        except Exception:
            pass

    async def _receiver():
        """Receive incoming WebSocket frames (JSON text or binary) and handle updates."""
        while True:
            frame = await websocket.receive()
            if "text" in frame and frame["text"]:
                try:
                    parsed = json.loads(frame["text"])
                    await _handle_message_payload(parsed)
                except Exception as e:
                    logger.debug(f"JSON frame parse error: {e}")
            elif "bytes" in frame and frame["bytes"]:
                # Relaying binary CRDT frames
                broker.publish(channel, {
                    "event_type": "crdt_binary",
                    "room_code": room_code,
                    "sender_id": str(user_uuid),
                    "data_b64": base64.b64encode(frame["bytes"]).decode("utf-8"),
                })

    task_fwd = asyncio.create_task(_forwarder())
    task_recv = asyncio.create_task(_receiver())

    try:
        done, pending = await asyncio.wait(
            [task_fwd, task_recv],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        task_fwd.cancel()
        task_recv.cancel()
        broker.publish(channel, {
            "event_type": "peer_left",
            "room_code": room_code,
            "user_id": str(user_uuid),
            "username": username,
            "role": role,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
