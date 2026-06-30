interface Props {
  home: number;
  draw: number;
  away: number;
  homeName: string;
  awayName: string;
}

export function ProbBar({ home, draw, away, homeName, awayName }: Props) {
  const fmt = (p: number) => `${(p * 100).toFixed(1)}%`;
  return (
    <div className="w-full">
      <div className="flex h-4 w-full overflow-hidden rounded-full text-[10px] font-mono">
        <div
          className="flex items-center justify-center bg-blue-600 text-white"
          style={{ width: `${home * 100}%` }}
          title={`${homeName} win: ${fmt(home)}`}
        >
          {home > 0.15 && fmt(home)}
        </div>
        <div
          className="flex items-center justify-center bg-slate-500 text-white"
          style={{ width: `${draw * 100}%` }}
          title={`Draw: ${fmt(draw)}`}
        >
          {draw > 0.1 && fmt(draw)}
        </div>
        <div
          className="flex items-center justify-center bg-orange-600 text-white"
          style={{ width: `${away * 100}%` }}
          title={`${awayName} win: ${fmt(away)}`}
        >
          {away > 0.15 && fmt(away)}
        </div>
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
        <span>{homeName}</span>
        <span>X</span>
        <span>{awayName}</span>
      </div>
    </div>
  );
}
