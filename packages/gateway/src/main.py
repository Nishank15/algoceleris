from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import create_app
from .queue import QueueBroker, get_queue_broker


def create_production_app(broker: Optional[QueueBroker] = None) -> FastAPI:
    """Factory creating fully integrated FastAPI gateway with REST, subscriptions, contests, AI, and WebSockets."""
    active_broker = broker or get_queue_broker()
    app = create_app(broker=active_broker)

    # Enable CORS for frontend IDE integrations
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


# Default application instance for ASGI servers (e.g. uvicorn)
app = create_production_app()


def run():
    import os
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "1"))
    reload = os.getenv("RELOAD", "false").lower() == "true"

    uvicorn.run(
        "packages.gateway.src.main:app",
        host=host,
        port=port,
        workers=workers if not reload else 1,
        reload=reload,
    )


if __name__ == "__main__":
    run()
