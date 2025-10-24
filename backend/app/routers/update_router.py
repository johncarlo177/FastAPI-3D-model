from fastapi import APIRouter, Body

router = APIRouter(prefix="/api", tags=["Upload"])

@router.post("/update-model")
def update_model(payload: dict = Body(...)):
    uuid = payload.get("uuid")
    json_data = payload.get("json")

    print("uuid:", uuid)
    print("json:", json_data)

    return {"status": "ok", "message": "Model updated successfully"}