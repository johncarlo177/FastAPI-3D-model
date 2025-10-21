from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="3D Model Backend")

# Serve static model files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/")
def read_root():
    return {"message": "3D backend is running!"}
