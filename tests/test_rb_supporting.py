from conftest import player

from pipeline.metrics import build_documents


def test_charting_coverage(source_rows, manifest):
    for week, yac, carries in [(1, 10, 5), (2, 30, 10), (4, 5, 5)]:
        source_rows["rushing"].append(
            {
                "game_id": source_rows["games"][week - 1]["game_id"],
                "week": week,
                "pfr_player_id": "r",
                "rushing_yards_after_contact": yac,
                "carries": carries,
            }
        )
    period = player(build_documents(source_rows, manifest, 2026), "rb")["periods"][
        "last4"
    ]
    assert period["metrics"]["yardsAfterContactPerCarry"] == {
        "value": 35 / 15,
        "num": 35,
        "den": 15,
    }
    assert period["coverage"]["yardsAfterContactPerCarry"] == {"covered": 2, "total": 4}


def test_absent_charting_stays_unavailable(documents):
    period = player(documents, "rb")["periods"]["season"]
    assert period["metrics"]["yardsAfterContactPerCarry"]["value"] is None
    assert period["coverage"]["yardsAfterContactPerCarry"] == {"covered": 0, "total": 5}
