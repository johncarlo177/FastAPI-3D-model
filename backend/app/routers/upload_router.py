from fastapi import APIRouter, UploadFile, File, HTTPException
from app.utils.file_utils import save_uploaded_files
from app.utils.mesh_utils import load_mesh_try
from app.core.config import STATIC_ROOT, SessionLocal
from app.models.model_record import ModelRecord
from pathlib import Path
import uuid

router = APIRouter(prefix="/api", tags=["Upload"])

@router.post("/upload-model")
async def upload_model(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    uid = str(uuid.uuid4())
    folder = STATIC_ROOT / uid
    saved_paths = save_uploaded_files(folder, files)
    mesh, loaded_path = load_mesh_try(saved_paths)
    if mesh is None:
        raise HTTPException(status_code=415, detail="Unsupported file format")

    mesh.process(validate=True)
    vertices_count = int(len(mesh.vertices))
    triangles_count = int(len(mesh.faces))
    minb, maxb = mesh.bounding_box.bounds
    size_x, size_y, size_z = map(float, maxb - minb)
    volume = float(getattr(mesh, "volume", 0.0))
    surface_area = float(getattr(mesh, "area", 0.0))

    db = SessionLocal()
    try:
        rec = ModelRecord(
            uuid=uid,
            filename=loaded_path.name,
            extension=Path(loaded_path.name).suffix.lstrip("."),
            file_path=str(folder),
            vertices_count=vertices_count,
            triangles_count=triangles_count,
            size_x=size_x,
            size_y=size_y,
            size_z=size_z,
            volume=volume,
            surface_area=surface_area
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
    finally:
        db.close()

    return {
        "status": "ok",
        "id": rec.id,
        "uuid": uid,
        "filename": rec.filename,
        "extension": rec.extension,
        "vertices_count": vertices_count,
        "triangles_count": triangles_count,
        "size": {"x": size_x, "y": size_y, "z": size_z},
        "volume": volume,
        "surface_area": surface_area,
        "static_url": f"/static/models/{uid}/{rec.filename}"
    }
