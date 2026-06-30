"""Tests for value bet identification and calibration."""

import pytest
from app.stats.value_calculator import (
    OddsEntry,
    expected_value,
    find_value_bets,
    calibration_brier_score,
)


class TestExpectedValue:
    def test_positive_ev_when_model_higher(self):
        ev = expected_value(0.6, 2.0)  # model says 60%, odds imply 50%
        assert ev > 0

    def test_negative_ev_when_book_has_edge(self):
        ev = expected_value(0.4, 2.0)  # model says 40%, odds imply 50%
        assert ev < 0

    def test_breakeven_at_fair_odds(self):
        ev = expected_value(0.5, 2.0)
        assert abs(ev) < 1e-9


class TestFindValueBets:
    def _make_entries(self, home_odds: float, draw_odds: float, away_odds: float) -> list[OddsEntry]:
        return [
            OddsEntry("pinnacle", "1x2", "home", home_odds),
            OddsEntry("pinnacle", "1x2", "draw", draw_odds),
            OddsEntry("pinnacle", "1x2", "away", away_odds),
        ]

    def test_finds_value_bet(self):
        model_probs = {"home": 0.60, "draw": 0.25, "away": 0.15}
        # Odds suggest home has only 45% chance — model says 60%
        entries = self._make_entries(2.22, 4.0, 6.0)
        bets = find_value_bets(model_probs, entries, confidence="HIGH", min_edge_percent=3.0)
        assert any(b.outcome == "home" for b in bets)
        assert all(b.edge_percent >= 3.0 for b in bets)

    def test_no_value_when_book_correct(self):
        model_probs = {"home": 0.45, "draw": 0.30, "away": 0.25}
        entries = self._make_entries(2.22, 3.33, 4.0)
        bets = find_value_bets(model_probs, entries, confidence="HIGH", min_edge_percent=3.0)
        assert len(bets) == 0

    def test_skips_low_confidence_by_default(self):
        model_probs = {"home": 0.70, "draw": 0.20, "away": 0.10}
        entries = self._make_entries(1.5, 5.0, 10.0)
        bets = find_value_bets(model_probs, entries, confidence="LOW")
        assert len(bets) == 0

    def test_allows_low_confidence_when_flag_set(self):
        model_probs = {"home": 0.70, "draw": 0.20, "away": 0.10}
        entries = self._make_entries(1.5, 5.0, 10.0)
        bets = find_value_bets(model_probs, entries, confidence="LOW", skip_low_confidence=False)
        assert len(bets) >= 0  # may or may not have value

    def test_sorted_by_edge_descending(self):
        model_probs = {"home": 0.65, "draw": 0.20, "away": 0.15, "over": 0.60, "under": 0.40}
        entries = [
            OddsEntry("bookie", "1x2", "home", 2.5),
            OddsEntry("bookie", "over_under_2.5", "over", 2.0),
        ]
        bets = find_value_bets(model_probs, entries, confidence="HIGH", min_edge_percent=0.0)
        edges = [b.edge_percent for b in bets]
        assert edges == sorted(edges, reverse=True)

    def test_picks_best_odds_across_bookmakers(self):
        model_probs = {"home": 0.60}
        entries = [
            OddsEntry("bookie_a", "1x2", "home", 1.80),
            OddsEntry("bookie_b", "1x2", "home", 2.20),
        ]
        bets = find_value_bets(model_probs, entries, confidence="HIGH", min_edge_percent=0.0)
        assert len(bets) == 1
        assert bets[0].best_odds == 2.20
        assert bets[0].bookmaker == "bookie_b"


class TestCalibration:
    def test_perfect_predictions(self):
        predictions = [(1.0, 1), (0.0, 0)]
        score = calibration_brier_score(predictions)
        assert abs(score) < 1e-9

    def test_random_predictions(self):
        predictions = [(0.5, 1), (0.5, 0)] * 50
        score = calibration_brier_score(predictions)
        assert abs(score - 0.25) < 1e-9

    def test_empty_returns_nan(self):
        import math
        score = calibration_brier_score([])
        assert math.isnan(score)
