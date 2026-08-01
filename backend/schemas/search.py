from datetime import datetime

from pydantic import BaseModel, Field

from backend.schemas.event import EventRead


class SearchQuery(BaseModel):
    q: str = Field(min_length=1, max_length=500)


class ParsedFilters(BaseModel):
    from_ts: datetime | None = None
    to_ts: datetime | None = None
    event_type: str | None = None


class SearchResponse(BaseModel):
    query: str
    parsed_filters: ParsedFilters
    events: list[EventRead]
    total: int
