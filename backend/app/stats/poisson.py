"""
Poisson distribution utilities for goal modelling.
All functions operate on lambda (expected goals) parameters.
"""
import math
from scipy.stats import poisson


def goal_probability(lam: float, k: int) -> float:
    """P(X = k) for Poisson(lambda)."""
    return poisson.pmf(k, lam)


def match_score_matrix(lam_home: float, lam_away: float, max_goals: int = 10) -> list[list[float]]:
    """
    Returns (max_goals+1) x (max_goals+1) matrix where cell [i][j]
    is the probability of home scoring i, away scoring j.
    Independent Poisson — Dixon-Coles correction applied separately.
    """
    matrix = []
    for i in range(max_goals + 1):
        row = []
        for j in range(max_goals + 1):
            row.append(goal_probability(lam_home, i) * goal_probability(lam_away, j))
        matrix.append(row)
    return matrix


def prob_over_goals(matrix: list[list[float]], line: float = 2.5) -> float:
    """P(total goals > line) from score matrix."""
    threshold = math.ceil(line)
    total = 0.0
    for i, row in enumerate(matrix):
        for j, p in enumerate(row):
            if i + j >= threshold:
                total += p
    return total


def prob_1x2(matrix: list[list[float]]) -> tuple[float, float, float]:
    """Returns (P_home_win, P_draw, P_away_win)."""
    home_win = draw = away_win = 0.0
    for i, row in enumerate(matrix):
        for j, p in enumerate(row):
            if i > j:
                home_win += p
            elif i == j:
                draw += p
            else:
                away_win += p
    return home_win, draw, away_win


def overround(odds_list: list[float]) -> float:
    """Bookmaker overround: sum of implied probabilities."""
    return sum(1 / o for o in odds_list if o > 0)


def remove_overround(implied_prob: float, total_overround: float) -> float:
    """Normalise implied probability by removing bookmaker margin."""
    if total_overround <= 0:
        return implied_prob
    return implied_prob / total_overround
