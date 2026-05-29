"use client";

interface Point {
  timestamp: number;
  cumulativePnl: number;
}

interface Props {
  data: Point[];
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return `${n < 0 ? "-$" : "$"}${abs.toFixed(0)}`;
}

export default function PnlChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
        Not enough sell history to draw chart
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const PAD_L = 52;
  const PAD_R = 12;
  const PAD_T = 10;
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const minTs = data[0].timestamp;
  const maxTs = data[data.length - 1].timestamp;
  const tsRange = maxTs - minTs || 1;

  const values = data.map((d) => d.cumulativePnl);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const valRange = maxVal - minVal || 1;

  function px(ts: number): number {
    return PAD_L + ((ts - minTs) / tsRange) * plotW;
  }
  function py(val: number): number {
    return PAD_T + plotH - ((val - minVal) / valRange) * plotH;
  }

  const points = data.map((d) => `${px(d.timestamp).toFixed(1)},${py(d.cumulativePnl).toFixed(1)}`).join(" ");
  const finalPnl = data[data.length - 1].cumulativePnl;
  const lineColor = finalPnl >= 0 ? "#34d399" : "#f87171";
  const fillColor = finalPnl >= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)";
  const zeroY = py(0);

  // Build fill polygon: top follows polyline, bottom goes along zero (or bottom edge)
  const clampedZeroY = Math.min(PAD_T + plotH, Math.max(PAD_T, zeroY));
  const firstPx = px(data[0].timestamp).toFixed(1);
  const lastPx = px(data[data.length - 1].timestamp).toFixed(1);
  const fillPoints = `${firstPx},${clampedZeroY} ${points} ${lastPx},${clampedZeroY}`;

  // Y axis ticks (3)
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal];

  // X axis ticks (first + last, plus middle if enough space)
  const xTicks: { ts: number }[] = [
    { ts: minTs },
    { ts: maxTs },
  ];
  if (data.length > 4) xTicks.splice(1, 0, { ts: minTs + tsRange / 2 });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ overflow: "visible" }}
    >
      {/* Fill area */}
      <polygon points={fillPoints} fill={fillColor} />

      {/* Zero line */}
      <line
        x1={PAD_L} y1={clampedZeroY}
        x2={W - PAD_R} y2={clampedZeroY}
        stroke="rgba(255,255,255,0.1)" strokeWidth="1"
        strokeDasharray="4 4"
      />

      {/* PNL line */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Last point dot */}
      <circle
        cx={px(data[data.length - 1].timestamp)}
        cy={py(finalPnl)}
        r="3"
        fill={lineColor}
      />

      {/* Y axis labels */}
      {yTicks.map((val, i) => (
        <text
          key={i}
          x={PAD_L - 4}
          y={py(val) + 4}
          textAnchor="end"
          fontSize="9"
          fill="#64748b"
        >
          {fmtUsd(val)}
        </text>
      ))}

      {/* X axis labels */}
      {xTicks.map((t, i) => (
        <text
          key={i}
          x={px(t.ts)}
          y={H - 4}
          textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
          fontSize="9"
          fill="#64748b"
        >
          {fmtDate(t.ts)}
        </text>
      ))}
    </svg>
  );
}
