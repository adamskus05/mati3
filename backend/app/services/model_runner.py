"""
Orchestrates the full pipeline:
1. Load historical fixtures from DB
2. Fit Dixon-Coles parameters per league
3. Generate predictions for upcoming fixtures
4. Compare predictions against bookmaker odds
5. Persist ModelOutput and ValueBet records
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.db_models import Fixture, ModelOutput, BookmakerOdds, ValueBet
from app.stats.dixon_coles import MatchRecord, fit_dixon_coles, predict_match
from app.stats.value_calculator import OddsEntry, find_value_bets

logger = logging.getLogger(__name__)


async def load_historical_matches(db: AsyncSession, league_id: int, season: int) -> list[MatchRecord]:
    """Load completed fixtures from DB and convert to MatchRecord list."""
    result = await db.execute(
        select(Fixture).where(
            and_(
                Fixture.league_id == league_id,
                Fixture.status == "FT",
                Fixture.home_goals.is_not(None),
                Fixture.away_goals.is_not(None),
            )
        )
    )
    fixtures = result.scalars().all()

    records = []
    for f in fixtures:
        if f.home_team and f.away_team:
            records.append(MatchRecord(
                home_team=str(f.home_team_id),
                away_team=str(f.away_team_id),
                home_goals=f.home_goals,
                away_goals=f.away_goals,
                date=f.kickoff_utc.replace(tzinfo=timezone.utc) if f.kickoff_utc.tzinfo is None else f.kickoff_utc,
            ))
    return records


async def run_league_model(db: AsyncSession, league_id: int, season: int) -> dict:
    """
    Run full Dixon-Coles pipeline for one league.
    Returns summary stats.
    """
    logger.info("Running DC model for league %s season %s", league_id, season)

    historical = await load_historical_matches(db, league_id, season)
    if len(historical) < settings.min_matches_for_estimate:
        logger.warning("League %s: only %d matches — skipping model run", league_id, len(historical))
        return {"league_id": league_id, "skipped": True, "reason": "insufficient_data"}

    try:
        params = fit_dixon_coles(historical)
    except ValueError as e:
        logger.error("Dixon-Coles fit failed for league %s: %s", league_id, e)
        return {"league_id": league_id, "skipped": True, "reason": str(e)}

    # Count matches per team for confidence scoring
    team_counts: dict[str, int] = {}
    for m in historical:
        team_counts[m.home_team] = team_counts.get(m.home_team, 0) + 1
        team_counts[m.away_team] = team_counts.get(m.away_team, 0) + 1

    # Get upcoming fixtures
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Fixture).where(
            and_(
                Fixture.league_id == league_id,
                Fixture.status == "NS",
                Fixture.kickoff_utc > now,
            )
        )
    )
    upcoming = result.scalars().all()

    predictions_saved = 0
    value_bets_found = 0

    for fixture in upcoming:
        home_id = str(fixture.home_team_id)
        away_id = str(fixture.away_team_id)

        if home_id not in params.attack or away_id not in params.attack:
            logger.debug("Fixture %s: one or both teams not in fitted model", fixture.id)
            continue

        try:
            pred = predict_match(home_id, away_id, params, team_counts)
        except ValueError as e:
            logger.debug("Prediction failed for fixture %s: %s", fixture.id, e)
            continue

        # Upsert ModelOutput
        existing = await db.execute(
            select(ModelOutput).where(ModelOutput.fixture_id == fixture.id)
        )
        mo = existing.scalar_one_or_none()
        if mo is None:
            mo = ModelOutput(fixture_id=fixture.id)
            db.add(mo)

        mo.computed_at = now
        mo.prob_home = pred.prob_home
        mo.prob_draw = pred.prob_draw
        mo.prob_away = pred.prob_away
        mo.prob_over_2_5 = pred.prob_over_2_5
        mo.prob_under_2_5 = pred.prob_under_2_5
        mo.expected_home_goals = pred.expected_home
        mo.expected_away_goals = pred.expected_away
        mo.home_matches_used = pred.home_matches_used
        mo.away_matches_used = pred.away_matches_used
        mo.confidence = pred.confidence
        predictions_saved += 1

        # Load bookmaker odds for this fixture
        odds_result = await db.execute(
            select(BookmakerOdds).where(BookmakerOdds.fixture_id == fixture.id)
        )
        bm_odds = odds_result.scalars().all()

        if not bm_odds:
            continue

        entries = [
            OddsEntry(
                bookmaker=o.bookmaker,
                market=o.market,
                outcome=o.outcome,
                decimal_odds=o.decimal_odds,
            )
            for o in bm_odds
        ]

        model_probs = {
            "home": pred.prob_home,
            "draw": pred.prob_draw,
            "away": pred.prob_away,
            "over": pred.prob_over_2_5,
            "under": pred.prob_under_2_5,
        }

        candidates = find_value_bets(
            model_probs=model_probs,
            odds_entries=entries,
            confidence=pred.confidence,
            min_edge_percent=settings.min_edge_percent,
        )

        for c in candidates:
            vb = ValueBet(
                fixture_id=fixture.id,
                market=c.market,
                outcome=c.outcome,
                model_prob=c.model_prob,
                best_odds=c.best_odds,
                bookmaker=c.bookmaker,
                edge_percent=c.edge_percent,
                confidence=c.confidence,
                created_at=now,
            )
            db.add(vb)
            value_bets_found += 1

    await db.commit()
    logger.info(
        "League %s: %d predictions saved, %d value bets found",
        league_id, predictions_saved, value_bets_found
    )
    return {
        "league_id": league_id,
        "matches_used": len(historical),
        "predictions_saved": predictions_saved,
        "value_bets_found": value_bets_found,
    }
