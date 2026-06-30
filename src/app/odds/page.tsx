import { oddsApi } from "@/lib/odds-api";
import { FixtureCard } from "@/components/odds/FixtureCard";
import { ValueBetRow } from "@/components/odds/ValueBetRow";

export const dynamic = "force-dynamic";

export default async function OddsDashboard() {
  const [fixtures, valueBets] = await Promise.allSettled([
    oddsApi.getUpcomingFixtures(7),
    oddsApi.getValueBets(3.0),
  ]);

  const fixtureList = fixtures.status === "fulfilled" ? fixtures.value : [];
  const betList = valueBets.status === "fulfilled" ? valueBets.value : [];

  const backendError =
    fixtures.status === "rejected" || valueBets.status === "rejected";

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Football Odds Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">
          Dixon-Coles statistical model · Value bets updated every 6 hours
        </p>
        <p className="text-xs text-amber-400/70 mt-2 border border-amber-900/40 bg-amber-950/30 rounded px-3 py-2 inline-block">
          This is an analysis tool, not financial advice. Betting carries risk of loss. Set limits before you play.
        </p>
      </div>

      {backendError && (
        <div className="rounded-lg border border-red-700 bg-red-950/40 p-4 mb-6 text-sm text-red-300">
          <strong>Backend offline.</strong> Make sure the FastAPI server is running on{" "}
          <code className="font-mono">localhost:8000</code>. Run{" "}
          <code className="font-mono">docker-compose up</code> to start.
        </div>
      )}

      {/* Value Bets section */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-lg font-semibold">Value Bets</h2>
          <span className="text-xs text-slate-500">Edge ≥ 3% · ranked by EV</span>
          {betList.length > 0 && (
            <span className="text-xs font-mono bg-emerald-900/40 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded">
              {betList.length} found
            </span>
          )}
        </div>

        {betList.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No value bets detected yet. Sync fixtures and run the model first.
          </p>
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
                {betList.map((bet) => (
                  <ValueBetRow key={bet.id} bet={bet} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Upcoming Fixtures */}
      <section>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-lg font-semibold">Upcoming Fixtures</h2>
          <span className="text-xs text-slate-500">Next 7 days · with model predictions</span>
        </div>

        {fixtureList.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No fixtures loaded. Trigger a sync from the admin panel or wait for the scheduled sync.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {fixtureList.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
