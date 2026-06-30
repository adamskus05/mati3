from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://odds:odds@localhost:5432/oddsdb"
    database_url_sync: str = "postgresql://odds:odds@localhost:5432/oddsdb"

    # API-Football (RapidAPI) — free tier: 100 req/day
    api_football_key: str = ""
    api_football_host: str = "api-football-v1.p.rapidapi.com"

    # The Odds API — free tier: 500 req/month
    odds_api_key: str = ""
    odds_api_base_url: str = "https://api.the-odds-api.com/v4"

    # EV threshold for flagging value bets (3% minimum edge)
    min_edge_percent: float = 3.0

    # Minimum matches required before Dixon-Coles estimates are trusted
    min_matches_for_estimate: int = 5

    # Exponential decay half-life for time-weighting (days)
    decay_half_life_days: float = 90.0

    # Dixon-Coles rho correction cap
    dc_rho_bound: float = 0.1

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    model_config = {"env_file": ".env"}


settings = Settings()
