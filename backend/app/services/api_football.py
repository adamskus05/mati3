"""
API-Football (RapidAPI) client.
Free tier: 100 requests/day — all responses are cached aggressively.

Endpoints used:
  GET /fixtures          — upcoming & recent matches
  GET /teams/statistics  — season stats per team
  GET /fixtures?live=all — live match data (future use)
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api-football-v1.p.rapidapi.com/v3"

# Supported league IDs (API-Football)
LEAGUE_IDS = {
    "Premier League": 39,
    "La Liga": 140,
    "Bundesliga": 78,
    "Ligue 1": 61,
    "Serie A": 135,
    "Champions League": 2,
    "Europa League": 3,
    "Allsvenskan": 113,
    "World Cup": 1,
    "European Championship": 4,
}

CURRENT_SEASON = 2024


class APIFootballClient:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    def _headers(self) -> dict:
        return {
            "X-RapidAPI-Key": settings.api_football_key,
            "X-RapidAPI-Host": settings.api_football_host,
        }

    async def _get(self, endpoint: str, params: dict) -> dict[str, Any]:
        if not settings.api_football_key:
            raise RuntimeError("API_FOOTBALL_KEY is not configured.")

        if self._client is None:
            self._client = httpx.AsyncClient(timeout=15.0)

        url = f"{BASE_URL}/{endpoint}"
        resp = await self._client.get(url, headers=self._headers(), params=params)
        resp.raise_for_status()
        data = resp.json()

        if data.get("errors"):
            raise RuntimeError(f"API-Football error: {data['errors']}")

        return data

    async def get_upcoming_fixtures(self, league_id: int, season: int, days_ahead: int = 14) -> list[dict]:
        """Fetch upcoming fixtures for next N days."""
        from_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        to_date = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

        data = await self._get("fixtures", {
            "league": league_id,
            "season": season,
            "from": from_date,
            "to": to_date,
            "timezone": "UTC",
        })
        return data.get("response", [])

    async def get_recent_fixtures(self, league_id: int, season: int, days_back: int = 180) -> list[dict]:
        """Fetch completed fixtures for model training data."""
        from_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")
        to_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        data = await self._get("fixtures", {
            "league": league_id,
            "season": season,
            "from": from_date,
            "to": to_date,
            "status": "FT",
            "timezone": "UTC",
        })
        return data.get("response", [])

    async def get_fixture_detail(self, fixture_id: int) -> dict:
        """Full fixture detail including xG if available."""
        data = await self._get("fixtures", {"id": fixture_id})
        results = data.get("response", [])
        return results[0] if results else {}

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None


def parse_fixture(raw: dict) -> dict:
    """
    Extract relevant fields from API-Football fixture response.
    Returns a normalised dict ready for DB insertion.
    """
    fix = raw.get("fixture", {})
    teams = raw.get("teams", {})
    goals = raw.get("goals", {})
    score = raw.get("score", {})

    status_short = fix.get("status", {}).get("short", "NS")

    # xG only available on paid plan — handle gracefully
    xg = raw.get("statistics", [])
    home_xg = away_xg = None
    for stat_block in xg:
        for stat in stat_block.get("statistics", []):
            if stat.get("type") == "expected_goals":
                val = stat.get("value")
                if stat_block.get("team", {}).get("id") == teams.get("home", {}).get("id"):
                    home_xg = float(val) if val else None
                else:
                    away_xg = float(val) if val else None

    kickoff_str = fix.get("date")
    kickoff = None
    if kickoff_str:
        kickoff = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))

    return {
        "id": fix.get("id"),
        "league_id": raw.get("league", {}).get("id"),
        "home_team_id": teams.get("home", {}).get("id"),
        "away_team_id": teams.get("away", {}).get("id"),
        "home_team_name": teams.get("home", {}).get("name"),
        "away_team_name": teams.get("away", {}).get("name"),
        "home_team_logo": teams.get("home", {}).get("logo"),
        "away_team_logo": teams.get("away", {}).get("logo"),
        "league_name": raw.get("league", {}).get("name"),
        "league_country": raw.get("league", {}).get("country"),
        "season": raw.get("league", {}).get("season"),
        "kickoff_utc": kickoff,
        "status": status_short,
        "home_goals": goals.get("home"),
        "away_goals": goals.get("away"),
        "home_xg": home_xg,
        "away_xg": away_xg,
        "referee": fix.get("referee"),
    }


api_football = APIFootballClient()
