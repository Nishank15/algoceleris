import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional
import uuid

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import decode_token
from ..database import get_db, get_session_factory
from ..models.campus import (
    Assessment,
    CampusRole,
    MembershipStatus,
    OrgMembership,
    ProctorEvent,
)
from ..models.entities import User
from ..queue import QueueBroker

logger = logging.getLogger("cloudjudge.core.proctoring_mesh")


def calculate_proctor_risk_score(
    tab_switches: int = 0,
    fullscreen_exits: int = 0,
    paste_bursts: int = 0,
) -> int:
    """Computes anomaly risk score according to invariant formula:

    RiskScore = (TabSwitches * 5) + (FullscreenExits * 10) + (PasteBursts * 15)
    """
    return (tab_switches * 5) + (fullscreen_exits * 10) + (paste_bursts * 15)


class ProctoringMeshStore:
    """Manages active student telemetry state in Redis hashes with in-memory fallback.

    Redis hash key: campus:assessment:{assessment_id}:active_students
    Field: user_id (string)
    Value: serialized JSON object
    """

    def __init__(self, redis_client: Optional[Any] = None) -> None:
        self.redis = redis_client
        self._in_memory: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def _hash_key(self, assessment_id: Any) -> str:
        return f"campus:assessment:{assessment_id}:active_students"

    def update_student_state(
        self,
        assessment_id: Any,
        user_id: Any,
        state: Dict[str, Any],
    ) -> None:
        a_key = self._hash_key(assessment_id)
        u_key = str(user_id)

        # In-memory storage
        if a_key not in self._in_memory:
            self._in_memory[a_key] = {}
        self._in_memory[a_key][u_key] = dict(state)

        # Redis storage
        if self.redis is not None:
            try:
                self.redis.hset(a_key, u_key, json.dumps(state))
            except Exception as e:
                logger.warning(f"Failed to update active student state in Redis ({e})")

    def get_student_state(
        self,
        assessment_id: Any,
        user_id: Any,
    ) -> Optional[Dict[str, Any]]:
        a_key = self._hash_key(assessment_id)
        u_key = str(user_id)

        if self.redis is not None:
            try:
                raw = self.redis.hget(a_key, u_key)
                if raw:
                    return json.loads(raw)
            except Exception as e:
                logger.warning(f"Failed to get active student state from Redis ({e})")

        in_mem = self._in_memory.get(a_key, {}).get(u_key)
        return dict(in_mem) if in_mem is not None else None

    def get_active_students(
        self,
        assessment_id: Any,
    ) -> List[Dict[str, Any]]:
        a_key = self._hash_key(assessment_id)

        if self.redis is not None:
            try:
                raw_dict = self.redis.hgetall(a_key)
                if raw_dict:
                    return [json.loads(val) for val in raw_dict.values()]
            except Exception as e:
                logger.warning(f"Failed to get active students from Redis ({e})")

        return [dict(val) for val in self._in_memory.get(a_key, {}).values()]

    def clear(self) -> None:
        self._in_memory.clear()


_GLOBAL_MESH_STORE: Optional[ProctoringMeshStore] = None


def get_proctoring_mesh_store(redis_client: Optional[Any] = None) -> ProctoringMeshStore:
    global _GLOBAL_MESH_STORE
    if _GLOBAL_MESH_STORE is None or redis_client is not None:
        _GLOBAL_MESH_STORE = ProctoringMeshStore(redis_client=redis_client)
    return _GLOBAL_MESH_STORE


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


async def handle_campus_proctor_websocket(
    websocket: WebSocket,
    assessment_id_str: str,
    broker: QueueBroker,
    session_factory=None,
    mesh_store: Optional[ProctoringMeshStore] = None,
) -> None:
    """Handles bidirectional real-time proctoring WebSocket connections.

    Students stream heartbeat and anomaly events which are aggregated into risk scores,
    persisted into the proctor_events database table, and broadcast over Redis Pub/Sub.
    Instructors subscribe to live telemetry streams across all assessment candidates.
    """
    try:
        assessment_uuid = uuid.UUID(str(assessment_id_str))
    except ValueError:
        await websocket.close(code=1008, reason="Invalid assessment_id format")
        return

    # Extract JWT token from query parameters, authorization headers, or cookies
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
        # Await initial auth message if not present in query/header
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

    # Validate token and resolve identity
    try:
        payload = decode_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise ValueError("Token missing 'sub' subject claim")
        user_uuid = uuid.UUID(str(user_id_str))
    except Exception as e:
        logger.warning(f"Proctoring WS authentication failed: {e}")
        try:
            await websocket.close(code=1008, reason=f"Invalid token: {e}")
        except Exception:
            pass
        return

    # Query assessment and organization membership
    async with _get_db_session(websocket, session_factory=session_factory) as db:
        assessment = await db.get(Assessment, assessment_uuid)
        if not assessment:
            try:
                await websocket.close(code=1008, reason=f"Assessment '{assessment_uuid}' not found")
            except Exception:
                pass
            return

        stmt = select(OrgMembership).where(
            OrgMembership.org_id == assessment.org_id,
            OrgMembership.user_id == user_uuid,
            OrgMembership.status == MembershipStatus.ACTIVE.value,
        )
        membership = (await db.execute(stmt)).scalars().first()
        if not membership:
            try:
                await websocket.close(
                    code=1008,
                    reason="User is not an active member of organization",
                )
            except Exception:
                pass
            return

        user = await db.get(User, user_uuid)
        username = user.username if user else payload.get("username", "candidate")
        role = str(membership.role)

    store = mesh_store or get_proctoring_mesh_store()
    channel = f"campus:proctor:{assessment_uuid}:telemetry"

    # Accept connection if not yet accepted
    if getattr(websocket, "client_state", None) is not None and websocket.client_state.name != "CONNECTED":
        await websocket.accept()

    # --- INSTRUCTOR / FACULTY SUPERVISOR FLOW ---
    if role in {CampusRole.INSTRUCTOR.value, CampusRole.ORG_ADMIN.value}:
        # Send initial snapshot of currently active students
        active_list = store.get_active_students(assessment_uuid)
        await websocket.send_json({
            "event_type": "active_students_snapshot",
            "assessment_id": str(assessment_uuid),
            "data": active_list,
        })

        async def _forward_broker_events():
            async for event in broker.listen_channel(channel):
                await websocket.send_json(event)

        async def _receive_client_commands():
            while True:
                msg = await websocket.receive_json()
                if msg.get("event_type") == "ping":
                    await websocket.send_json({"event_type": "pong"})

        task_forward = asyncio.create_task(_forward_broker_events())
        task_recv = asyncio.create_task(_receive_client_commands())

        try:
            done, pending = await asyncio.wait(
                [task_forward, task_recv],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        finally:
            task_forward.cancel()
            task_recv.cancel()
        return

    # --- STUDENT CANDIDATE FLOW ---
    if role == CampusRole.STUDENT.value:
        prev_state = store.get_student_state(assessment_uuid, user_uuid) or {}
        tab_switches = int(prev_state.get("tab_switches", 0))
        fullscreen_exits = int(prev_state.get("fullscreen_exits", 0))
        paste_bursts = int(prev_state.get("paste_bursts", 0))
        risk_score = calculate_proctor_risk_score(tab_switches, fullscreen_exits, paste_bursts)

        student_state = {
            "user_id": str(user_uuid),
            "username": username,
            "status": "connected",
            "tab_switches": tab_switches,
            "fullscreen_exits": fullscreen_exits,
            "paste_bursts": paste_bursts,
            "risk_score": risk_score,
            "last_event_type": "connected",
            "last_seen": datetime.now(timezone.utc).isoformat(),
        }
        store.update_student_state(assessment_uuid, user_uuid, student_state)

        # Welcome frame
        await websocket.send_json({
            "event_type": "connected",
            "role": "student",
            "user_id": str(user_uuid),
            "assessment_id": str(assessment_uuid),
            "risk_score": risk_score,
        })

        # Broadcast student connection to supervisors
        broker.publish(channel, {
            "event_type": "student_connected",
            "assessment_id": str(assessment_uuid),
            "user_id": str(user_uuid),
            "username": username,
            "severity": "info",
            "risk_score": risk_score,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        try:
            while True:
                data = await websocket.receive_json()
                ev_type = data.get("event_type", "heartbeat")
                metadata = data.get("metadata", {})
                ts = data.get("timestamp") or datetime.now(timezone.utc).isoformat()

                severity = "info"
                is_anomaly = False

                if ev_type == "tab_switch":
                    tab_switches += 1
                    severity = "warning"
                    is_anomaly = True
                elif ev_type == "fullscreen_exit":
                    fullscreen_exits += 1
                    severity = "warning"
                    is_anomaly = True
                elif ev_type == "paste_burst":
                    paste_bursts += 1
                    severity = "critical"
                    is_anomaly = True
                elif ev_type == "heartbeat":
                    severity = "info"

                risk_score = calculate_proctor_risk_score(tab_switches, fullscreen_exits, paste_bursts)

                student_state.update({
                    "status": "connected",
                    "tab_switches": tab_switches,
                    "fullscreen_exits": fullscreen_exits,
                    "paste_bursts": paste_bursts,
                    "risk_score": risk_score,
                    "last_event_type": ev_type,
                    "last_seen": ts,
                })
                store.update_student_state(assessment_uuid, user_uuid, student_state)

                # Persist anomalies to DB table proctor_events
                if is_anomaly:
                    async with _get_db_session(websocket, session_factory=session_factory) as db:
                        event_record = ProctorEvent(
                            id=uuid.uuid4(),
                            assessment_id=assessment_uuid,
                            user_id=user_uuid,
                            event_type=ev_type,
                            severity=severity,
                            event_metadata=metadata,
                        )
                        db.add(event_record)
                        await db.commit()

                # Broadcast telemetry frame to Redis Pub/Sub topic
                broker.publish(channel, {
                    "event_type": ev_type,
                    "assessment_id": str(assessment_uuid),
                    "user_id": str(user_uuid),
                    "username": username,
                    "severity": severity,
                    "risk_score": risk_score,
                    "counters": {
                        "tab_switches": tab_switches,
                        "fullscreen_exits": fullscreen_exits,
                        "paste_bursts": paste_bursts,
                    },
                    "timestamp": ts,
                    "metadata": metadata,
                })

                # Acknowledge to student client
                await websocket.send_json({
                    "event_type": "ack",
                    "status": "recorded",
                    "risk_score": risk_score,
                })

        except WebSocketDisconnect:
            pass
        finally:
            student_state["status"] = "disconnected"
            student_state["last_seen"] = datetime.now(timezone.utc).isoformat()
            store.update_student_state(assessment_uuid, user_uuid, student_state)

            broker.publish(channel, {
                "event_type": "disconnect",
                "assessment_id": str(assessment_uuid),
                "user_id": str(user_uuid),
                "username": username,
                "severity": "info",
                "risk_score": risk_score,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        return

    # Other roles unauthorized
    await websocket.close(code=1008, reason="Insufficient campus role for assessment proctoring")
