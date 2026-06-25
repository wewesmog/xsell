from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exclusions import router as exclusions_router
from app.api.agents import router as agents_router
from app.api.campaigns import router as campaigns_router
from app.api.list_ingestion import router as list_ingestion_router
from app.shared_services.db import get_postgres_connection
from app.shared_services.oracle_db import oracle_configured


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from scripts.apply_migration import main as apply_migrations

    apply_migrations()
    yield


app = FastAPI(title="Xsell Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(list_ingestion_router, prefix="/api")
app.include_router(exclusions_router, prefix="/api")
app.include_router(campaigns_router, prefix="/api")
app.include_router(agents_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str | bool]:
    db_name = "unknown"
    try:
        conn = get_postgres_connection()
        db_name = conn.get_dsn_parameters().get("dbname", "postgres")
        conn.close()
    except Exception:
        db_name = "unavailable"

    return {
        "status": "ok",
        "database": db_name,
        "oracle_configured": oracle_configured(),
    }


if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
