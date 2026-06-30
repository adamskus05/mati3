from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.db_models import Fixture, BookmakerOdds
from app.models.schemas import FixtureOut, BestOddsOut

router = APIRouter(prefix="/fixtures", tags=["fixtures"])


@router.get("/upcoming", response_model=list[FixtureOut])
async def get_upcoming_fixtures(
    days: int = Query(default=7, ge=1, le=14),
    league_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Upcoming fixtures with model predictions and best available odds."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days)

    query = (
        select(Fixture)
        .options(
            selectinload(Fixture.home_team),
            selectinload(Fixture.away_team),
            selectinload(Fixture.league),
            selectinload(Fixture.model_output),
            selectinload(Fixture.bookmaker_odds),
        )
        .where(and_(Fixture.status == "NS", Fixture.kickoff_utc.between(now, cutoff)))
        .order_by(Fixture.kickoff_utc)
    )

    if league_id:
        query = query.where(Fixture.league_id == league_id)

    result = await db.execute(query)
    fixtures = result.scalars().all()

    out = []
    for f in fixtures:
        best_odds = _best_odds_per_market(f.bookmaker_odds or [])
        out.append(FixtureOut(
            id=f.id,
            kickoff_utc=f.kickoff_utc,
            status=f.status,
            home_team=f.home_team,
            away_team=f.away_team,
            league=f.league,
            home_goals=f.home_goals,
            away_goals=f.away_goals,
            model_output=f.model_output,
            best_odds=best_odds,
        ))
    return out


def _best_odds_per_market(odds_list) -> list[BestOddsOut]:
    """For each (market, outcome) return the highest decimal odds across bookmakers."""
    best: dict[tuple, "BookmakerOdds"] = {}
    for o in odds_list:
        key = (o.market, o.outcome)
        if key not in best or o.decimal_odds > best[key].decimal_odds:
            best[key] = o

    result = []
    for (market, outcome), o in best.items():
        implied = 1.0 / o.decimal_odds if o.decimal_odds > 0 else 0.0
        result.append(BestOddsOut(
            market=market,
            outcome=outcome,
            decimal_odds=o.decimal_odds,
            bookmaker=o.bookmaker,
            implied_prob=round(implied, 4),
        ))
    return result
