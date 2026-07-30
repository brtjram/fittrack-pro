import React from 'react';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { ThemeColors } from '../theme/colors';

export type HeroMood = 'active' | 'rest';

const VB_W = 400;
const VB_H = 200;

// Rotates the motif daily (not per-render) so the tile varies across visits
// without flickering between different art on every re-render.
function motifIndexToday(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function AscentMotif({ c }: { c: ThemeColors }) {
  return (
    <>
      <Path
        d="M0,168 L58,142 L108,156 L166,92 L226,122 L288,58 L400,82"
        stroke={c.signal} strokeWidth={3} fill="none" opacity={0.9}
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M0,188 L58,176 L108,182 L166,152 L226,164 L288,132 L400,146"
        stroke={c.progress} strokeWidth={2} fill="none" opacity={0.35}
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx={288} cy={58} r={5} fill={c.signal} />
    </>
  );
}

function PulseMotif({ c }: { c: ThemeColors }) {
  return (
    <>
      <Path
        d="M0,112 L88,112 L108,58 L130,158 L150,88 L170,112 L400,112"
        stroke={c.signal} strokeWidth={3} fill="none" opacity={0.9}
        strokeLinecap="round" strokeLinejoin="round"
      />
      {[60, 140, 220, 300, 370].map((cx, i) => (
        <Circle key={cx} cx={cx} cy={38 + (i % 2) * 16} r={3} fill={c.progress} opacity={0.5} />
      ))}
    </>
  );
}

function StackMotif({ c }: { c: ThemeColors }) {
  const bars = [40, 68, 54, 92, 74, 108, 88];
  return (
    <>
      {bars.map((h, i) => (
        <Rect
          key={i}
          x={16 + i * 53}
          y={188 - h}
          width={28}
          height={h}
          rx={6}
          fill={i === bars.length - 1 ? c.signal : c.surfaceInset}
          opacity={i === bars.length - 1 ? 0.95 : 0.7}
        />
      ))}
    </>
  );
}

function DriftMotif({ c }: { c: ThemeColors }) {
  return (
    <>
      <Path
        d="M0,118 C60,98 100,138 160,118 C220,98 260,138 320,118 C350,108 380,113 400,118"
        stroke={c.info} strokeWidth={2.5} fill="none" opacity={0.5} strokeLinecap="round"
      />
      <Path
        d="M0,150 C60,135 100,160 160,150 C220,138 260,162 320,150 C350,144 380,147 400,150"
        stroke={c.faint} strokeWidth={2} fill="none" opacity={0.6} strokeLinecap="round"
      />
    </>
  );
}

function EaseMotif({ c }: { c: ThemeColors }) {
  const dots: Array<[number, number, number]> = [
    [40, 60, 3], [90, 100, 2], [150, 50, 2.5], [210, 112, 2], [270, 70, 3], [330, 96, 2], [380, 55, 2.5],
  ];
  return (
    <>
      {dots.map(([cx, cy, r], i) => (
        <Circle key={i} cx={cx} cy={cy} r={r} fill={c.faint} opacity={0.6} />
      ))}
      <Circle cx={200} cy={82} r={26} stroke={c.mutedStrong} strokeWidth={1.5} fill="none" opacity={0.4} />
    </>
  );
}

function StillMotif({ c }: { c: ThemeColors }) {
  return (
    <>
      <Circle cx={330} cy={54} r={30} fill={c.faint} opacity={0.25} />
      <Path d="M0,140 Q200,110 400,140" stroke={c.mutedStrong} strokeWidth={2} fill="none" opacity={0.4} strokeLinecap="round" />
    </>
  );
}

const ACTIVE_MOTIFS = [AscentMotif, PulseMotif, StackMotif];
const REST_MOTIFS = [DriftMotif, EaseMotif, StillMotif];

// A generated, code-drawn visual instead of a static asset — scales cleanly
// to any tile size and stays on-palette. `mood` picks the pool (busy/upward
// for active days, calm/settled for rest days); the day-of-year rotates
// which motif within that pool renders, so the tile isn't identical daily.
export function HeroVisual({ colors, mood, width, height }: {
  colors: ThemeColors; mood: HeroMood; width: number; height: number;
}) {
  const pool = mood === 'rest' ? REST_MOTIFS : ACTIVE_MOTIFS;
  const Motif = pool[motifIndexToday() % pool.length];

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Defs>
        <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surface} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.surface} stopOpacity={0.5} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={VB_W} height={VB_H} fill={colors.surfaceInset} />
      <Motif c={colors} />
      <Rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#heroFade)" />
    </Svg>
  );
}
