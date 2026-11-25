"use client";

import { useEffect, useRef } from "react";

/**
 * The AI assistant's mark: a small wireframe globe with a slightly broken, jagged surface,
 * sparks flickering inside and faint halo rings, slowly turning (after the reel the owner
 * shared). Drawn on a canvas: a few dozen points and lines, no 3D library.
 *
 * - `live` globes turn; others draw one still frame (chat avatars), so a long chat stays light.
 * - `thinking` spins faster and the sparks get busier.
 * - Stops when off screen, in a hidden tab, with "reduce motion", or when the site's motion
 *   switch is off. Pale mint lines on dark, black ink on white.
 */
type Props = { size: number; live?: boolean; thinking?: boolean; className?: string };

type Shape = { points: [number, number, number][]; edges: [number, number][]; sparks: { p: [number, number, number]; hue: number; phase: number }[] };
const shapes = new Map<number, Shape>();

/** A seeded random number generator, so every globe of a size looks the same on every visit. */
function seeded(seed: number) {
  let value = seed;
  return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
}

function shapeFor(count: number): Shape {
  const cached = shapes.get(count);
  if (cached) return cached;
  const random = seeded(count * 7919 + 17);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const angle = golden * i;
    const jag = 0.9 + random() * 0.18; // the broken, jagged surface
    points.push([Math.cos(angle) * ring * jag, y * jag, Math.sin(angle) * ring * jag]);
  }
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  points.forEach((a, i) => {
    points.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2] as const)
      .filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3)
      .forEach(([j]) => { const id = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(id)) { seen.add(id); edges.push([i, j]); } });
  });
  const sparks = Array.from({ length: Math.max(5, Math.round(count / 7)) }, () => {
    const r = 0.15 + random() * 0.55, u = random() * Math.PI * 2, v = Math.acos(2 * random() - 1);
    return { p: [r * Math.sin(v) * Math.cos(u), r * Math.cos(v), r * Math.sin(v) * Math.sin(u)] as [number, number, number], hue: random(), phase: random() * Math.PI * 2 };
  });
  const shape = { points, edges, sparks };
  shapes.set(count, shape);
  return shape;
}

const light = () => document.documentElement.dataset.theme === "light";
const motionOff = () => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  try { return localStorage.getItem("careerforge-motion") === "off"; } catch { return false; }
};

export function AiGlobe({ size, live = false, thinking = false, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const speed = useRef(thinking ? 1 : 0);
  useEffect(() => { speed.current = thinking ? 1 : 0; }, [thinking]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    element.width = Math.round(size * ratio);
    element.height = Math.round(size * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const shape = shapeFor(size >= 80 ? 110 : size >= 40 ? 54 : 30);
    const centre = size / 2, radius = size * 0.34;
    let angle = 0.6, frame = 0, last = 0, visible = true, busy = 0;

    const draw = (time: number) => {
      const isLight = light();
      const line = isLight ? "10,10,10" : "214,236,200";
      const tones = isLight ? ["196,138,18", "34,34,34", "120,90,200"] : ["255,210,122", "198,228,158", "184,166,255"];
      context.clearRect(0, 0, size, size);
      const tilt = 0.38 + Math.sin(time / 4000) * 0.06;
      const cosA = Math.cos(angle), sinA = Math.sin(angle), cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const project = ([x, y, z]: [number, number, number]) => {
        const x1 = x * cosA + z * sinA, z1 = -x * sinA + z * cosA;
        const y1 = y * cosT - z1 * sinT, z2 = y * sinT + z1 * cosT;
        return [centre + x1 * radius, centre + y1 * radius, z2] as const;
      };
      // Halo rings around the globe.
      context.lineWidth = Math.max(0.6, size / 160);
      for (const [scale, alpha, turn] of [[1.32, 0.16, 0.5], [1.5, 0.09, -0.35]] as const) {
        context.strokeStyle = `rgba(${line},${alpha})`;
        context.beginPath();
        context.ellipse(centre, centre, radius * scale, radius * scale * 0.34, turn + Math.sin(time / 6000) * 0.08, 0, Math.PI * 2);
        context.stroke();
      }
      const placed = shape.points.map(project);
      // The mesh: lines at the back are thinner and fainter.
      for (const [a, b] of shape.edges) {
        const p = placed[a], q = placed[b];
        const depth = (p[2] + q[2]) / 2;
        context.strokeStyle = `rgba(${line},${(0.16 + (depth + 1) * 0.3).toFixed(3)})`;
        context.lineWidth = Math.max(0.5, size / 150) * (0.6 + (depth + 1) * 0.35);
        context.beginPath(); context.moveTo(p[0], p[1]); context.lineTo(q[0], q[1]); context.stroke();
      }
      // Sparks inside: warm gold, green and lilac, flickering.
      for (const spark of shape.sparks) {
        const [x, y, z] = project(spark.p);
        const flicker = 0.45 + 0.55 * Math.abs(Math.sin(time / (thinkingRate() ? 180 : 520) + spark.phase));
        const tone = tones[spark.hue < 0.5 ? 0 : spark.hue < 0.8 ? 1 : 2];
        const glow = Math.max(1.6, size / 26) * (0.7 + (z + 1) * 0.3);
        const gradient = context.createRadialGradient(x, y, 0, x, y, glow * 2.4);
        gradient.addColorStop(0, `rgba(${tone},${(0.95 * flicker).toFixed(3)})`);
        gradient.addColorStop(0.35, `rgba(${tone},${(0.35 * flicker).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${tone},0)`);
        context.fillStyle = gradient;
        context.beginPath(); context.arc(x, y, glow * 2.4, 0, Math.PI * 2); context.fill();
      }
      // The brightest points on the front of the surface.
      for (const [x, y, z] of placed) {
        if (z < 0.55) continue;
        context.fillStyle = `rgba(${line},${(0.35 + z * 0.4).toFixed(3)})`;
        context.beginPath(); context.arc(x, y, Math.max(0.7, size / 120), 0, Math.PI * 2); context.fill();
      }
    };
    const thinkingRate = () => speed.current > 0.5;

    const loop = (time: number) => {
      const elapsed = last ? Math.min(0.05, (time - last) / 1000) : 0;
      last = time;
      busy += (speed.current - busy) * Math.min(1, elapsed * 3);
      angle += elapsed * (0.32 + busy * 2.2);
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    const start = () => { if (!frame && live && visible && !document.hidden && !motionOff()) { last = 0; frame = requestAnimationFrame(loop); } };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };
    const refresh = () => { stop(); draw(performance.now()); start(); };

    draw(0);
    start();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); else stop(); });
    observer.observe(element);
    const theme = new MutationObserver(() => { if (!frame) draw(performance.now()); });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const events = ["careerforge-motion", "storage", "visibilitychange"];
    events.forEach(name => (name === "visibilitychange" ? document : window).addEventListener(name, refresh));
    return () => {
      stop(); observer.disconnect(); theme.disconnect();
      events.forEach(name => (name === "visibilitychange" ? document : window).removeEventListener(name, refresh));
    };
  }, [size, live]);

  return <canvas ref={canvas} className={`ai-globe${className ? ` ${className}` : ""}`} style={{ width: size, height: size }} aria-hidden="true" />;
}
