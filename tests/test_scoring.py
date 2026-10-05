import pytest

from pipeline.metrics import half_ppr


def test_half_ppr_actual_and_expected():
    assert half_ppr(
        {
            "total_fantasy_points": 15,
            "total_fantasy_points_exp": 12.123,
            "receptions": 4,
            "receptions_exp": 3.1,
        }
    ) == pytest.approx((13, 10.573))


def test_fumble_and_conversion_model_scoring():
    assert half_ppr({"total_fantasy_points": -2, "total_fantasy_points_exp": 0}) == (
        -2,
        0,
    )
    assert half_ppr({"total_fantasy_points": 2, "total_fantasy_points_exp": 2}) == (
        2,
        2,
    )


def test_missing_model_row_is_zero():
    assert half_ppr({}) == (0, 0)
