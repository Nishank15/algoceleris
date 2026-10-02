from typing import Optional

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .api import create_router
from .queue import QueueBroker, get_queue_broker
from .ws import WebSocketConnectionManager


def create_production_app(broker: Optional[QueueBroker] = None) -> FastAPI:
    """Factory creating fully integrated FastAPI gateway with REST and WebSocket streaming."""
    app = FastAPI(
        title="Cloud-Judge V2 Gateway & Streamer",
        description="Production API gateway with asynchronous queuing and live WebSocket streaming",
        version="0.1.0",
    )

    # Enable CORS for frontend IDE integrations
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    active_broker = broker or get_queue_broker()
    app.state.broker = active_broker

    ws_manager = WebSocketConnectionManager()
    app.state.ws_manager = ws_manager

    # Mount REST routes
    app.include_router(create_router(active_broker))

    # Mount WebSocket streaming route
    @app.websocket("/ws/submissions/{submission_id}")
    async def websocket_submission_stream(websocket: WebSocket, submission_id: str):
        await ws_manager.stream_submission_events(submission_id, websocket, active_broker)

    @app.get("/health", summary="Gateway and streamer health check")
    def health_check():
        return {
            "status": "healthy",
            "broker": active_broker.__class__.__name__,
            "websocket": "enabled",
        }

    return app


# Default application instance for ASGI servers (e.g. uvicorn)
app = create_production_app()


def run():
    import uvicorn
    uvicorn.run("packages.gateway.src.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()
