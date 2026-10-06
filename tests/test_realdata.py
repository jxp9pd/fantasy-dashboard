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
    cache = Path(__file__).resolve().parents[1] / "data/raw"
    season = docs["rb"]["meta"]["season"]
    roster = read_rows(cache / f"roster_weekly_{season}.parquet")
    ids = {r["pfr_id"]: r["gsis_id"] for r in roster if r.get("pfr_id")}
    # PFR is optional and often publishes only some games in the newest week.
    # Reconcile every covered/missing slot to its actual source instead of
    # requiring a season-wide coverage percentage that rejects valid refreshes.
    source = next(s for s in docs["rb"]["meta"]["sources"] if s["name"] == "rushing")
    path = cache / f"advstats_week_rush_{season}.parquet"
    rows = read_rows(path) if source["throughWeek"] else []
    charted = {
        (ids[r["pfr_player_id"]], int(r["week"]), r["team"]): r
        for r in rows
        if r.get("game_type", "REG") == "REG"
        and r["pfr_player_id"] in ids
        and r.get("rushing_yards_after_contact") is not None
        and r.get("carries") is not None
    }
    for player in docs["rb"]["players"]:
        for slot in player["weeks"]:
            if slot["status"] != "played":
                continue
            row = charted.get((player["playerId"], slot["week"], slot["team"]))
            assert bool(slot["values"]["yacCovered"]) == (row is not None)
            assert slot["values"]["yac"] == (row["rushing_yards_after_contact"] if row else 0)
            assert slot["values"]["chartedCarries"] == (row["carries"] if row else 0)
        for aggregate in player["periods"].values():
            slots = [s for s in player["weeks"] if s["week"] in aggregate["coveredWeeks"]]
            assert aggregate["coverage"]["yardsAfterContactPerCarry"] == {
                "covered": sum(s["values"]["yacCovered"] for s in slots),
                "total": len(slots),
            }


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
