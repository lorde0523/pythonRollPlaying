from fastapi import APIRouter, Depends

router = APIRouter()

@router.get("/api/users/{user_id}")
def get_user(user_id: int, principal=Depends(require_auth)):
    return {"id": user_id}

@router.patch("/api/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate, principal=Depends(require_auth)):
    return {"id": user_id, "email": payload.email}

@router.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, principal=Depends(require_auth)):
    return {"deleted": True}

@router.get("/api/users/{user_id}/activity")
def get_user_activity(user_id: int, principal=Depends(require_auth)):
    return []

@router.get("/api/admin/stats")
def get_admin_stats(principal=Depends(require_auth)):
    return {"users": 1}
