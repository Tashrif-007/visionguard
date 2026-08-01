from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db
from backend.controllers import search_controller
from backend.schemas.search import SearchResponse

router = APIRouter(prefix="/events", tags=["search"], dependencies=[Depends(get_current_user)])


@router.get("/search", response_model=SearchResponse)
def search_events(
    q: str = Query(min_length=1, max_length=500),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> SearchResponse:
    return search_controller.search_events(db=db, q=q, limit=limit, offset=offset)
