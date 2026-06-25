from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exclusions import router as exclusions_router
from app.api.agents import router as agents_router
from app.api.campaigns import router as campaigns_router
from app.api.list_ingestion import router as list_ingestion_router
from app.shared_services.oracle_db import oracle_configured
from app.xsell_helpers.canon_main import DB_PATH


app = FastAPI(title="Xsell Backend")

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
    return {
        "status": "ok",
        "db_path": str(DB_PATH.resolve()),
        "oracle_configured": oracle_configured(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
