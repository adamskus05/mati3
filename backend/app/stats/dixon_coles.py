"""
Dixon-Coles modified Poisson model for football match outcomes.

Reference: Dixon, M.J. & Coles, S.G. (1997). Modelling Association Football
Scores and Inefficiencies in the Football Betting Market.

The model:
  - Estimates attack (alpha) and defence (beta) parameters per team
  - Applies home-field advantage (gamma)
  - Applies Dixon-Coles tau correction for low-score outcomes (0-0, 1-0, 0-1, 1-1)
  - Uses exponential time-weighting so recent matches count more
"""
import math
import numpy as np
from scipy.optimize import minimize
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

from app.config import settings
from app.stats.poisson import match_score_matrix, prob_1x2, prob_over_goals


@dataclass
class MatchRecord:
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int
    date: datetime
    weight: float = 1.0  # set after time_weight() is applied


@dataclass
class DCParameters:
    attack: dict[str, float] = field(default_factory=dict)
    defence: dict[str, float] = field(default_factory=dict)
    home_advantage: float = 1.0
    rho: float = 0.0            # Dixon-Coles low-score correction
    n_matches: int = 0
    teams: list[str] = field(default_factory=list)


@dataclass
class MatchPrediction:
    home_team: str
    away_team: str
    expected_home: float
    expected_away: float
    prob_home: float
    prob_draw: float
    prob_away: float
    prob_over_2_5: float
    prob_under_2_5: float
    score_matrix: list[list[float]]
    confidence: str              # LOW / MEDIUM / HIGH
    home_matches_used: int
    away_matches_used: int
    warning: Optional[str] = None


def time_weight(match_date: datetime, reference_date: datetime, half_life_days: float) -> float:
    """Exponential decay weight: w = 0.5^(age_days / half_life)."""
    age = (reference_date - match_date).total_seconds() / 86400
    age = max(0.0, age)
    return 0.5 ** (age / half_life_days)


def dc_tau(x: int, y: int, lam: float, mu: float, rho: float) -> float:
    """
    Dixon-Coles correction factor tau for low-scoring cells.
    Only modifies (0,0), (1,0), (0,1), (1,1); returns 1.0 otherwise.
    """
    if x == 0 and y == 0:
        return 1.0 - lam * mu * rho
    if x == 1 and y == 0:
        return 1.0 + mu * rho
    if x == 0 and y == 1:
        return 1.0 + lam * rho
    if x == 1 and y == 1:
        return 1.0 - rho
    return 1.0


def apply_dc_correction(
    matrix: list[list[float]],
    lam: float,
    mu: float,
    rho: float,
) -> list[list[float]]:
    """Apply Dixon-Coles tau correction to score matrix and renormalise."""
    corrected = []
    for i, row in enumerate(matrix):
        new_row = []
        for j, p in enumerate(row):
            tau = dc_tau(i, j, lam, mu, rho)
            new_row.append(p * tau)
        corrected.append(new_row)

    total = sum(p for row in corrected for p in row)
    if total > 0:
        corrected = [[p / total for p in row] for row in corrected]
    return corrected


def _neg_log_likelihood(
    params: np.ndarray,
    teams: list[str],
    matches: list[MatchRecord],
) -> float:
    n = len(teams)
    idx = {t: i for i, t in enumerate(teams)}

    # params layout: [attack_0..n-1, defence_0..n-1, home_adv, rho]
    attack = params[:n]
    defence = params[n:2*n]
    home_adv = params[2*n]
    rho = np.clip(params[2*n + 1], -0.99, settings.dc_rho_bound)

    ll = 0.0
    for m in matches:
        hi = idx[m.home_team]
        ai = idx[m.away_team]
        lam = np.exp(attack[hi] - defence[ai] + home_adv)
        mu = np.exp(attack[ai] - defence[hi])

        tau = dc_tau(m.home_goals, m.away_goals, lam, mu, rho)
        if tau <= 0:
            return 1e12

        log_p = (
            m.home_goals * math.log(lam) - lam - math.lgamma(m.home_goals + 1)
            + m.away_goals * math.log(mu) - mu - math.lgamma(m.away_goals + 1)
            + math.log(tau)
        )
        ll += m.weight * log_p

    return -ll


def fit_dixon_coles(matches: list[MatchRecord], reference_date: Optional[datetime] = None) -> DCParameters:
    """
    Fit Dixon-Coles parameters from a list of match records.
    Returns DCParameters with attack/defence per team.
    Raises ValueError if too few matches.
    """
    if not reference_date:
        reference_date = datetime.now(timezone.utc)

    # Apply time weights
    for m in matches:
        m.weight = time_weight(m.date, reference_date, settings.decay_half_life_days)

    teams = sorted({m.home_team for m in matches} | {m.away_team for m in matches})
    n = len(teams)

    if len(matches) < settings.min_matches_for_estimate:
        raise ValueError(
            f"Only {len(matches)} matches available; minimum is {settings.min_matches_for_estimate}."
        )

    # Initial guess: attack=0, defence=0, home_adv=0.1, rho=-0.1
    x0 = np.zeros(2 * n + 2)
    x0[2*n] = 0.1
    x0[2*n + 1] = -0.1

    # Constraints: fix one team's attack to 0 for identifiability
    constraints = [{"type": "eq", "fun": lambda p: p[0]}]

    result = minimize(
        _neg_log_likelihood,
        x0,
        args=(teams, matches),
        method="SLSQP",
        constraints=constraints,
        options={"maxiter": 200, "ftol": 1e-9},
    )

    if not result.success and result.fun > 1e11:
        raise ValueError(f"Optimisation failed: {result.message}")

    params = result.x
    attack = {t: params[i] for i, t in enumerate(teams)}
    defence = {t: params[n + i] for i, t in enumerate(teams)}

    return DCParameters(
        attack=attack,
        defence=defence,
        home_advantage=float(params[2*n]),
        rho=float(np.clip(params[2*n + 1], -0.99, settings.dc_rho_bound)),
        n_matches=len(matches),
        teams=teams,
    )


def predict_match(home_team: str, away_team: str, params: DCParameters, team_match_counts: dict[str, int]) -> MatchPrediction:
    """Generate match prediction from fitted DC parameters."""
    if home_team not in params.attack or away_team not in params.attack:
        missing = [t for t in [home_team, away_team] if t not in params.attack]
        raise ValueError(f"Teams not in fitted model: {missing}")

    lam = math.exp(params.attack[home_team] - params.defence[away_team] + params.home_advantage)
    mu = math.exp(params.attack[away_team] - params.defence[home_team])

    matrix = match_score_matrix(lam, mu)
    matrix = apply_dc_correction(matrix, lam, mu, params.rho)

    p_home, p_draw, p_away = prob_1x2(matrix)
    p_over = prob_over_goals(matrix, line=2.5)

    home_n = team_match_counts.get(home_team, 0)
    away_n = team_match_counts.get(away_team, 0)
    min_n = min(home_n, away_n)

    if min_n < 5:
        confidence = "LOW"
        warning = f"Insufficient data: fewest {min_n} matches for one team."
    elif min_n < 10:
        confidence = "MEDIUM"
        warning = None
    else:
        confidence = "HIGH"
        warning = None

    return MatchPrediction(
        home_team=home_team,
        away_team=away_team,
        expected_home=round(lam, 3),
        expected_away=round(mu, 3),
        prob_home=round(p_home, 4),
        prob_draw=round(p_draw, 4),
        prob_away=round(p_away, 4),
        prob_over_2_5=round(p_over, 4),
        prob_under_2_5=round(1 - p_over, 4),
        score_matrix=[[round(p, 5) for p in row] for row in matrix[:7]],
        confidence=confidence,
        home_matches_used=home_n,
        away_matches_used=away_n,
        warning=warning,
    )
