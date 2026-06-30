const BACKEND = process.env.NEXT_PUBLIC_ODDS_API_URL ?? "http://localhost:8000";

export interface Team {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface League {
  id: number;
  name: string;
  country: string | null;
  season: number;
}

export interface ModelOutput {
  prob_home: number | null;
  prob_draw: number | null;
  prob_away: number | null;
  prob_over_2_5: number | null;
  prob_under_2_5: number | null;
  expected_home_goals: number | null;
  expected_away_goals: number | null;
  home_matches_used: number | null;
  away_matches_used: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  computed_at: string | null;
}

export interface BestOdds {
  market: string;
  outcome: string;
  decimal_odds: number;
  bookmaker: string;
  implied_prob: number;
}

export interface Fixture {
  id: number;
  kickoff_utc: string;
  status: string;
  home_team: Team;
  away_team: Team;
  league: League;
  home_goals: number | null;
  away_goals: number | null;
  model_output: ModelOutput | null;
  best_odds: BestOdds[];
}

export interface ValueBet {
  id: number;
  fixture_id: number;
  market: string;
  outcome: string;
  model_prob: number;
  best_odds: number;
  bookmaker: string;
  edge_percent: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  created_at: string;
  result: string | null;
  fair_odds: number;
  home_team_name: string;
  away_team_name: string;
  kickoff_utc: string;
}

export interface CalibrationPoint {
  prob_bucket: string;
  predicted_prob: number;
  actual_win_rate: number;
  sample_size: number;
}

export interface CalibrationData {
  points: CalibrationPoint[];
  brier_score: number | null;
  total_bets_tracked: number;
}

async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BACKEND}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const oddsApi = {
  getUpcomingFixtures: (days = 7, leagueId?: number) =>
    apiFetch<Fixture[]>("/fixtures/upcoming", {
      days,
      ...(leagueId ? { league_id: leagueId } : {}),
    }),

  getValueBets: (minEdge = 3.0, confidence?: string) =>
    apiFetch<ValueBet[]>("/value-bets/", {
      min_edge: minEdge,
      ...(confidence ? { confidence } : {}),
    }),

  getCalibration: () => apiFetch<CalibrationData>("/value-bets/calibration"),

  getLeagues: () => apiFetch<Record<string, number>>("/admin/leagues"),

  triggerSync: async (leagueName: string) => {
    const res = await fetch(`${BACKEND}/admin/sync/${encodeURIComponent(leagueName)}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    return res.json();
  },

  runModel: async (leagueName: string) => {
    const res = await fetch(`${BACKEND}/admin/run-model/${encodeURIComponent(leagueName)}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Model run failed: ${res.status}`);
    return res.json();
  },
};
