"""Opt in: pytest -m realdata. Requires an already-built live snapshot/cache."""

import json
from pathlib import Path

import pytest

from pipeline.metrics import carry, target
from pipeline.sources import read_rows

pytestmark = pytest.mark.realdata


@pytest.fixture
def live():
    root = Path(__file__).resolve().parents[1]
    if not (root / "web/public/data/wr.json").exists():
        pytest.skip("Run the live build first")
    docs = {
        pos: json.loads((root / f"web/public/data/{pos}.json").read_text())
        for pos in ("wr", "rb")
    }
    pbp = read_rows(root / "data/raw/play_by_play_2026.parquet")
    return docs, pbp


def test_live_population_and_spine(live):
    docs, _ = live
    assert len(docs["wr"]["players"]) >= 100
    for doc in docs.values():
        for p in doc["players"]:
            assert len(p["weeks"]) == 18
            assert all(s["team"] for s in p["weeks"] if s["status"] == "played")
            assert p["periods"]["season"]["games"] <= doc["meta"]["dataThroughWeek"]


def test_live_top_target_and_carry_reconciliation(live):
    docs, pbp = live
    for pos, metric, predicate, idkey in [
        ("wr", "targetsPerGame", target, "receiver_player_id"),
        ("rb", "carriesPerGame", carry, "rusher_player_id"),
    ]:
        leaders = sorted(
            docs[pos]["players"],
            key=lambda p: p["periods"]["season"]["metrics"][metric]["num"],
            reverse=True,
        )[: 10 if pos == "wr" else 5]
        for p in leaders:
            weeks = p["periods"]["season"]["coveredWeeks"]
            direct = sum(
                1
                for play in pbp
                if play["week"] in weeks
                and play.get(idkey) == p["playerId"]
                and predicate(play)
            )
            assert direct == p["periods"]["season"]["metrics"][metric]["num"]


def test_live_yac_coverage(live):
    docs, _ = live
    slots = [
        s
        for p in docs["rb"]["players"]
        for s in p["weeks"]
        if s["status"] == "played" and s["values"]["carries"] > 0
    ]
    assert sum(s["values"]["yacCovered"] for s in slots) / len(slots) >= 0.95


def test_live_first_four_end_zone_count(live):
    docs, pbp = live
    if docs["wr"]["meta"]["dataThroughWeek"] < 4:
        pytest.skip("Four completed common-source weeks not available yet")
    count = sum(
        1
        for p in pbp
        if 1 <= p["week"] <= 4
        and target(p)
        and p.get("air_yards") is not None
        and p.get("yardline_100") is not None
        and p["air_yards"] >= p["yardline_100"]
    )
    assert 200 <= count <= 300
