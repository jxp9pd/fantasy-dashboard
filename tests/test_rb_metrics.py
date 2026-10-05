from conftest import player

from pipeline.metrics import build_documents, carry


def rush(pid, yard=5, **extra):
    return dict(
        posteam="A", rusher_player_id=pid, rush_attempt=1, yardline_100=yard, **extra
    )


def test_rb_group_and_inside5(source_rows, manifest):
    gid = source_rows["games"][0]["game_id"]
    plays = [
        rush("rb"),
        rush("fb"),
        rush("qb"),
        rush("qb", qb_scramble=1),
        rush("wr"),
        rush("rb", 6),
        rush("rb", qb_kneel=1),
        rush("rb", two_point_attempt=1),
    ]
    source_rows["pbp"] += [dict(p, game_id=gid, week=1) for p in plays]
    m = player(build_documents(source_rows, manifest, 2026), "rb")["periods"]["season"][
        "metrics"
    ]
    assert m["rbCarryShare"] == {"value": 2 / 3, "num": 2, "den": 3}
    assert m["inside5Share"] == {"value": 1 / 5, "num": 1, "den": 5}
    assert m["inside5PerGame"]["num"] == 1


def test_zero_denominator(documents):
    assert (
        player(documents, "rb")["periods"]["season"]["metrics"]["rbCarryShare"]["value"]
        is None
    )


def test_kneels_two_point_no_play():
    for extra in [
        {"qb_kneel": 1},
        {"two_point_attempt": 1},
        {"play_type": "no_play"},
    ]:
        assert not carry(rush("rb", **extra))
