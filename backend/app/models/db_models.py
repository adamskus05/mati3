from datetime import datetime
from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship

from app.database import Base


class League(Base):
    __tablename__ = "leagues"

    id = Column(Integer, primary_key=True)           # API-Football league id
    name = Column(String(120), nullable=False)
    country = Column(String(80))
    season = Column(Integer, nullable=False)          # e.g. 2024
    logo_url = Column(Text)
    active = Column(Boolean, default=True)

    teams = relationship("Team", back_populates="league")
    fixtures = relationship("Fixture", back_populates="league")

    __table_args__ = (UniqueConstraint("id", "season"),)


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)            # API-Football team id
    name = Column(String(120), nullable=False)
    league_id = Column(Integer, ForeignKey("leagues.id"))
    logo_url = Column(Text)

    league = relationship("League", back_populates="teams")
    home_fixtures = relationship("Fixture", foreign_keys="Fixture.home_team_id", back_populates="home_team")
    away_fixtures = relationship("Fixture", foreign_keys="Fixture.away_team_id", back_populates="away_team")
    strength = relationship("TeamStrength", back_populates="team", uselist=False)


class Fixture(Base):
    __tablename__ = "fixtures"

    id = Column(Integer, primary_key=True)            # API-Football fixture id
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    kickoff_utc = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="NS")         # NS/1H/HT/2H/FT/...
    home_goals = Column(Integer)
    away_goals = Column(Integer)
    home_xg = Column(Float)
    away_xg = Column(Float)
    referee = Column(String(120))

    league = relationship("League", back_populates="fixtures")
    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_fixtures")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_fixtures")
    model_output = relationship("ModelOutput", back_populates="fixture", uselist=False)
    bookmaker_odds = relationship("BookmakerOdds", back_populates="fixture")
    value_bets = relationship("ValueBet", back_populates="fixture")

    __table_args__ = (
        Index("ix_fixtures_kickoff", "kickoff_utc"),
        Index("ix_fixtures_league_status", "league_id", "status"),
    )


class TeamStrength(Base):
    """Dixon-Coles attack/defense parameters per team per season."""
    __tablename__ = "team_strengths"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, unique=True)
    season = Column(Integer, nullable=False)
    attack = Column(Float)                            # lambda_attack
    defense = Column(Float)                           # lambda_defense
    matches_used = Column(Integer, default=0)
    last_updated = Column(DateTime(timezone=True))

    team = relationship("Team", back_populates="strength")


class ModelOutput(Base):
    """Computed probabilities per fixture."""
    __tablename__ = "model_outputs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fixture_id = Column(Integer, ForeignKey("fixtures.id"), nullable=False, unique=True)
    computed_at = Column(DateTime(timezone=True), nullable=False)

    # 1X2
    prob_home = Column(Float)
    prob_draw = Column(Float)
    prob_away = Column(Float)

    # Over/under goals (2.5 line)
    prob_over_2_5 = Column(Float)
    prob_under_2_5 = Column(Float)

    # Expected goals
    expected_home_goals = Column(Float)
    expected_away_goals = Column(Float)

    # Model confidence metadata
    home_matches_used = Column(Integer)
    away_matches_used = Column(Integer)
    confidence = Column(String(10))                   # LOW / MEDIUM / HIGH

    fixture = relationship("Fixture", back_populates="model_output")


class BookmakerOdds(Base):
    __tablename__ = "bookmaker_odds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fixture_id = Column(Integer, ForeignKey("fixtures.id"), nullable=False)
    bookmaker = Column(String(80), nullable=False)
    market = Column(String(40), nullable=False)       # 1x2 / over_under_2.5 / ...
    outcome = Column(String(40), nullable=False)      # home / draw / away / over / under
    decimal_odds = Column(Float, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False)

    fixture = relationship("Fixture", back_populates="bookmaker_odds")

    __table_args__ = (
        Index("ix_bookmaker_fixture_market", "fixture_id", "market"),
    )


class ValueBet(Base):
    __tablename__ = "value_bets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fixture_id = Column(Integer, ForeignKey("fixtures.id"), nullable=False)
    market = Column(String(40), nullable=False)
    outcome = Column(String(40), nullable=False)
    model_prob = Column(Float, nullable=False)
    best_odds = Column(Float, nullable=False)
    bookmaker = Column(String(80), nullable=False)
    edge_percent = Column(Float, nullable=False)      # EV as %
    confidence = Column(String(10), nullable=False)   # LOW / MEDIUM / HIGH
    created_at = Column(DateTime(timezone=True), nullable=False)

    # Tracking actual outcome for calibration
    result = Column(String(20))                       # WON / LOST / VOID / NULL
    settled_at = Column(DateTime(timezone=True))

    fixture = relationship("Fixture", back_populates="value_bets")

    __table_args__ = (
        Index("ix_value_bets_edge", "edge_percent"),
        Index("ix_value_bets_created", "created_at"),
    )
