import pytest
from fixtures.source_rows import make_source_rows

from pipeline.metrics import build_documents


@pytest.fixture
def source_rows():
    return make_source_rows()


@pytest.fixture
def manifest():
    return [
        {
            "name": n,
            "throughWeek": 6,
            "updatedAt": "2026-10-04T00:00:00Z",
            "required": n not in ("rushing", "injuries"),
        }
        for n in ("pbp", "opportunity", "rosters", "snaps", "rushing", "injuries")
    ]


@pytest.fixture
def documents(source_rows, manifest):
    return build_documents(source_rows, manifest, 2026)


def player(docs, pid):
    return next(p for d in docs.values() for p in d["players"] if p["playerId"] == pid)
