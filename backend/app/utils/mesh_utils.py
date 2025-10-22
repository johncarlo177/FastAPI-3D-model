import trimesh
import meshio
import subprocess
from pathlib import Path

def load_mesh_try(paths, main_filename=None):
    for p in paths:
        try:
            mesh = trimesh.load(p, force='mesh')
            if isinstance(mesh, trimesh.Scene):
                mesh = trimesh.util.concatenate(mesh.dump())
            return mesh, p
        except Exception:
            try:
                m = meshio.read(str(p))
                import numpy as np
                vertices = np.array(m.points)
                triangles = None
                for cell in m.cells:
                    if cell.type in ("triangle", "tri"):
                        triangles = cell.data
                        break
                if triangles is not None:
                    tm = trimesh.Trimesh(vertices=vertices, faces=triangles, process=True)
                    return tm, p
            except Exception:
                continue
    return None, None

def assimp_convert_to_obj(src_path: Path, dest_path: Path):
    subprocess.run(["assimp", "export", str(src_path), str(dest_path)], check=True)
