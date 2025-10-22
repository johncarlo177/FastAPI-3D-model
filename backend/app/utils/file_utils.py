import shutil
from pathlib import Path
from typing import List
from fastapi import UploadFile

def save_uploaded_files(upload_folder: Path, files: List[UploadFile]):
    upload_folder.mkdir(parents=True, exist_ok=True)
    saved_paths = []

    for f in files:
        dest = upload_folder / f.filename
        # Save the file
        with dest.open("wb") as out_file:
            shutil.copyfileobj(f.file, out_file)

        # Now you can safely use Path(dest)
        print(f"Saved file: {dest}, size: {dest.stat().st_size}, suffix: {dest.suffix}")
        saved_paths.append(dest)

    return saved_paths
