import shutil
from pathlib import Path
from typing import List
from fastapi import UploadFile

def save_uploaded_files(upload_folder: Path, files: List[UploadFile]):
    upload_folder.mkdir(parents=True, exist_ok=True)
    saved_paths = []
    for f in files:
        dest = upload_folder / f.filename
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        saved_paths.append(dest)
    return saved_paths
