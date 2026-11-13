import React, { useId } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { theme } from '../../theme';
import { interpolateHeatColor } from './doseResponse';
import { DEFAULT_SCORING_CONFIG } from './scoringConfig';

const LEGEND_LABELS = ['None', 'Light', 'Moderate', 'High'] as const;

const ANATOMY_STOP_COLORS = [
  theme.colors.anatomy.none,
  theme.colors.anatomy.light,
  theme.colors.anatomy.moderate,
  theme.colors.anatomy.high,
] as const;

const HEAT_GRADIENT_STOPS = DEFAULT_SCORING_CONFIG.heatStops.map((entry, index) => ({
  offset: `${Math.round(entry.stop * 100)}%`,
  color:
    ANATOMY_STOP_COLORS[index] ??
    interpolateHeatColor(entry.stop, DEFAULT_SCORING_CONFIG.heatStops),
}));

/**
 * Compact continuous gradient legend mapping the muscle heatmap scale from
 * None to High using the active scoring heat stops and anatomy theme tokens.
 */
export const MuscleLegend: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const rawId = useId();
  const gradientId = `muscle-heat-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <View
      style={[styles.container, style]}
      accessibilityLabel="Muscle heatmap legend from None to High"
    >
      <View style={styles.barTrack}>
        <Svg width="100%" height={8} viewBox="0 0 100 8" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {HEAT_GRADIENT_STOPS.map((item) => (
                <Stop
                  key={item.offset}
                  offset={item.offset}
                  stopColor={item.color}
                  stopOpacity={1}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={8} fill={`url(#${gradientId})`} />
        </Svg>
      </View>

      <View style={styles.labelsRow}>
        {LEGEND_LABELS.map((label) => (
          <Text key={label} style={styles.label}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
  },
  barTrack: {
    height: 8,
    width: '100%',
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    backgroundColor: theme.colors.anatomy.none,
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
});
