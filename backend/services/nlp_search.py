import logging
from datetime import datetime, timezone
from functools import lru_cache

import anthropic
from pydantic import BaseModel, ValidationError

from backend.config import settings
from backend.schemas.search import ParsedFilters

logger = logging.getLogger(__name__)

_KNOWN_EVENT_TYPES = ["motion"]

_SYSTEM_PROMPT = """You turn a surveillance operator's plain-English question into structured \
search filters over a motion-event log.

Rules:
- The current UTC time is {now}. All timestamps you return MUST be UTC ISO-8601 \
  (e.g. "2026-07-29T22:00:00").
- Known event types: {event_types}. Only set event_type if the question clearly asks for one \
  of these; otherwise leave it null.
- If the question does not specify a time range, leave from_ts and to_ts null — do not guess.
- Interpret relative time phrases ("last night", "this morning", "past hour") relative to the \
  current time above.
- Never invent values you are not confident about — null is always safer than a wrong guess.
"""


class _LLMFilters(BaseModel):
    """Schema the model fills in. Kept separate from ParsedFilters so the LLM-facing
    contract (string timestamps) is decoupled from the API response schema."""

    from_ts: str | None = None
    to_ts: str | None = None
    event_type: str | None = None


@lru_cache(maxsize=1)
def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.anthropic_timeout_seconds,
        max_retries=1,
    )


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        logger.warning("Claude returned an unparseable timestamp %r; ignoring it", value)
        return None


def parse_query(q: str, now: datetime | None = None) -> ParsedFilters:
    """Parse a natural-language event query into structured filters via the Claude API.

    Never raises — any failure (missing key, network, bad output) degrades to
    ParsedFilters() (no filters, i.e. "return all events"), per CLAUDE.md's rule
    that an unparseable query should widen the search rather than error out.
    """
    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not configured; returning unfiltered search results")
        return ParsedFilters()

    current_time = now or datetime.now(timezone.utc)
    system_prompt = _SYSTEM_PROMPT.format(
        now=current_time.isoformat(), event_types=", ".join(_KNOWN_EVENT_TYPES)
    )

    try:
        response = _client().messages.parse(
            model=settings.anthropic_model,
            max_tokens=settings.anthropic_max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": q}],
            output_format=_LLMFilters,
        )
        filters = response.parsed_output
    except (anthropic.APIError, anthropic.APIConnectionError, ValidationError, ValueError):
        logger.exception("Claude API query parsing failed; returning unfiltered search results")
        return ParsedFilters()

    return ParsedFilters(
        from_ts=_parse_timestamp(filters.from_ts),
        to_ts=_parse_timestamp(filters.to_ts),
        event_type=filters.event_type if filters.event_type in _KNOWN_EVENT_TYPES else None,
    )
