from conftest import player

from pipeline.metrics import aggregate, summed_ratio


def test_last_four_spans_bye(documents):
    period = player(documents, "wr")["periods"]["last4"]
    assert period["games"] == 4 and period["coveredWeeks"] == [2, 4, 5, 6]


def test_three_games():
    result = aggregate([{"week": w, "values": {}} for w in (1, 2, 4)])
    assert result["games"] == 3 and result["coveredWeeks"] == [1, 2, 4]


def test_summed_ratio():
    assert summed_ratio([(8, 40), (4, 10)]) == {"value": 0.24, "num": 12, "den": 50}


def test_weekly_reconciliation(documents):
    for doc in documents.values():
        for p in doc["players"]:
            for period in p["periods"].values():
                weeks = [s for s in p["weeks"] if s["week"] in period["coveredWeeks"]]
                for metric, key, den in [
                    ("pointsPerGame", "actual", None),
                    ("xfpPerGame", "xfp", None),
                    ("targetShare", "targets", "teamTargets"),
                    ("rbCarryShare", "carries", "teamRbCarries"),
                ]:
                    m = period["metrics"][metric]
                    assert m["num"] == sum(w["values"][key] for w in weeks)
                    assert m["den"] == (
                        sum(w["values"][den] for w in weeks) if den else len(weeks)
                    )
