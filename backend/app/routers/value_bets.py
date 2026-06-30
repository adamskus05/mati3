from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.db_models import ValueBet, Fixture
from app.models.schemas import ValueBetOut, CalibrationOut, CalibrationPoint
from app.stats.value_calculator import calibration_brier_score

router = APIRouter(prefix="/value-bets", tags=["value-bets"])


@router.get("/", response_model=list[ValueBetOut])
async def get_value_bets(
    min_edge: float = Query(default=3.0, ge=0.0),
    confidence: Optional[str] = Query(default=None, pattern="^(LOW|MEDIUM|HIGH)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Return current value bets sorted by edge descending.
    Only shows bets on upcoming, unsettled fixtures.
    """
    now = datetime.now(timezone.utc)

    query = (
        select(ValueBet)
        .join(ValueBet.fixture)
        .options(
            selectinload(ValueBet.fixture).selectinload(Fixture.home_team),
            selectinload(ValueBet.fixture).selectinload(Fixture.away_team),
        )
        .where(
            and_(
                ValueBet.edge_percent >= min_edge,
                ValueBet.result.is_(None),
                Fixture.kickoff_utc > now,
                Fixture.status == "NS",
            )
        )
        .order_by(ValueBet.edge_percent.desc())
    )

    if confidence:
        query = query.where(ValueBet.confidence == confidence)

    result = await db.execute(query)
    bets = result.scalars().all()

    return [
        ValueBetOut(
            id=vb.id,
            fixture_id=vb.fixture_id,
            market=vb.market,
            outcome=vb.outcome,
            model_prob=vb.model_prob,
            best_odds=vb.best_odds,
            bookmaker=vb.bookmaker,
            edge_percent=vb.edge_percent,
            confidence=vb.confidence,
            created_at=vb.created_at,
            result=vb.result,
            fair_odds=round(1.0 / vb.model_prob, 2) if vb.model_prob > 0 else 0.0,
            home_team_name=vb.fixture.home_team.name if vb.fixture.home_team else "",
            away_team_name=vb.fixture.away_team.name if vb.fixture.away_team else "",
            kickoff_utc=vb.fixture.kickoff_utc,
        )
        for vb in bets
    ]


@router.get("/calibration", response_model=CalibrationOut)
async def get_calibration(db: AsyncSession = Depends(get_db)):
    """
    Return calibration stats for settled value bets.
    Buckets predicted probabilities and compares to actual win rates.
    Used to evaluate model accuracy over time.
    """
    result = await db.execute(
        select(ValueBet).where(ValueBet.result.in_(["WON", "LOST"]))
    )
    settled = result.scalars().all()

    if not settled:
        return CalibrationOut(points=[], brier_score=None, total_bets_tracked=0)

    # Bucket into 10% intervals
    buckets: dict[str, list[int]] = {}
    brier_pairs = []

    for vb in settled:
        p = vb.model_prob
        bucket_low = int(p * 10) * 10
        bucket_high = bucket_low + 10
        label = f"{bucket_low}-{bucket_high}%"
        buckets.setdefault(label, []).append(1 if vb.result == "WON" else 0)
        brier_pairs.append((p, 1 if vb.result == "WON" else 0))

    points = []
    for label, outcomes in sorted(buckets.items()):
        low = int(label.split("-")[0]) / 100
        high = int(label.split("-")[1].rstrip("%")) / 100
        mid = (low + high) / 2
        points.append(CalibrationPoint(
            prob_bucket=label,
            predicted_prob=round(mid, 2),
            actual_win_rate=round(sum(outcomes) / len(outcomes), 3),
            sample_size=len(outcomes),
        ))

    return CalibrationOut(
        points=points,
        brier_score=round(calibration_brier_score(brier_pairs), 4),
        total_bets_tracked=len(settled),
    )
