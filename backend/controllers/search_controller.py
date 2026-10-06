from sqlalchemy.orm import Session

from backend.schemas.search import SearchResponse
from backend.services import event_service, nlp_search


def search_events(db: Session, owner_id: int, q: str, limit: int, offset: int) -> SearchResponse:
    filters = nlp_search.parse_query(q)
    listing = event_service.list_events(
        db=db,
        owner_id=owner_id,
        camera_id=None,
        event_type=filters.event_type,
        from_ts=filters.from_ts,
        to_ts=filters.to_ts,
        limit=limit,
        offset=offset,
    )
    return SearchResponse(
        query=q,
        parsed_filters=filters,
        events=listing.events,
        total=listing.total,
    )
