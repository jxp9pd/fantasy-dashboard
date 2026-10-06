from pipeline.metrics import build_documents


def test_tight_ends_use_receiving_metrics_and_separate_population(source_rows, manifest):
    for week, targets in [(1, 3), (2, 5)]:
        game = source_rows["games"][week - 1]["game_id"]
        source_rows["pbp"] += [
            {
                "game_id": game, "week": week, "posteam": "A",
                "pass_attempt": 1, "sack": 0,
                "receiver_player_id": "te" if index < targets else "wr",
                "air_yards": 20 if index == 0 else 5, "yardline_100": 20,
            }
            for index in range(10)
        ]
        source_rows["opportunity"].append({
            "player_id": "te", "game_id": game,
            "total_fantasy_points": 24, "receptions": 4,
            "total_fantasy_points_exp": 20, "receptions_exp": 2,
        })
    documents = build_documents(source_rows, manifest, 2026)
    assert documents["te"]["meta"]["position"] == "TE"
    assert [p["playerId"] for p in documents["te"]["players"]] == ["te"]
    assert all(p["playerId"] != "te" for pos in ("wr", "rb") for p in documents[pos]["players"])
    te = documents["te"]["players"][0]
    season = te["periods"]["season"]
    assert season["rank"] == 1
    assert season["games"] == 5  # Active zero-target games count; week-three bye does not.
    metrics = season["metrics"]
    assert metrics["pointsPerGame"]["value"] == 44 / 5
    assert metrics["xfpPerGame"]["value"] == 38 / 5
    assert metrics["targetsPerGame"] == {"value": 8 / 5, "num": 8, "den": 5}
    assert metrics["targetShare"] == {"value": 0.4, "num": 8, "den": 20}
    assert metrics["endZoneTargetsPerGame"] == {"value": 2 / 5, "num": 2, "den": 5}
    assert metrics["routeParticipation"]["value"] is None
    assert metrics["yardsPerRoute"]["value"] is None
    assert te["periods"]["last4"]["metrics"]["targetsPerGame"]["value"] == 5 / 4
    assert te["weeks"][0]["values"]["targetShare"] == 0.3
    assert te["weeks"][2]["status"] == "bye"
