import json
from datetime import datetime, timezone
from typing import Any

import httpx
import pytest

from backend.config import settings
from backend.schemas.search import ParsedFilters
from backend.services import nlp_search

NOW = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)


def _completion(content: str) -> httpx.Response:
    request = httpx.Request("POST", "https://openrouter.test/chat/completions")
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]}, request=request)


@pytest.fixture
def api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")


def test_missing_key_returns_no_filters(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    assert nlp_search.parse_query("any motion last night?", now=NOW) == ParsedFilters()


def test_parses_structured_reply(monkeypatch: pytest.MonkeyPatch, api_key: None) -> None:
    sent: dict[str, Any] = {}

    def fake_post(url: str, **kwargs: Any) -> httpx.Response:
        sent.update(url=url, **kwargs)
        content = {"from_ts": "2026-10-04T18:00:00", "to_ts": "2026-10-05T06:00:00", "event_type": "motion"}
        return _completion(json.dumps(content))

    monkeypatch.setattr(nlp_search.httpx, "post", fake_post)
    filters = nlp_search.parse_query("any motion last night?", now=NOW)

    assert filters == ParsedFilters(
        from_ts=datetime(2026, 10, 4, 18), to_ts=datetime(2026, 10, 5, 6), event_type="motion"
    )
    assert sent["url"].endswith("/chat/completions")
    assert sent["headers"]["Authorization"] == "Bearer test-key"
    assert sent["json"]["model"] == settings.openrouter_model
    assert sent["json"]["response_format"]["type"] == "json_schema"


def test_unknown_event_type_and_bad_timestamp_are_dropped(monkeypatch: pytest.MonkeyPatch, api_key: None) -> None:
    content = json.dumps({"from_ts": "yesterday", "to_ts": None, "event_type": "intruder"})
    monkeypatch.setattr(nlp_search.httpx, "post", lambda url, **kwargs: _completion(content))
    assert nlp_search.parse_query("intruders yesterday", now=NOW) == ParsedFilters()


@pytest.mark.parametrize(
    "response",
    [
        httpx.ConnectError("offline"),
        httpx.Response(401, json={"error": "bad key"}, request=httpx.Request("POST", "https://openrouter.test")),
        _completion("not json"),
        httpx.Response(200, json={"choices": []}, request=httpx.Request("POST", "https://openrouter.test")),
    ],
)
def test_failures_degrade_to_no_filters(
    monkeypatch: pytest.MonkeyPatch, api_key: None, response: httpx.Response | Exception
) -> None:
    def fake_post(url: str, **kwargs: Any) -> httpx.Response:
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(nlp_search.httpx, "post", fake_post)
    assert nlp_search.parse_query("any motion today?", now=NOW) == ParsedFilters()


def test_aware_timestamps_become_naive_utc(monkeypatch: pytest.MonkeyPatch, api_key: None) -> None:
    content = json.dumps({"from_ts": "2026-10-04T18:00:00Z", "to_ts": "2026-10-05T12:00:00+06:00", "event_type": None})
    monkeypatch.setattr(nlp_search.httpx, "post", lambda url, **kwargs: _completion(content))
    filters = nlp_search.parse_query("since last evening", now=NOW)
    assert filters.from_ts == datetime(2026, 10, 4, 18)
    assert filters.to_ts == datetime(2026, 10, 5, 6)


def test_rate_limited_request_is_retried(monkeypatch: pytest.MonkeyPatch, api_key: None) -> None:
    monkeypatch.setattr(settings, "openrouter_retry_backoff_seconds", 0.0)
    rate_limited = httpx.Response(429, request=httpx.Request("POST", "https://openrouter.test"))
    replies = [rate_limited, _completion(json.dumps({"from_ts": None, "to_ts": None, "event_type": "motion"}))]
    monkeypatch.setattr(nlp_search.httpx, "post", lambda url, **kwargs: replies.pop(0))
    assert nlp_search.parse_query("any motion?", now=NOW) == ParsedFilters(event_type="motion")


def test_gives_up_after_max_retries(monkeypatch: pytest.MonkeyPatch, api_key: None) -> None:
    monkeypatch.setattr(settings, "openrouter_retry_backoff_seconds", 0.0)
    calls: list[str] = []

    def always_rate_limited(url: str, **kwargs: Any) -> httpx.Response:
        calls.append(url)
        return httpx.Response(429, request=httpx.Request("POST", url))

    monkeypatch.setattr(nlp_search.httpx, "post", always_rate_limited)
    assert nlp_search.parse_query("any motion?", now=NOW) == ParsedFilters()
    assert len(calls) == settings.openrouter_max_retries + 1
