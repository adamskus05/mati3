interface Props {
  edge: number;
}

export function EdgeBadge({ edge }: Props) {
  const color =
    edge >= 10 ? "text-emerald-300 font-bold" :
    edge >= 5  ? "text-emerald-400" :
                 "text-slate-300";
  return (
    <span className={`font-mono text-sm ${color}`}>
      +{edge.toFixed(1)}% EV
    </span>
  );
}
