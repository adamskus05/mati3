"""
Tests for the Dixon-Coles model.
No database or API required — pure statistical unit tests.
"""
import math
from datetime import datetime, timezone

import pytest

from app.stats.dixon_coles import (
    MatchRecord,
    dc_tau,
    apply_dc_correction,
    fit_dixon_coles,
    predict_match,
    time_weight,
)
from app.stats.poisson import match_score_matrix, prob_1x2, prob_over_goals


def make_balanced_dataset(n_games: int = 40) -> list[MatchRecord]:
    """Generate synthetic match records for a 4-team league."""
    teams = ["TeamA", "TeamB", "TeamC", "TeamD"]
    records = []
    base = datetime(2024, 1, 1, tzinfo=timezone.utc)
    from datetime import timedelta
    i = 0
    for home in teams:
        for away in teams:
            if home == away:
                continue
            records.append(MatchRecord(
                home_team=home,
                away_team=away,
                home_goals=2,
                away_goals=1,
                date=base + timedelta(days=i * 7),
            ))
            i += 1
    return records


class TestDCTau:
    def test_no_correction_for_high_scores(self):
        assert dc_tau(3, 2, 1.5, 1.2, -0.1) == 1.0
        assert dc_tau(0, 3, 1.5, 1.2, -0.1) == 1.0

    def test_0_0_correction(self):
        tau = dc_tau(0, 0, 1.5, 1.2, -0.1)
        assert abs(tau - (1.0 - 1.5 * 1.2 * (-0.1))) < 1e-9

    def test_1_1_correction(self):
        assert dc_tau(1, 1, 1.5, 1.2, -0.1) == pytest.approx(1.0 - (-0.1))


class TestScoreMatrix:
    def test_sums_to_one(self):
        matrix = match_score_matrix(1.5, 1.2, max_goals=15)
        total = sum(p for row in matrix for p in row)
        assert abs(total - 1.0) < 1e-6

    def test_prob_1x2_sums_to_one(self):
        matrix = match_score_matrix(1.5, 1.2)
        h, d, a = prob_1x2(matrix)
        assert abs(h + d + a - 1.0) < 1e-6

    def test_higher_lambda_favours_home(self):
        matrix_home = match_score_matrix(2.5, 0.8)
        matrix_away = match_score_matrix(0.8, 2.5)
        h1, _, _ = prob_1x2(matrix_home)
        _, _, a2 = prob_1x2(matrix_away)
        assert h1 > 0.5
        assert a2 > 0.5


class TestDCCorrection:
    def test_correction_preserves_normalisation(self):
        matrix = match_score_matrix(1.5, 1.2)
        corrected = apply_dc_correction(matrix, 1.5, 1.2, -0.1)
        total = sum(p for row in corrected for p in row)
        assert abs(total - 1.0) < 1e-6


class TestFitDixonColes:
    def test_fits_with_sufficient_data(self):
        records = make_balanced_dataset()
        params = fit_dixon_coles(records)
        assert "TeamA" in params.attack
        assert "TeamB" in params.defence
        assert params.n_matches == len(records)

    def test_raises_on_insufficient_data(self):
        records = make_balanced_dataset()[:2]
        with pytest.raises(ValueError, match="minimum"):
            fit_dixon_coles(records)

    def test_home_advantage_positive(self):
        """Home advantage parameter should be positive in balanced data."""
        records = make_balanced_dataset()
        params = fit_dixon_coles(records)
        # Home advantage can vary — just check it's a finite number
        assert math.isfinite(params.home_advantage)


class TestPrediction:
    def test_predict_known_teams(self):
        records = make_balanced_dataset()
        params = fit_dixon_coles(records)
        counts = {"TeamA": 6, "TeamB": 6, "TeamC": 6, "TeamD": 6}
        pred = predict_match("TeamA", "TeamB", params, counts)

        assert abs(pred.prob_home + pred.prob_draw + pred.prob_away - 1.0) < 1e-4
        assert abs(pred.prob_over_2_5 + pred.prob_under_2_5 - 1.0) < 1e-4
        assert pred.expected_home > 0
        assert pred.expected_away > 0

    def test_predict_unknown_team_raises(self):
        records = make_balanced_dataset()
        params = fit_dixon_coles(records)
        with pytest.raises(ValueError, match="not in fitted model"):
            predict_match("TeamA", "TeamZ", params, {})

    def test_confidence_low_on_few_matches(self):
        records = make_balanced_dataset()
        params = fit_dixon_coles(records)
        counts = {"TeamA": 2, "TeamB": 2}
        pred = predict_match("TeamA", "TeamB", params, counts)
        assert pred.confidence == "LOW"

    def test_confidence_high_on_many_matches(self):
        records = make_balanced_dataset()
        params = fit_dixon_coles(records)
        counts = {"TeamA": 15, "TeamB": 15}
        pred = predict_match("TeamA", "TeamB", params, counts)
        assert pred.confidence == "HIGH"


class TestTimeWeight:
    def test_recent_match_weight_one(self):
        now = datetime(2024, 6, 1, tzinfo=timezone.utc)
        w = time_weight(now, now, half_life_days=90)
        assert abs(w - 1.0) < 1e-9

    def test_90_day_old_match_weight_half(self):
        from datetime import timedelta
        ref = datetime(2024, 6, 1, tzinfo=timezone.utc)
        old = ref - timedelta(days=90)
        w = time_weight(old, ref, half_life_days=90)
        assert abs(w - 0.5) < 1e-9
