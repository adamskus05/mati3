"""
The Odds API client — aggregates bookmaker odds from ~40 bookmakers.
Free tier: 500 requests/month. We fetch sparingly and cache per fixture.

Markets fetched:
  h2h       — 1X2 (home/draw/away)
  totals    — over/under goals (2.5 line)
"""
import logging
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# The Odds API sport key for football
SPORT_KEY = "soccer"

# Map our league names to The Odds API league keys
LEAGUE_SPORT_KEYS = {
    "Premier League": "soccer_england_league1",
    "La Liga": "soccer_spain_la_liga",
    "Bundesliga": "soccer_germany_bundesliga",
    "Ligue 1": "soccer_france_ligue_one",
    "Serie A": "soccer_italy_serie_a",
    "Champions League": "soccer_uefa_champs_league",
    "Europa League": "soccer_uefa_europa_league",
    "Allsvenskan": "soccer_sweden_allsvenskan",
}

BOOKMAKERS_PREFERENCE = [
    "pinnacle", "betfair_ex_eu", "unibet_eu", "bet365", "bwin", "williamhill"
]


class OddsAPIClient:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    async def _get(self, path: str, params: dict) -> Any:
        if not settings.odds_api_key:
            raise RuntimeError("ODDS_API_KEY is not configured.")

        if self._client is None:
            self._client = httpx.AsyncClient(timeout=15.0)

        params["apiKey"] = settings.odds_api_key
        url = f"{settings.odds_api_base_url}/{path}"
        resp = await self._client.get(url, params=params)

        remaining = resp.headers.get("x-requests-remaining", "?")
        logger.info("The Odds API: %s requests remaining this month", remaining)

        resp.raise_for_status()
        return resp.json()

    async def get_odds(self, sport_key: str, regions: str = "eu") -> list[dict]:
        """Fetch current odds for all upcoming events in a sport/league."""
        return await self._get(f"sports/{sport_key}/odds", {
            "regions": regions,
            "markets": "h2h,totals",
            "oddsFormat": "decimal",
        })

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None


def parse_h2h_odds(event: dict) -> list[dict]:
    """
    Extract 1X2 odds from an Odds API event.
    Returns list of {bookmaker, market, outcome, decimal_odds}.
    """
    results = []
    for bm in event.get("bookmakers", []):
        bm_key = bm.get("key", "")
        for market in bm.get("markets", []):
            if market.get("key") != "h2h":
                continue
            for outcome in market.get("outcomes", []):
                name = outcome.get("name", "")
                # Map to home/draw/away relative to the event
                home = event.get("home_team", "")
                away = event.get("away_team", "")
                if name == home:
                    label = "home"
                elif name == away:
                    label = "away"
                elif name.lower() == "draw":
                    label = "draw"
                else:
                    continue
                results.append({
                    "bookmaker": bm_key,
                    "market": "1x2",
                    "outcome": label,
                    "decimal_odds": float(outcome.get("price", 0)),
                })
    return results


def parse_totals_odds(event: dict, line: float = 2.5) -> list[dict]:
    """
    Extract over/under 2.5 goals odds.
    The Odds API may have multiple lines; we pick the closest to 2.5.
    """
    results = []
    for bm in event.get("bookmakers", []):
        bm_key = bm.get("key", "")
        for market in bm.get("markets", []):
            if market.get("key") != "totals":
                continue
            # Find outcomes closest to desired line
            for outcome in market.get("outcomes", []):
                point = outcome.get("point")
                if point is None or abs(point - line) > 0.01:
                    continue
                direction = outcome.get("name", "").lower()
                if direction in ("over", "under"):
                    results.append({
                        "bookmaker": bm_key,
                        "market": f"over_under_{line}",
                        "outcome": direction,
                        "decimal_odds": float(outcome.get("price", 0)),
                    })
    return results


odds_api = OddsAPIClient()
