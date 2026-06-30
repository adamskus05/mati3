"""
Admin endpoints: manual sync trigger, model re-run.
In production these would be protected — for local MVP they're open.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.schemas import SyncStatusOut
from app.services.api_football import LEAGUE_IDS, CURRENT_SEASON
from app.services.sync import sync_fixtures, sync_odds
from app.services.model_runner import run_league_model

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/sync/{league_name}", response_model=SyncStatusOut)
async def trigger_sync(
    league_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger data sync for a specific league."""
    if league_name not in LEAGUE_IDS:
        raise HTTPException(status_code=404, detail=f"Unknown league: {league_name}")

    fixtures_updated = await sync_fixtures(db, league_name)
    odds_updated = await sync_odds(db, league_name)

    return SyncStatusOut(
        message=f"Sync complete for {league_name}",
        fixtures_updated=fixtures_updated,
        odds_updated=odds_updated,
    )


@router.post("/run-model/{league_name}")
async def trigger_model(
    league_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Re-run Dixon-Coles model for a league and refresh value bets."""
    if league_name not in LEAGUE_IDS:
        raise HTTPException(status_code=404, detail=f"Unknown league: {league_name}")

    league_id = LEAGUE_IDS[league_name]
    result = await run_league_model(db, league_id, CURRENT_SEASON)
    return result


@router.get("/leagues")
async def list_leagues():
    """Return all configured league names and their API-Football IDs."""
    return LEAGUE_IDS
