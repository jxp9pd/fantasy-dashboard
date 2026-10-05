from conftest import player

from pipeline.metrics import build_documents, target


def test_target_share_and_trade(source_rows, manifest):
    for week, team, num, den in [(1, "A", 8, 40), (5, "B", 4, 10)]:
        gid = source_rows["games"][week - 1]["game_id"]
        source_rows["pbp"] += [
            {
                "game_id": gid,
                "week": week,
                "posteam": team,
                "pass_attempt": 1,
                "receiver_player_id": "wr" if i < num else "other",
                "sack": 0,
                "air_yards": 1,
                "yardline_100": 20,
            }
            for i in range(den)
        ]
    m = player(build_documents(source_rows, manifest, 2026), "wr")["periods"]["season"][
        "metrics"
    ]["targetShare"]
    assert m == {"value": 0.24, "num": 12, "den": 50}


def test_sacks_and_no_plays_excluded():
    assert not target({"pass_attempt": 1, "receiver_player_id": "wr", "sack": 1})
    assert not target(
        {"pass_attempt": 1, "receiver_player_id": "wr", "play_type": "no_play"}
    )
