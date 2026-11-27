import type { CSSProperties } from "react";

/**
 * The AI assistant's mark: an original four-leaf clover. Black on white; in the dark theme near-black
 * leaves with a thin lime edge, so it stays visible. It turns very slowly while the assistant is
 * open, and its leaves breathe in turn while it is thinking. A device set to reduce motion sees it still.
 */

// One heart-shaped leaf pointing up from the centre, as offsets: [control 1, control 2, end] per curve.
const LEAF: [number, number][][] = [
  [[-2, -1.5], [-3.4, -3.4], [-2.6, -5.1]],
  [[-1.9, -6.5], [-0.4, -6.2], [0, -4.8]],
  [[0.4, -6.2], [1.9, -6.5], [2.6, -5.1]],
  [[3.4, -3.4], [2, -1.5], [0, 0]]
];
const turn = ([x, y]: [number, number], quarter: number): [number, number] => {
  for (let i = 0; i < quarter; i++) [x, y] = [-y, x];
  return [x, y];
};
const fmt = (n: number) => Number(n.toFixed(2));

/** The path of leaf number `quarter` (0 up, 1 right, 2 down, 3 left) around (cx, cy), scaled. */
export function cloverLeaf(quarter: number, cx: number, cy: number, scale: number): string {
  const point = (offset: [number, number]) => { const [x, y] = turn(offset, quarter); return `${fmt(cx + x * scale)} ${fmt(cy + y * scale)}`; };
  return `M${fmt(cx)} ${fmt(cy)} ` + LEAF.map(curve => `C${curve.map(point).join(" ")}`).join(" ") + "Z";
}

export function AiClover({ size, live = false, thinking = false, className = "" }: { size: number; live?: boolean; thinking?: boolean; className?: string }) {
  return <svg className={`ai-clover${live ? " is-live" : ""}${thinking ? " is-thinking" : ""} ${className}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
    <path className="clover-stem" d="M57 55 Q 66 72 79 92" />
    <g className="clover-turn">
      {[0, 1, 2, 3].map(quarter => <path key={quarter} className="clover-leaf" style={{ "--k": quarter } as CSSProperties} d={cloverLeaf(quarter, 50, 46, 6.2)} />)}
      <circle className="clover-heart" cx="50" cy="46" r="2.6" />
    </g>
  </svg>;
}
