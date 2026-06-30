interface Props {
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  matchesUsed?: number | null;
}

const styles = {
  HIGH: "bg-emerald-900/40 text-emerald-300 border border-emerald-700",
  MEDIUM: "bg-amber-900/40 text-amber-300 border border-amber-700",
  LOW: "bg-red-900/40 text-red-400 border border-red-700",
};

export function ConfidenceBadge({ confidence, matchesUsed }: Props) {
  if (!confidence) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono font-medium ${styles[confidence]}`}
      title={matchesUsed ? `Based on ${matchesUsed} matches` : undefined}
    >
      {confidence}
      {matchesUsed !== undefined && matchesUsed !== null && (
        <span className="opacity-60">n={matchesUsed}</span>
      )}
    </span>
  );
}
