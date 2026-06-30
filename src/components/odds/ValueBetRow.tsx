"use client";

import type { ValueBet } from "@/lib/odds-api";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { EdgeBadge } from "./EdgeBadge";

interface Props {
  bet: ValueBet;
}

const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  "over_under_2.5": "O/U 2.5",
};

const OUTCOME_LABELS: Record<string, string> = {
  home: "Home win",
  draw: "Draw",
  away: "Away win",
  over: "Over 2.5",
  under: "Under 2.5",
};

function kickoffLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ValueBetRow({ bet }: Props) {
  const marketLabel = MARKET_LABELS[bet.market] ?? bet.market;
  const outcomeLabel = OUTCOME_LABELS[bet.outcome] ?? bet.outcome;

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
      <td className="py-3 px-3">
        <p className="text-sm font-medium text-slate-100">
          {bet.home_team_name} <span className="text-slate-500">vs</span> {bet.away_team_name}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{kickoffLabel(bet.kickoff_utc)}</p>
      </td>
      <td className="py-3 px-3 text-xs text-slate-400">
        {marketLabel} · <span className="text-slate-200">{outcomeLabel}</span>
      </td>
      <td className="py-3 px-3 text-right font-mono text-sm">
        <span className="text-slate-200">{(bet.model_prob * 100).toFixed(1)}%</span>
        <span className="text-slate-600 mx-1">→</span>
        <span className="text-slate-400">{bet.fair_odds.toFixed(2)}</span>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="font-mono text-sm text-emerald-300 font-semibold">{bet.best_odds.toFixed(2)}</span>
        <p className="text-xs text-slate-500">{bet.bookmaker}</p>
      </td>
      <td className="py-3 px-3 text-right">
        <EdgeBadge edge={bet.edge_percent} />
      </td>
      <td className="py-3 px-3 text-right">
        <ConfidenceBadge confidence={bet.confidence} />
      </td>
    </tr>
  );
}
