"""
Data sync service: pulls from API-Football and The Odds API into the DB.
Designed to be called by the scheduler (e.g. every 6 hours for upcoming fixtures).
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import League, Team, Fixture, BookmakerOdds
from app.services.api_football import api_football, parse_fixture, LEAGUE_IDS, CURRENT_SEASON
from app.services.odds_api import odds_api, parse_h2h_odds, parse_totals_odds, LEAGUE_SPORT_KEYS

logger = logging.getLogger(__name__)


async def sync_fixtures(db: AsyncSession, league_name: str) -> int:
    """
    Pull upcoming + recent completed fixtures for a league and upsert into DB.
    Returns count of fixtures processed.
    """
    league_id = LEAGUE_IDS.get(league_name)
    if not league_id:
        logger.warning("Unknown league: %s", league_name)
        return 0

    # Ensure League row exists
    existing_league = await db.get(League, league_id)
    if not existing_league:
        existing_league = League(id=league_id, name=league_name, season=CURRENT_SEASON)
        db.add(existing_league)

    count = 0
    for fetch_fn, kwargs in [
        (api_football.get_upcoming_fixtures, {"league_id": league_id, "season": CURRENT_SEASON}),
        (api_football.get_recent_fixtures, {"league_id": league_id, "season": CURRENT_SEASON}),
    ]:
        try:
            raw_fixtures = await fetch_fn(**kwargs)
        except Exception as e:
            logger.error("Failed to fetch fixtures for %s: %s", league_name, e)
            continue

        for raw in raw_fixtures:
            parsed = parse_fixture(raw)
            if not parsed.get("id") or not parsed.get("kickoff_utc"):
                continue

            # Upsert Team rows
            for side in ("home", "away"):
                team_id = parsed[f"{side}_team_id"]
                if not await db.get(Team, team_id):
                    db.add(Team(
                        id=team_id,
                        name=parsed[f"{side}_team_name"],
                        league_id=league_id,
                        logo_url=parsed[f"{side}_team_logo"],
                    ))

            # Upsert Fixture
            fixture = await db.get(Fixture, parsed["id"])
            if fixture is None:
                fixture = Fixture(id=parsed["id"])
                db.add(fixture)

            fixture.league_id = league_id
            fixture.home_team_id = parsed["home_team_id"]
            fixture.away_team_id = parsed["away_team_id"]
            fixture.kickoff_utc = parsed["kickoff_utc"]
            fixture.status = parsed["status"]
            fixture.home_goals = parsed.get("home_goals")
            fixture.away_goals = parsed.get("away_goals")
            fixture.home_xg = parsed.get("home_xg")
            fixture.away_xg = parsed.get("away_xg")
            fixture.referee = parsed.get("referee")
            count += 1

    await db.commit()
    logger.info("Synced %d fixtures for %s", count, league_name)
    return count


async def sync_odds(db: AsyncSession, league_name: str) -> int:
    """
    Fetch bookmaker odds for all upcoming fixtures in a league and upsert into DB.
    Returns count of odds entries saved.
    """
    sport_key = LEAGUE_SPORT_KEYS.get(league_name)
    if not sport_key:
        logger.info("No odds sport key configured for %s — skipping", league_name)
        return 0

    try:
        events = await odds_api.get_odds(sport_key)
    except Exception as e:
        logger.error("Odds API fetch failed for %s: %s", league_name, e)
        return 0

    now = datetime.now(timezone.utc)
    count = 0

    for event in events:
        # Match by commence_time + teams to a DB fixture (rough match)
        home_name = event.get("home_team", "")
        away_name = event.get("away_team", "")

        result = await db.execute(
            select(Fixture).join(Fixture.home_team).join(Fixture.away_team).where(
                Fixture.status == "NS"
            )
        )
        # Simple name matching — production would use fuzzy match
        fixtures = result.scalars().all()
        matched_fixture = None
        for f in fixtures:
            if (
                f.home_team and home_name.lower() in f.home_team.name.lower()
                and f.away_team and away_name.lower() in f.away_team.name.lower()
            ):
                matched_fixture = f
                break

        if not matched_fixture:
            continue

        all_odds = parse_h2h_odds(event) + parse_totals_odds(event)
        for o in all_odds:
            entry = BookmakerOdds(
                fixture_id=matched_fixture.id,
                bookmaker=o["bookmaker"],
                market=o["market"],
                outcome=o["outcome"],
                decimal_odds=o["decimal_odds"],
                fetched_at=now,
            )
            db.add(entry)
            count += 1

    await db.commit()
    return count


async def sync_all_leagues(db: AsyncSession) -> dict:
    """Run fixture + odds sync for all configured leagues."""
    results = {}
    for league_name in LEAGUE_IDS:
        fx = await sync_fixtures(db, league_name)
        odds = await sync_odds(db, league_name)
        results[league_name] = {"fixtures": fx, "odds": odds}
    return results
