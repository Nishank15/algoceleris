import asyncio
from typing import Dict, Set

from fastapi import WebSocket, WebSocketDisconnect

from .queue import QueueBroker


class WebSocketConnectionManager:
    """Manages active WebSocket connections and relays real-time execution events from Pub/Sub."""

    def __init__(self):
        self._active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, submission_id: str, websocket: WebSocket) -> None:
        """Accept WebSocket connection and register under submission_id."""
        await websocket.accept()
        async with self._lock:
            if submission_id not in self._active_connections:
                self._active_connections[submission_id] = set()
            self._active_connections[submission_id].add(websocket)

    async def disconnect(self, submission_id: str, websocket: WebSocket) -> None:
        """Deregister WebSocket connection."""
        async with self._lock:
            if submission_id in self._active_connections:
                self._active_connections[submission_id].discard(websocket)
                if not self._active_connections[submission_id]:
                    del self._active_connections[submission_id]

    async def stream_submission_events(
        self,
        submission_id: str,
        websocket: WebSocket,
        broker: QueueBroker,
    ) -> None:
        """Stream execution events to connected WebSocket until terminal event or disconnect."""
        await self.connect(submission_id, websocket)

        try:
            # Check if submission is already finished in the broker status store
            current_status = broker.get_status(submission_id)
            if current_status:
                st = current_status.get("status")
                if st in {"COMPLETED", "FAILED"}:
                    event_type = "compilation_failed" if st == "FAILED" else "completed"
                    await websocket.send_json(
                        {
                            "event_type": event_type,
                            "submission_id": submission_id,
                            "data": current_status,
                        }
                    )
                    await websocket.close()
                    return

                # Send initial state frame to client
                await websocket.send_json(
                    {
                        "event_type": "status",
                        "submission_id": submission_id,
                        "data": current_status,
                    }
                )

            # Subscribe to Pub/Sub channel and stream live events
            channel = f"judge:events:{submission_id}"
            async for event in broker.listen_channel(channel):
                await websocket.send_json(event)
                ev_type = event.get("event_type")
                if ev_type in {"completed", "compilation_failed"}:
                    await websocket.close()
                    break

        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
        finally:
            await self.disconnect(submission_id, websocket)

    async def stream_contest_leaderboard(
        self,
        contest_id: str,
        websocket: WebSocket,
        broker: QueueBroker,
        leaderboard_engine,
    ) -> None:
        """Stream real-time contest leaderboard updates and initial snapshot."""
        conn_key = f"contest:{contest_id}:leaderboard"
        await self.connect(conn_key, websocket)

        try:
            # 1. Send initial leaderboard snapshot
            if leaderboard_engine:
                current_board = leaderboard_engine.get_leaderboard(contest_id)
                await websocket.send_json(
                    {
                        "event_type": "leaderboard_snapshot",
                        "contest_id": contest_id,
                        "data": [
                            entry.model_dump() if hasattr(entry, "model_dump") else entry
                            for entry in current_board
                        ],
                    }
                )

            # 2. Subscribe to broker leaderboard channel
            channel = f"contest:{contest_id}:leaderboard"
            async for event in broker.listen_channel(channel):
                await websocket.send_json(event)

        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
        finally:
            await self.disconnect(conn_key, websocket)

