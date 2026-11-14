import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { MacroNutrients } from '../../types';
import { formatGrams } from '../../utils/format';
import { useProfileStore } from '../../store/profileStore';
import { computeMacroTargets } from './energyFormulas';
import { macroCalorieShares } from './servingMath';

interface MacroTotalsBarProps {
  totals: MacroNutrients;
}

export const MacroTotalsBar: React.FC<MacroTotalsBarProps> = ({ totals }) => {
  const profile = useProfileStore((state) => state.profile);

  const targets = useMemo(() => computeMacroTargets(profile), [profile]);
  const shares = useMemo(() => macroCalorieShares(totals), [totals]);

  const hasIntake = shares.protein > 0 || shares.carbs > 0 || shares.fat > 0;

  const proteinProgress = targets?.protein
    ? Math.min(100, Math.max(0, (totals.protein / targets.protein) * 100))
    : 0;

  const carbsProgress = targets?.carbs
    ? Math.min(100, Math.max(0, (totals.carbs / targets.carbs) * 100))
    : 0;

  const fatProgress = targets?.fat
    ? Math.min(100, Math.max(0, (totals.fat / targets.fat) * 100))
    : 0;

  return (
    <View style={styles.container}>
      {/* Horizontal Stacked Bar */}
      <View style={styles.stackedBar}>
        {hasIntake ? (
          <>
            {shares.protein > 0 && (
              <View
                style={[
                  styles.barSegment,
                  {
                    flex: shares.protein,
                    backgroundColor: theme.colors.nutrition.protein,
                  },
                ]}
              />
            )}
            {shares.carbs > 0 && (
              <View
                style={[
                  styles.barSegment,
                  {
                    flex: shares.carbs,
                    backgroundColor: theme.colors.nutrition.carbs,
                  },
                ]}
              />
            )}
            {shares.fat > 0 && (
              <View
                style={[
                  styles.barSegment,
                  {
                    flex: shares.fat,
                    backgroundColor: theme.colors.nutrition.fat,
                  },
                ]}
              />
            )}
          </>
        ) : (
          <View style={[styles.barSegment, { flex: 1, backgroundColor: theme.colors.nutrition.track }]} />
        )}
      </View>

      {/* Three Macro Cards / Chips */}
      <View style={styles.cardsRow}>
        {/* Protein Card */}
        <View style={styles.macroCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.macroDot,
                { backgroundColor: theme.colors.nutrition.protein },
              ]}
            />
            <Text style={styles.macroName}>Protein</Text>
          </View>
          <Text style={styles.macroValues}>
            {formatGrams(totals.protein)}
            {targets ? (
              <Text style={styles.macroTarget}> / {formatGrams(targets.protein)}</Text>
            ) : null}
          </Text>
          {targets ? (
            <View style={styles.thinTrack}>
              <View
                style={[
                  styles.thinFill,
                  {
                    width: `${proteinProgress}%`,
                    backgroundColor: theme.colors.nutrition.protein,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>

        {/* Carbs Card */}
        <View style={styles.macroCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.macroDot,
                { backgroundColor: theme.colors.nutrition.carbs },
              ]}
            />
            <Text style={styles.macroName}>Carbs</Text>
          </View>
          <Text style={styles.macroValues}>
            {formatGrams(totals.carbs)}
            {targets ? (
              <Text style={styles.macroTarget}> / {formatGrams(targets.carbs)}</Text>
            ) : null}
          </Text>
          {targets ? (
            <View style={styles.thinTrack}>
              <View
                style={[
                  styles.thinFill,
                  {
                    width: `${carbsProgress}%`,
                    backgroundColor: theme.colors.nutrition.carbs,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>

        {/* Fat Card */}
        <View style={styles.macroCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.macroDot,
                { backgroundColor: theme.colors.nutrition.fat },
              ]}
            />
            <Text style={styles.macroName}>Fat</Text>
          </View>
          <Text style={styles.macroValues}>
            {formatGrams(totals.fat)}
            {targets ? (
              <Text style={styles.macroTarget}> / {formatGrams(targets.fat)}</Text>
            ) : null}
          </Text>
          {targets ? (
            <View style={styles.thinTrack}>
              <View
                style={[
                  styles.thinFill,
                  {
                    width: `${fatProgress}%`,
                    backgroundColor: theme.colors.nutrition.fat,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  stackedBar: {
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.nutrition.track,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  barSegment: {
    height: '100%',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  macroCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  macroName: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  macroValues: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
  macroTarget: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.regular,
  },
  thinTrack: {
    height: 3,
    backgroundColor: theme.colors.nutrition.track,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginTop: 6,
  },
  thinFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
});
