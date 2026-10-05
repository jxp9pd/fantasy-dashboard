from conftest import player

from pipeline.metrics import build_documents


def test_boundary_and_missing(source_rows, manifest):
    gid = source_rows["games"][0]["game_id"]
    source_rows["pbp"] += [
        {
            "game_id": gid,
            "week": 1,
            "posteam": "A",
            "pass_attempt": 1,
            "receiver_player_id": "wr",
            "yardline_100": 8,
            "air_yards": air,
            "sack": sack,
        }
        for air, sack in [(9, 0), (7, 0), (8, 0), (9, 1), (None, 0)]
    ]
    m = player(build_documents(source_rows, manifest, 2026), "wr")["periods"]["season"][
        "metrics"
    ]
    assert m["endZoneTargetsPerGame"]["num"] == 2
    assert m["endZoneMissingAirYards"]["value"] == 1
