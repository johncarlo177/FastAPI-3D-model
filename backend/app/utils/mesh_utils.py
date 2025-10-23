import trimesh
import meshio
import subprocess
from pathlib import Path

SUPPORTED_EXTENSIONS = [
    ".3dm", ".3ds", ".3mf", ".amf", ".bim", ".brep",
    ".dae", ".fbx", ".fcstd", ".gltf", ".ifc", ".iges",
    ".step", ".stl", ".obj", ".off", ".ply", ".wrl"
]

def assimp_convert_to_obj(src_path: Path) -> Path:
    """
    Use assimp command-line tool to convert exotic formats to .obj.
    Requires `assimp` installed on system (sudo apt install assimp-utils).
    """
    dest_path = src_path.with_suffix(".converted.obj")
    try:
        subprocess.run(
            ["assimp", "export", str(src_path), str(dest_path)],
            check=True,
            capture_output=True
        )
        if dest_path.exists():
            print(f"Converted {src_path.name} -> {dest_path.name} using Assimp")
            return dest_path
    except Exception as e:
        print(f"Assimp conversion failed for {src_path}: {e}")
    return None


def load_mesh_try(paths):
    for path in paths:
        ext = Path(path).suffix.lower()
        print(f"Trying to load {path} ({ext})")

        if ext not in SUPPORTED_EXTENSIONS:
            print(f"Unsupported file type: {ext}, skipping {path}")
            continue

        if Path(path).stat().st_size == 0:
            print("Empty file, skipping:", path)
            continue

        # Try trimesh directly
        try:
            mesh = trimesh.load_mesh(path, force="mesh")
            if not mesh.is_empty:
                print("Loaded with trimesh:", path)
                return mesh, path
        except Exception as e:
            print(f"Trimesh failed: {e}")

        # try meshio
        try:
            m = meshio.read(path)
            if len(m.points) > 0 and len(m.cells) > 0:
                cell_block = next((c for c in m.cells if len(c.data) > 0), None)
                if cell_block is not None:
                    tmesh = trimesh.Trimesh(vertices=m.points, faces=cell_block.data)
                    print("Loaded with meshio:", path)
                    return tmesh, path
        except Exception as e:
            print(f" Meshio failed: {e}")

        # Try converting with Assimp
        converted = assimp_convert_to_obj(Path(path))
        if converted and converted.exists():
            try:
                mesh = trimesh.load_mesh(converted, force="mesh")
                if not mesh.is_empty:
                    print("Loaded via Assimp:", path)
                    return mesh, path
            except Exception as e:
                print(f"Trimesh failed after Assimp: {e}")

        print(f"Could not load {path}")

    return None, None
