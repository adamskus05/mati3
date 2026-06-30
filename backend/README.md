# Football Odds Analytics — Backend

Statistical football odds modelling using Dixon-Coles modified Poisson.

## Quick start (local)

### 1. Start PostgreSQL

```bash
docker-compose up postgres -d
```

### 2. Configure API keys

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add:
#   API_FOOTBALL_KEY=your_rapidapi_key
#   ODDS_API_KEY=your_odds_api_key
```

Get free keys:
- **API-Football**: https://rapidapi.com/api-sports/api/api-football (100 req/day)
- **The Odds API**: https://the-odds-api.com (500 req/month)

### 3. Install and run

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### 4. Seed data

```bash
# Sync fixtures + odds for a league
curl -X POST http://localhost:8000/admin/sync/Premier%20League

# Run Dixon-Coles model and compute value bets
curl -X POST http://localhost:8000/admin/run-model/Premier%20League
```

## Run tests

```bash
cd backend
pytest tests/ -v
```

## Architecture

```
app/
├── stats/
│   ├── dixon_coles.py   # DC modified Poisson: fit + predict
│   ├── poisson.py       # Score matrix, 1X2/over-under probabilities
│   └── value_calculator.py  # EV calculation, value bet detection
├── services/
│   ├── api_football.py  # API-Football (RapidAPI) client
│   ├── odds_api.py      # The Odds API client
│   ├── sync.py          # Data pipeline: fixtures + odds → DB
│   └── model_runner.py  # Orchestrates model run per league
├── routers/
│   ├── fixtures.py      # GET /fixtures/upcoming
│   ├── value_bets.py    # GET /value-bets/, GET /value-bets/calibration
│   └── admin.py         # POST /admin/sync, /admin/run-model
└── models/
    ├── db_models.py     # SQLAlchemy ORM
    └── schemas.py       # Pydantic response schemas
```

## Model notes

- **Dixon-Coles** corrects standard Poisson's underestimation of 0-0/1-0/0-1/1-1 scores via the `tau` correction factor.
- **Time weighting**: older matches decay exponentially with a 90-day half-life.
- **Confidence**: LOW (<5 matches for either team), MEDIUM (5–9), HIGH (10+). LOW bets are not surfaced by default.
- **EV threshold**: only bets with ≥3% edge are flagged (configurable via `MIN_EDGE_PERCENT`).
