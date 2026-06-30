from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LeagueOut(BaseModel):
    id: int
    name: str
    country: Optional[str]
    season: int

    class Config:
        from_attributes = True


class TeamOut(BaseModel):
    id: int
    name: str
    logo_url: Optional[str]

    class Config:
        from_attributes = True


class ModelOutputOut(BaseModel):
    prob_home: Optional[float]
    prob_draw: Optional[float]
    prob_away: Optional[float]
    prob_over_2_5: Optional[float]
    prob_under_2_5: Optional[float]
    expected_home_goals: Optional[float]
    expected_away_goals: Optional[float]
    home_matches_used: Optional[int]
    away_matches_used: Optional[int]
    confidence: Optional[str]
    computed_at: Optional[datetime]

    class Config:
        from_attributes = True


class BestOddsOut(BaseModel):
    market: str
    outcome: str
    decimal_odds: float
    bookmaker: str
    implied_prob: float


class FixtureOut(BaseModel):
    id: int
    kickoff_utc: datetime
    status: str
    home_team: TeamOut
    away_team: TeamOut
    league: LeagueOut
    home_goals: Optional[int]
    away_goals: Optional[int]
    model_output: Optional[ModelOutputOut]
    best_odds: list[BestOddsOut] = []

    class Config:
        from_attributes = True


class ValueBetOut(BaseModel):
    id: int
    fixture_id: int
    market: str
    outcome: str
    model_prob: float
    best_odds: float
    bookmaker: str
    edge_percent: float = Field(..., description="Expected value as percentage")
    confidence: str
    created_at: datetime
    result: Optional[str]

    # Derived fields
    fair_odds: float = Field(..., description="1 / model_prob")
    home_team_name: str
    away_team_name: str
    kickoff_utc: datetime

    class Config:
        from_attributes = True


class CalibrationPoint(BaseModel):
    prob_bucket: str           # e.g. "50-60%"
    predicted_prob: float
    actual_win_rate: float
    sample_size: int


class CalibrationOut(BaseModel):
    points: list[CalibrationPoint]
    brier_score: Optional[float]
    total_bets_tracked: int


class SyncStatusOut(BaseModel):
    message: str
    fixtures_updated: int
    odds_updated: int
