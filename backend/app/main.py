from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import photos, routes, users

app = FastAPI(
    title="AsphaltAtlas API",
    description="Backend API for the AsphaltAtlas road-sharing platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server — update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)
app.include_router(photos.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
