from conftest import player

from pipeline.metrics import build_documents


def test_zero_snap_active_bye_and_trade(documents):
    p = player(documents, "wr")
    assert p["weeks"][0]["status"] == "played"
    assert p["weeks"][2]["status"] == "bye"
    assert p["weeks"][0]["team"] == "A" and p["weeks"][4]["team"] == "B"
    assert p["periods"]["season"]["games"] == 5


def test_inactive_status(source_rows, manifest):
    source_rows["rosters"][0]["status"] = "INA"
    source_rows["injuries"].append(
        {
            "gsis_id": "wr",
            "week": 1,
            "report_status": "Out",
            "report_primary_injury": "hamstring",
        }
    )
    slot = player(build_documents(source_rows, manifest, 2026), "wr")["weeks"][0]
    assert slot["status"] == "inactive" and slot["injuryStatus"] == "Out: hamstring"
    assert slot["values"]["actual"] is None


def test_special_teams_and_callup(source_rows, manifest):
    source_rows["rosters"][0]["status"] = "INA"
    source_rows["snaps"].append(
        {
            "game_id": source_rows["games"][0]["game_id"],
            "week": 1,
            "pfr_player_id": "w",
            "team": "A",
            "st_snaps": 2,
        }
    )
    assert (
        player(build_documents(source_rows, manifest, 2026), "wr")["weeks"][0]["status"]
        == "played"
    )


def test_future_not_missed(documents):
    slot = player(documents, "wr")["weeks"][6]
    assert slot["upcoming"] and slot["values"]["actual"] is None


def test_no_opportunity_still_counts_appearance(source_rows, manifest):
    # Another player's model row proves the game was published. A zero-touch
    # player must remain in the denominator even without their own model row.
    for row in source_rows["opportunity"]:
        row["player_id"] = "other"
    p = player(build_documents(source_rows, manifest, 2026), "wr")
    period = p["periods"]["season"]
    assert period["games"] == 5
    assert period["metrics"]["pointsPerGame"] == {"value": 0, "num": 0, "den": 5}
    assert period["metrics"]["xfpPerGame"] == {"value": 0, "num": 0, "den": 5}
