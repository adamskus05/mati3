import { oddsApi } from "@/lib/odds-api";
import { ValueBetRow } from "@/components/odds/ValueBetRow";

export const dynamic = "force-dynamic";

export default async function ValueBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ min_edge?: string; confidence?: string }>;
}) {
  const sp = await searchParams;
  const minEdge = parseFloat(sp.min_edge ?? "3");
  const confidence = sp.confidence;

  const [betsResult, calibResult] = await Promise.allSettled([
    oddsApi.getValueBets(minEdge, confidence),
    oddsApi.getCalibration(),
  ]);

  const bets = betsResult.status === "fulfilled" ? betsResult.value : [];
  const calib = calibResult.status === "fulfilled" ? calibResult.value : null;

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Value Bets</h1>
      <p className="text-sm text-slate-400 mb-6">
        Ranked by expected value (edge). Only bets where model probability exceeds bookmaker implied probability by ≥{minEdge}%.
      </p>

      {/* Calibration summary */}
      {calib && calib.total_bets_tracked > 0 && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Model Calibration</h2>
          <div className="flex flex-wrap gap-6 text-xs font-mono">
            <div>
              <span className="text-slate-500">Brier score </span>
              <span className={calib.brier_score != null && calib.brier_score < 0.2 ? "text-emerald-400" : "text-amber-400"}>
                {calib.brier_score?.toFixed(4) ?? "—"}
              </span>
              <span className="text-slate-600 ml-1">(lower = better; random=0.25)</span>
            </div>
            <div>
              <span className="text-slate-500">Tracked bets </span>
              <span className="text-slate-200">{calib.total_bets_tracked}</span>
            </div>
          </div>
          {calib.points.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="text-xs font-mono w-full">
                <thead>
                  <tr className="text-slate-600 border-b border-slate-700">
                    <th className="text-left py-1">Prob bucket</th>
                    <th className="text-right py-1">Predicted</th>
                    <th className="text-right py-1">Actual win rate</th>
                    <th className="text-right py-1">n</th>
                  </tr>
                </thead>
                <tbody>
                  {calib.points.map((pt) => {
                    const diff = pt.actual_win_rate - pt.predicted_prob;
                    return (
                      <tr key={pt.prob_bucket} className="border-b border-slate-700/30">
                        <td className="py-1 text-slate-400">{pt.prob_bucket}</td>
                        <td className="py-1 text-right text-slate-400">{(pt.predicted_prob * 100).toFixed(0)}%</td>
                        <td className={`py-1 text-right ${Math.abs(diff) > 0.1 ? "text-amber-400" : "text-emerald-400"}`}>
                          {(pt.actual_win_rate * 100).toFixed(1)}%
                        </td>
                        <td className="py-1 text-right text-slate-600">{pt.sample_size}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <form method="GET" className="flex flex-wrap gap-3 mb-5 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-400">Min edge %</span>
          <input
            name="min_edge"
            type="number"
            step="0.5"
            min="0"
            defaultValue={minEdge}
            className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100 font-mono"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-400">Confidence</span>
          <select
            name="confidence"
            defaultValue={confidence ?? ""}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          >
            <option value="">All</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1 text-slate-200 transition-colors"
        >
          Filter
        </button>
      </form>

      {bets.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No value bets found with current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full">
            <thead className="bg-slate-800 text-xs text-slate-500 border-b border-slate-700">
              <tr>
                <th className="text-left py-2 px-3">Match</th>
                <th className="text-left py-2 px-3">Market</th>
                <th className="text-right py-2 px-3">Model prob → Fair odds</th>
                <th className="text-right py-2 px-3">Best odds</th>
                <th className="text-right py-2 px-3">Edge (EV)</th>
                <th className="text-right py-2 px-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => (
                <ValueBetRow key={bet.id} bet={bet} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 text-xs text-slate-600 italic">
        This tool does not guarantee profit. All estimates carry uncertainty. Bet responsibly.
      </p>
    </main>
  );
}
