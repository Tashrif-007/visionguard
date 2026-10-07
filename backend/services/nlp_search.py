import logging
import time
from datetime import datetime, timezone

import httpx
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


def _response_format() -> dict[str, object]:
    """OpenAI-style structured-output spec so the model must reply with _LLMFilters JSON.

    Written by hand rather than from model_json_schema(): strict mode rejects the
    "default"/"title" keywords Pydantic emits and needs every field listed as required.
    """
    nullable_string = {"type": ["string", "null"]}
    fields = list(_LLMFilters.model_fields)
    schema = {
        "type": "object",
        "properties": {name: nullable_string for name in fields},
        "required": fields,
        "additionalProperties": False,
    }
    return {
        "type": "json_schema",
        "json_schema": {"name": "event_filters", "strict": True, "schema": schema},
    }


def _is_retryable(response: httpx.Response) -> bool:
    # Free OpenRouter models are rate-limited upstream in bursts (429); 5xx is a provider hiccup.
    return response.status_code == 429 or response.status_code >= 500


def _request_filters(q: str, system_prompt: str) -> _LLMFilters:
    """Call OpenRouter's chat completions endpoint and validate the JSON reply.

    Retries rate-limited / provider-error responses up to OPENROUTER_MAX_RETRIES
    times, waiting OPENROUTER_RETRY_BACKOFF_SECONDS × attempt between tries.
    """
    for attempt in range(settings.openrouter_max_retries + 1):
        response = _post_completion(q, system_prompt)
        if not _is_retryable(response) or attempt == settings.openrouter_max_retries:
            break
        logger.warning("OpenRouter returned %s; retrying (attempt %d)", response.status_code, attempt + 1)
        time.sleep(settings.openrouter_retry_backoff_seconds * (attempt + 1))
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return _LLMFilters.model_validate_json(content)


def _post_completion(q: str, system_prompt: str) -> httpx.Response:
    return httpx.post(
        f"{settings.openrouter_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
        json={
            "model": settings.openrouter_model,
            "max_tokens": settings.openrouter_max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": q},
            ],
            "response_format": _response_format(),
            # Only route to providers that honour response_format, so the reply is real JSON.
            "provider": {"require_parameters": True},
        },
        timeout=settings.openrouter_timeout_seconds,
    )


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        logger.warning("LLM returned an unparseable timestamp %r; ignoring it", value)
        return None
    # events.timestamp is naive UTC; an aware value (e.g. a trailing "Z") would be shifted
    # by the DB session timezone when compared, so normalise to naive UTC here.
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def parse_query(q: str, now: datetime | None = None) -> ParsedFilters:
    """Parse a natural-language event query into structured filters via an LLM on OpenRouter.

    Never raises — any failure (missing key, network, bad output) degrades to
    ParsedFilters() (no filters, i.e. "return all events"), per CLAUDE.md's rule
    that an unparseable query should widen the search rather than error out.
    """
    if not settings.openrouter_api_key:
        logger.warning("OPENROUTER_API_KEY not configured; returning unfiltered search results")
        return ParsedFilters()

    current_time = now or datetime.now(timezone.utc)
    system_prompt = _SYSTEM_PROMPT.format(
        now=current_time.isoformat(), event_types=", ".join(_KNOWN_EVENT_TYPES)
    )

    try:
        filters = _request_filters(q, system_prompt)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, ValidationError):
        logger.exception("OpenRouter query parsing failed; returning unfiltered search results")
        return ParsedFilters()

    return ParsedFilters(
        from_ts=_parse_timestamp(filters.from_ts),
        to_ts=_parse_timestamp(filters.to_ts),
        event_type=filters.event_type if filters.event_type in _KNOWN_EVENT_TYPES else None,
    )
