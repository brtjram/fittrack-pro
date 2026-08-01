// Shared "Warm Iron" building blocks used across the redesigned screens —
// grouped list rows, rings, sparklines, pills. Keeps every screen's markup
// close to the design doc instead of re-deriving these primitives per file.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Animated, PanResponder } from 'react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { ChevronRight, Check, Trash2 } from 'lucide-react-native';
import { Fonts } from '../theme/fonts';
import type { ThemeColors } from '../theme/colors';

// Small numeric value shown in a rounded "bubble", tap to edit — the value
// chips used throughout the auto-apply profile drill-in screens (no Save
// button; committing the edit calls onCommit immediately).
export function NumberBubble({
  value, unit, colors, onCommit, keyboardType = 'numeric', width = 74,
}: {
  value: number; unit?: string; colors: ThemeColors; onCommit: (v: number) => void;
  keyboardType?: 'numeric' | 'decimal-pad'; width?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = () => {
    const parsed = parseFloat(text);
    if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed);
    else setText(String(value));
  };
  return (
    <View style={[bubbleStyles.wrap, { backgroundColor: colors.surfaceInset, minWidth: width }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType={keyboardType}
        style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink, textAlign: 'right', minWidth: 24, padding: 0 }}
      />
      {unit && <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground }}>{unit}</Text>}
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 7, justifyContent: 'flex-end' },
});

// Segmented control (2+ options) sharing the profile drill-ins' "pill row"
// look — the light chip on dark track used for Sex, Units, split-day toggles.
export function SegmentedControl<T extends string | number>({
  options, value, onChange, colors,
}: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; colors: ThemeColors;
}) {
  return (
    <View style={[segStyles.track, { backgroundColor: colors.surfaceInset }]}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[segStyles.seg, value === opt.value && { backgroundColor: colors.ink }]}
        >
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: value === opt.value ? colors.canvas : colors.mutedStrong }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const segStyles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4, borderRadius: 11, padding: 3 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
});

// Fades in briefly after an auto-applied change, then fades out — replaces
// the old pattern's explicit Save button with quiet confirmation instead.
export function AppliedBanner({ visible, colors, label = 'Applied' }: { visible: boolean; colors: ThemeColors; label?: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity]);
  return (
    <Animated.View style={{ opacity, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' }}>
      <Check size={13} color={colors.progress} strokeWidth={3} />
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.progress }}>{label}</Text>
    </Animated.View>
  );
}

export function SectionLabel({ children, colors, style }: { children: React.ReactNode; colors: ThemeColors; style?: any }) {
  return (
    <Text style={[{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1.2, color: colors.mutedForeground, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

export function Serif({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[{ fontFamily: Fonts.serif }, style]}>{children}</Text>;
}

export function Card({ children, colors, style }: { children: React.ReactNode; colors: ThemeColors; style?: any }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: 18, padding: 18 }, style]}>{children}</View>;
}

export function ListGroup({ children, colors, style }: { children: React.ReactNode; colors: ThemeColors; style?: any }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }, style]}>{children}</View>;
}

export function ListRow({
  icon, iconColor, title, subtitle, detail, chevron = true, isLast = false, onPress, colors, right,
}: {
  icon?: React.ReactNode; iconColor?: string; title: string; subtitle?: string; detail?: string;
  chevron?: boolean; isLast?: boolean; onPress?: () => void; colors: ThemeColors; right?: React.ReactNode;
}) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={[rowStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.hairline }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {icon && <View style={{ marginRight: 14 }}>{icon}</View>}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {detail ? <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, color: colors.mutedForeground, marginRight: chevron ? 6 : 0 }}>{detail}</Text> : null}
      {right}
      {chevron && <ChevronRight size={16} color={colors.mutedForeground} />}
    </Wrap>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 15 },
});

// Native-feeling swipe-to-delete for card/list rows — a persistent delete
// button on every row eats width and gets accidentally tapped; hiding it
// behind a leftward swipe (like Mail/Reminders) is the standard iOS pattern.
// Pure PanResponder + Animated so it needs no extra native dependency
// (react-native-gesture-handler isn't installed in this project).
//
// Matches the full Mail-style gesture set, not just reveal-on-swipe:
//  - short left swipe past the halfway point: snaps open, button stays put
//  - long left swipe (or a fast flick) past ~55% of the row width: the row
//    finishes sliding off and deletes immediately, no second tap needed
//  - right swipe while open: closes/undoes back to the resting position
export function SwipeToDelete({
  children, onDelete, colors, disabled, borderRadius = 18,
}: {
  children: React.ReactNode; onDelete: () => void; colors: ThemeColors; disabled?: boolean; borderRadius?: number;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const ACTION_WIDTH = 76;
  // Row width isn't known until layout; this is just a sane pre-layout
  // guess so a swipe that starts before onLayout fires still behaves.
  const FALLBACK_WIDTH = 320;

  // Plain refs, not state — PanResponder handlers read `.current` on every
  // touch event, so these need to be mutable without triggering (or
  // waiting on) a re-render.
  const restingX = useRef(0);
  const rowWidth = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      // Requires a deliberately horizontal drag past a small deadzone so a
      // vertical list scroll or a plain tap into a child (button, text
      // input) never gets mistaken for a swipe. A rightward drag only
      // starts the gesture if the row is already open — closed rows have
      // nothing to reveal on the right.
      onMoveShouldSetPanResponder: (_, g) => {
        if (disabled) return false;
        if (Math.abs(g.dx) <= 8 || Math.abs(g.dx) <= Math.abs(g.dy) * 1.5) return false;
        return g.dx < 0 || restingX.current < 0;
      },
      onPanResponderMove: (_, g) => {
        const width = rowWidth.current || FALLBACK_WIDTH;
        translateX.setValue(Math.max(-width, Math.min(0, restingX.current + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const width = rowWidth.current || FALLBACK_WIDTH;
        const next = Math.max(-width, Math.min(0, restingX.current + g.dx));
        const deleteThreshold = Math.max(width * 0.55, ACTION_WIDTH * 2.5);

        if (next <= -deleteThreshold) {
          restingX.current = -width;
          Animated.timing(translateX, { toValue: -(width + 60), duration: 200, useNativeDriver: true }).start(() => onDelete());
          return;
        }

        const flickOpen = g.dx < 0 && g.vx < -0.6;
        const flickClose = g.dx > 0 && g.vx > 0.6;
        const open = !flickClose && (next < -ACTION_WIDTH / 2 || flickOpen);
        restingX.current = open ? -ACTION_WIDTH : 0;
        Animated.spring(translateX, { toValue: restingX.current, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  return (
    <View style={{ borderRadius, overflow: 'hidden' }} onLayout={(e) => { rowWidth.current = e.nativeEvent.layout.width; }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.danger, alignItems: 'flex-end', justifyContent: 'center' }]}>
        <TouchableOpacity
          onPress={() => {
            restingX.current = 0;
            Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }).start();
            onDelete();
          }}
          style={{ width: ACTION_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Trash2 size={19} color="#fff" />
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...(disabled ? {} : panResponder.panHandlers)}>
        {children}
      </Animated.View>
    </View>
  );
}

export function PillButton({
  label, onPress, colors, tone = 'signal', disabled, icon, style,
}: {
  label: string; onPress?: () => void; colors: ThemeColors; tone?: 'signal' | 'ghost' | 'ink';
  disabled?: boolean; icon?: React.ReactNode; style?: any;
}) {
  const bg = tone === 'signal' ? colors.signal : tone === 'ink' ? colors.ink : colors.surfaceInset;
  const fg = tone === 'signal' ? colors.signalForeground : tone === 'ink' ? colors.canvas : colors.ink;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[pillStyles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {icon}
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15.5, color: fg }}>{label}</Text>
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
});

export function Ring({ size = 58, stroke = 5, percent, trackColor, fillColor }: {
  size?: number; stroke?: number; percent: number; trackColor: string; fillColor: string;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.min(Math.max(percent, 0), 1));
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      <Circle
        cx={c} cy={c} r={r} stroke={fillColor} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}

// Simple line sparkline over evenly-spaced values, 0..1 normalized internally.
export function Sparkline({ values, width = 300, height = 60, color, dotColor, showEndDot = true }: {
  values: number[]; width?: number; height?: number; color: string; dotColor?: string; showEndDot?: boolean;
}) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = height * 0.12;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`)).join(' ');
  return (
    <Svg width={width} height={height}>
      {pts.slice(0, -1).map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={2.5} fill={dotColor ?? color} opacity={0.35} />
      ))}
      <Path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {showEndDot && <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4.5} fill={color} />}
    </Svg>
  );
}

export function BarChart({ values, labels, width = 300, height = 76, color, mutedColor, highlightLast }: {
  values: number[]; labels?: string[]; width?: number; height?: number; color: string; mutedColor: string; highlightLast?: boolean;
}) {
  const max = Math.max(...values, 1);
  const gap = 9;
  const barW = (width - gap * (values.length - 1)) / values.length;
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {values.map((v, i) => {
        const h = Math.max(4, (v / max) * height);
        const isLast = i === values.length - 1;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ width: '100%', height, justifyContent: 'flex-end' }}>
              <View style={{ width: '100%', height: h, borderRadius: 4, backgroundColor: isLast && highlightLast ? color : mutedColor }} />
            </View>
            {labels?.[i] ? <Text style={{ fontSize: 9.5, fontFamily: Fonts.sans, color: isLast && highlightLast ? color : mutedColor }}>{labels[i]}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

// Bar chart with a dashed reference line for a daily target (steps goal,
// calorie target, etc). Bars that meet/exceed the target are highlighted.
// `target` can vary per day (e.g. BMR + that day's active calories) — pass
// an array the same length as `values` and the reference line follows it.
export function TargetBarChart({
  values, labels, target, width = 300, height = 90, color, mutedColor, targetColor, highlight, yAxisFormat,
}: {
  values: number[]; labels?: string[]; target: number | number[]; width?: number; height?: number;
  color: string; mutedColor: string; targetColor: string;
  // Overrides the default "bar meets/exceeds target" highlight rule. Needed
  // for charts where being *under* the reference line is the good outcome
  // (e.g. calories consumed vs. total burn — a deficit day should light up,
  // not a surplus day) or where the good range is a band, not a threshold
  // (e.g. diet adherence within 10% of target).
  highlight?: boolean[];
  // Formats the 3 y-axis tick values (0 / half / max) — defaults to a plain
  // rounded number, callers pass something like a "10k" compactor for charts
  // where that reads better (steps, large calorie counts).
  yAxisFormat?: (n: number) => string;
}) {
  const targets = Array.isArray(target) ? target : values.map(() => target);
  const max = Math.max(...values, ...targets, 1);
  const format = yAxisFormat ?? ((n: number) => {
    if (n >= 1000) {
      const k = n / 1000;
      return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
    }
    return Math.round(n).toLocaleString();
  });

  // A left-hand axis column so the bars alone don't have to carry "is this
  // good" — you can read the actual numbers a bar represents at a glance,
  // not just whether it crossed the dashed target line.
  const axisWidth = 34;
  const chartWidth = width - axisWidth;
  const gap = 9;
  const barW = (chartWidth - gap * (values.length - 1)) / values.length;
  const targetPoints = targets.map((t, i) => {
    const x = i * (barW + gap) + barW / 2;
    const y = height - (Math.min(t, max) / max) * height;
    return [x, y];
  });
  const targetPath = targetPoints.map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`)).join(' ');
  const ticks = [max, max / 2, 0];

  return (
    <View style={{ width }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: axisWidth, height, justifyContent: 'space-between', paddingRight: 6 }}>
          {ticks.map((t, i) => (
            // mutedColor (colors.trackMuted) is calibrated for bar-fill/gridline
            // contrast, not text — it reads as nearly invisible in dark mode.
            // targetColor (colors.mutedStrong) is the same "readable but
            // de-emphasized" tone already used for the target line, and every
            // caller passes the same value, so this is consistent across all
            // charts by construction rather than needing a new prop per chart.
            <Text key={i} style={{ fontSize: 9, fontFamily: Fonts.sans, color: targetColor, textAlign: 'right' }}>
              {format(t)}
            </Text>
          ))}
        </View>
        <View style={{ width: chartWidth, height }}>
          <GridLines width={chartWidth} height={height} rows={3} color={mutedColor} />
          <View style={{ width: chartWidth, height, flexDirection: 'row', alignItems: 'flex-end', gap }}>
            {values.map((v, i) => {
              const h = Math.max(3, (v / max) * height);
              return (
                <View key={i} style={{ flex: 1, height, justifyContent: 'flex-end' }}>
                  <View style={{ width: '100%', height: h, borderRadius: 4, backgroundColor: (highlight ? highlight[i] : v >= targets[i]) ? color : mutedColor }} />
                </View>
              );
            })}
          </View>
          <Svg width={chartWidth} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {Array.isArray(target)
              ? <Path d={targetPath} stroke={targetColor} strokeWidth={1.5} strokeDasharray="4,4" fill="none" />
              : <Line x1={0} y1={targetPoints[0][1]} x2={chartWidth} y2={targetPoints[0][1]} stroke={targetColor} strokeWidth={1.5} strokeDasharray="4,4" />}
          </Svg>
        </View>
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <View style={{ width: axisWidth }} />
          <View style={{ flexDirection: 'row', gap, width: chartWidth }}>
            {labels.map((l, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, fontFamily: Fonts.sans, color: mutedColor }}>{l}</Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export function Divider({ colors }: { colors: ThemeColors }) {
  return <View style={{ height: 1, backgroundColor: colors.hairline }} />;
}

export function GridLines({ width, height, rows = 3, color }: { width: number; height: number; rows?: number; color: string }) {
  const lines = Array.from({ length: rows }, (_, i) => (height / (rows - 1 || 1)) * i);
  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      {lines.map((y, i) => <Line key={i} x1={0} y1={y} x2={width} y2={y} stroke={color} strokeWidth={1} />)}
    </Svg>
  );
}
