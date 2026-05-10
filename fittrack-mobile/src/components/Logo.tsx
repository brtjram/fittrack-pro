import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

interface LogoMarkProps {
  size?: number;
  color?: string;
  bg?: string;
}

export function LogoMark({ size = 32, color = '#C8FF00', bg = '#0B0B0B' }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Rounded square background */}
      <Rect width="32" height="32" rx="8" fill={bg} />
      {/* Bold F and T lettermark — geometric, strong */}
      {/* F stroke */}
      <Rect x="7" y="7" width="3" height="18" rx="1.5" fill={color} />
      <Rect x="7" y="7" width="10" height="3" rx="1.5" fill={color} />
      <Rect x="7" y="14.5" width="8" height="3" rx="1.5" fill={color} />
      {/* T stroke */}
      <Rect x="16" y="7" width="9" height="3" rx="1.5" fill={color} />
      <Rect x="19" y="7" width="3" height="18" rx="1.5" fill={color} />
    </Svg>
  );
}

interface LogoWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
  accentColor?: string;
  textColor?: string;
}

export function LogoWordmark({
  size = 'md',
  accentColor = '#C8FF00',
  textColor = '#FFFFFF',
}: LogoWordmarkProps) {
  const fontSize = size === 'sm' ? 16 : size === 'md' ? 22 : 30;
  const markSize = size === 'sm' ? 24 : size === 'md' ? 32 : 44;

  return (
    <View style={styles.row}>
      <LogoMark size={markSize} color={accentColor} bg="transparent" />
      <Text style={[styles.wordmark, { fontSize, color: textColor }]}>
        FIT<Text style={{ color: accentColor }}>TRACK</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontWeight: '900', letterSpacing: -0.5 },
});
