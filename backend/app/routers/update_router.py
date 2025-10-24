from fastapi import APIRouter, Body
from pathlib import Path
import uuid, json
from app.core.config import STATIC_ROOT, SessionLocal
from app.models.model_record import ModelRecord

router = APIRouter(prefix="/api", tags=["Upload"])

@router.post("/update-model")
def update_model(payload: dict = Body(...)):
    uuid = payload.get("uuid")
    json_data = payload.get("json")

    ## import json
    camera_json_path = Path(__file__).parent.parent / "models" / "CAMERA_update.json"
    with open(camera_json_path, "r") as f:
        camera_data = json.load(f)

    db = SessionLocal()

    try:
        rec = ModelRecord()
        db.add(rec)
        db.commit()
        db.refresh(rec)
    finally:
        db.close()

    return {
        "status": "ok",
        "uuid": uuid,
        "static_url": f"/static/models/{uuid}/CAMERA.STL",
        "json": camera_data
    }