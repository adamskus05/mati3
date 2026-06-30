"""
Value bet identification: compare model probabilities against bookmaker odds.
Expected value (EV) = model_prob * decimal_odds - 1
Edge % = EV * 100
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class OddsEntry:
    bookmaker: str
    market: str
    outcome: str
    decimal_odds: float


@dataclass
class ValueBetCandidate:
    market: str
    outcome: str
    model_prob: float
    fair_odds: float
    best_odds: float
    bookmaker: str
    edge_percent: float
    confidence: str
    implied_prob: float          # bookmaker implied probability (overround removed)
    warning: Optional[str] = None


def expected_value(model_prob: float, decimal_odds: float) -> float:
    """EV = p * odds - 1. Positive means value."""
    return model_prob * decimal_odds - 1.0


def find_value_bets(
    model_probs: dict[str, float],   # {"home": 0.55, "draw": 0.25, "away": 0.20, ...}
    odds_entries: list[OddsEntry],
    confidence: str,
    min_edge_percent: float = 3.0,
    skip_low_confidence: bool = True,
) -> list[ValueBetCandidate]:
    """
    For each outcome, find the best available odds and check for value.
    Only returns bets where EV > min_edge_percent AND confidence is not LOW
    (unless skip_low_confidence is False).
    """
    if skip_low_confidence and confidence == "LOW":
        return []

    # Group odds by (market, outcome), keep best
    best: dict[tuple[str, str], OddsEntry] = {}
    for entry in odds_entries:
        key = (entry.market, entry.outcome)
        if key not in best or entry.decimal_odds > best[key].decimal_odds:
            best[key] = entry

    # Compute overround per market for normalisation
    market_odds: dict[str, list[float]] = {}
    for (market, _), entry in best.items():
        market_odds.setdefault(market, []).append(entry.decimal_odds)

    overrounds: dict[str, float] = {
        market: sum(1 / o for o in odds_list)
        for market, odds_list in market_odds.items()
    }

    candidates: list[ValueBetCandidate] = []
    for (market, outcome), entry in best.items():
        if outcome not in model_probs:
            continue
        model_p = model_probs[outcome]
        if model_p <= 0:
            continue

        or_ = overrounds.get(market, 1.0)
        implied_p = (1 / entry.decimal_odds) / or_ if or_ > 0 else 1 / entry.decimal_odds

        ev = expected_value(model_p, entry.decimal_odds)
        edge_pct = ev * 100.0

        if edge_pct >= min_edge_percent:
            candidates.append(ValueBetCandidate(
                market=market,
                outcome=outcome,
                model_prob=round(model_p, 4),
                fair_odds=round(1.0 / model_p, 2),
                best_odds=entry.decimal_odds,
                bookmaker=entry.bookmaker,
                edge_percent=round(edge_pct, 2),
                confidence=confidence,
                implied_prob=round(implied_p, 4),
            ))

    # Sort by edge descending — not by win probability
    candidates.sort(key=lambda c: c.edge_percent, reverse=True)
    return candidates


def calibration_brier_score(predictions: list[tuple[float, int]]) -> float:
    """
    Brier score: mean squared error of probability vs outcome.
    predictions: list of (predicted_prob, actual_outcome) where outcome is 0 or 1.
    Lower is better; perfect = 0, random = 0.25 for binary.
    """
    if not predictions:
        return float("nan")
    return sum((p - o) ** 2 for p, o in predictions) / len(predictions)
