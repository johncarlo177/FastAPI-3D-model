# app/main.py
import os
import uuid
import shutil
import subprocess
from pathlib import Path
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import trimesh
import meshio

from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from .models import ModelRecord

# ----- DB setup (sync SQLAlchemy for example) -----
DATABASE_URL = "postgresql+psycopg2://threeuser:123456@localhost:5432/threemodel"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# ----- FastAPI app -----
app = FastAPI()
origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # allow frontend origins
    allow_credentials=True,
    allow_methods=["*"],          # allow all HTTP methods
    allow_headers=["*"],          # allow all headers
)

STATIC_ROOT = Path("./static/models")
STATIC_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# helper to save files
def save_uploaded_files(upload_folder: Path, files: List[UploadFile]):
    upload_folder.mkdir(parents=True, exist_ok=True)
    saved_paths = []
    for f in files:
        dest = upload_folder / f.filename
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        saved_paths.append(dest)
    return saved_paths

# try to load with trimesh or meshio
def load_mesh_try(paths, main_filename=None):
    """
    paths: list[Path] - all files in the upload folder
    main_filename: optional main filename to try first
    returns (trimesh.Trimesh, loaded_path)
    """
    # Try passing file path to trimesh
    order = []
    if main_filename:
        order.append([p for p in paths if p.name == main_filename])
    # then try all
    order.append(paths)

    for group in order:
        for p in group:
            try:
                # trimesh.load can return Scene or Trimesh
                mesh = trimesh.load(p, force='mesh')
                if mesh is None:
                    continue
                # if mesh is a Scene, try to combine
                if isinstance(mesh, trimesh.Scene):
                    mesh = trimesh.util.concatenate(mesh.dump())  # combine geometry
                if isinstance(mesh, trimesh.Trimesh):
                    return mesh, p
            except Exception as e:
                # try meshio (some formats)
                try:
                    m = meshio.read(str(p))
                    # convert meshio -> trimesh (if possible)
                    if hasattr(m, "points") and hasattr(m, "cells"):
                        import numpy as np
                        vertices = np.array(m.points)
                        # find triangle cell block
                        triangles = None
                        for cell in m.cells:
                            if cell.type in ("triangle", "tri"):
                                triangles = cell.data
                                break
                        if triangles is None:
                            # skip if not triangle mesh
                            continue
                        tm = trimesh.Trimesh(vertices=vertices, faces=triangles, process=True)
                        return tm, p
                except Exception:
                    pass
    # failed to load directly
    return None, None

# optional: convert with assimp CLI (must be installed on server)
def assimp_convert_to_obj(src_path: Path, dest_path: Path):
    # assimp supports many input formats. Command example:
    # assimp export input.xxx output.obj
    cmd = ["assimp", "export", str(src_path), str(dest_path)]
    subprocess.run(cmd, check=True)

@app.post("/api/upload-model")
async def upload_model(files: List[UploadFile] = File(...), mainFile: str = None):
    # basic validation
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    uid = str(uuid.uuid4())
    folder = STATIC_ROOT / uid
    saved_paths = save_uploaded_files(folder, files)

    # try load
    mesh, loaded_path = load_mesh_try(saved_paths, main_filename=mainFile)
    if mesh is None:
        # try conversion loop: for each file, try to run assimp to convert to OBJ/GLTF and reload
        converted = None
        for p in saved_paths:
            try:
                conv_out = folder / (p.stem + "_conv.obj")
                assimp_convert_to_obj(p, conv_out)
                mesh, loaded_path = load_mesh_try([conv_out], main_filename=None)
                if mesh:
                    converted = conv_out
                    break
            except Exception:
                continue
        if mesh is None:
            # last resort: return error saying need converter
            raise HTTPException(status_code=415, detail="Unsupported file format. Install assimp or provide a GLTF/OBJ/STL/PLY/3MF/AMF file.")

    # process trimesh to get metrics
    try:
        mesh.process(validate=True)  # optional repair/sanitize
    except Exception:
        pass

    vertices_count = int(len(mesh.vertices))
    # triangles: if faces are triangles, faces.shape[0], else try triangulate
    triangles_count = int(len(mesh.faces))
    # bounding box (axis aligned)
    bbox = mesh.bounding_box.bounds  # returns [[minx,miny,minz],[maxx,maxy,maxz]]
    minb, maxb = bbox
    size_x, size_y, size_z = float(maxb[0]-minb[0]), float(maxb[1]-minb[1]), float(maxb[2]-minb[2])

    # volume & surface area (trimesh provides signed volume)
    try:
        volume = float(mesh.volume)  # may be 0 for non-watertight meshes
    except Exception:
        volume = 0.0
    try:
        surface_area = float(mesh.area)
    except Exception:
        surface_area = 0.0

    # Persist to DB
    db = SessionLocal()
    rec = ModelRecord(
        uuid=uid,
        filename=loaded_path.name if loaded_path else files[0].filename,
        extension=Path(loaded_path.name if loaded_path else files[0].filename).suffix.lstrip("."),
        file_path=str(folder),
        vertices_count=vertices_count,
        triangles_count=triangles_count,
        size_x=size_x, size_y=size_y, size_z=size_z,
        volume=volume,
        surface_area=surface_area
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
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
