"use client";

import type { Fixture } from "@/lib/odds-api";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ProbBar } from "./ProbBar";

interface Props {
  fixture: Fixture;
}

const fmt = (p: number | null) => (p != null ? `${(p * 100).toFixed(1)}%` : "—");
const fmtOdds = (o: number) => o.toFixed(2);

function kickoffLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("sv-SE", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function FixtureCard({ fixture }: Props) {
  const mo = fixture.model_output;

  const bestH2H = (outcome: string) =>
    fixture.best_odds.find((o) => o.market === "1x2" && o.outcome === outcome);

  const bHome = bestH2H("home");
  const bDraw = bestH2H("draw");
  const bAway = bestH2H("away");

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">{fixture.league.name} · {fixture.league.country}</p>
          <p className="font-semibold text-slate-100 mt-0.5">
            {fixture.home_team.name} <span className="text-slate-400">vs</span> {fixture.away_team.name}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">{kickoffLabel(fixture.kickoff_utc)}</p>
          {mo && (
            <div className="mt-1">
              <ConfidenceBadge
                confidence={mo.confidence}
                matchesUsed={Math.min(mo.home_matches_used ?? 0, mo.away_matches_used ?? 0)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Probability bar */}
      {mo?.prob_home != null && mo.prob_draw != null && mo.prob_away != null ? (
        <ProbBar
          home={mo.prob_home}
          draw={mo.prob_draw}
          away={mo.prob_away}
          homeName={fixture.home_team.name}
          awayName={fixture.away_team.name}
        />
      ) : (
        <p className="text-xs text-slate-500 italic">No model prediction — insufficient data</p>
      )}

      {/* Odds comparison table */}
      {mo && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left py-1">Outcome</th>
                <th className="text-right py-1">Model prob</th>
                <th className="text-right py-1">Fair odds</th>
                <th className="text-right py-1">Best odds</th>
                <th className="text-right py-1">Book</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {[
                { label: "Home win", prob: mo.prob_home, bet: bHome },
                { label: "Draw", prob: mo.prob_draw, bet: bDraw },
                { label: "Away win", prob: mo.prob_away, bet: bAway },
              ].map(({ label, prob, bet }) => {
                const fairOdds = prob ? 1 / prob : null;
                const hasValue = fairOdds && bet && bet.decimal_odds > fairOdds * 1.03;
                return (
                  <tr key={label} className={hasValue ? "bg-emerald-900/20" : ""}>
                    <td className="py-1 text-slate-300">{label}</td>
                    <td className="py-1 text-right text-slate-300">{fmt(prob)}</td>
                    <td className="py-1 text-right text-slate-400">
                      {fairOdds ? fmtOdds(fairOdds) : "—"}
                    </td>
                    <td className={`py-1 text-right ${hasValue ? "text-emerald-400 font-bold" : "text-slate-300"}`}>
                      {bet ? fmtOdds(bet.decimal_odds) : "—"}
                    </td>
                    <td className="py-1 text-right text-slate-500">{bet?.bookmaker ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Expected goals */}
      {mo?.expected_home_goals != null && (
        <p className="text-xs text-slate-500">
          xG: {mo.expected_home_goals.toFixed(2)} – {mo.expected_away_goals?.toFixed(2) ?? "?"}
          {" · "}
          O/U 2.5: {fmt(mo.prob_over_2_5)} / {fmt(mo.prob_under_2_5)}
        </p>
      )}
    </div>
  );
}
