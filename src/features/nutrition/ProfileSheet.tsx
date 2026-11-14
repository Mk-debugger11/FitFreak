import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Input, ModalOption, ModalSheet, SegmentedControl, SegmentedOption } from '../../components';
import {
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIERS,
  GOAL_LABELS,
} from '../../constants/nutrition';
import { theme } from '../../theme';
import { ActivityLevel, NutritionGoal, Sex, UserProfile } from '../../types';
import { ageFromBirthDate, toLocalDateKey } from '../../utils/date';
import { formatCalories } from '../../utils/format';
import { useProfileStore } from '../../store/profileStore';
import { computeMaintenanceCalories, PROFILE_LIMITS } from './energyFormulas';

interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SEX_OPTIONS: readonly SegmentedOption<Sex>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const GOAL_OPTIONS: readonly SegmentedOption<NutritionGoal>[] = [
  { value: 'cut', label: GOAL_LABELS.cut },
  { value: 'maintain', label: GOAL_LABELS.maintain },
  { value: 'bulk', label: GOAL_LABELS.bulk },
];

const ACTIVITY_ITEMS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

export const ProfileSheet: React.FC<ProfileSheetProps> = ({ visible, onClose }) => {
  const existingProfile = useProfileStore((state) => state.profile);

  const [sex, setSex] = useState<Sex>('male');
  const [birthDateText, setBirthDateText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<NutritionGoal>('maintain');
  const [bodyFatText, setBodyFatText] = useState('');
  const [overrideText, setOverrideText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize or reset form state when sheet becomes visible
  useEffect(() => {
    if (visible) {
      if (existingProfile) {
        setSex(existingProfile.sex);
        setBirthDateText(
          existingProfile.birthDate ? toLocalDateKey(new Date(existingProfile.birthDate)) : '',
        );
        setHeightText(existingProfile.heightCm ? String(existingProfile.heightCm) : '');
        setWeightText(existingProfile.weightKg ? String(existingProfile.weightKg) : '');
        setActivityLevel(existingProfile.activityLevel || 'moderate');
        setGoal(existingProfile.goal || 'maintain');
        setBodyFatText(
          existingProfile.bodyFatPercent != null ? String(existingProfile.bodyFatPercent) : '',
        );
        setOverrideText(
          existingProfile.maintenanceOverride != null
            ? String(existingProfile.maintenanceOverride)
            : '',
        );
        setShowAdvanced(
          existingProfile.bodyFatPercent != null || existingProfile.maintenanceOverride != null,
        );
      } else {
        setSex('male');
        setBirthDateText('');
        setHeightText('');
        setWeightText('');
        setActivityLevel('moderate');
        setGoal('maintain');
        setBodyFatText('');
        setOverrideText('');
        setShowAdvanced(false);
      }
    }
  }, [visible, existingProfile]);

  // Validation
  const birthDateValidation = useMemo(() => {
    if (!birthDateText.trim()) return { isValid: false, date: null, error: undefined };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateText.trim())) {
      return { isValid: false, date: null, error: 'Format must be YYYY-MM-DD' };
    }
    const [y, m, d] = birthDateText.trim().split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (
      isNaN(dateObj.getTime()) ||
      dateObj.getFullYear() !== y ||
      dateObj.getMonth() !== m - 1 ||
      dateObj.getDate() !== d
    ) {
      return { isValid: false, date: null, error: 'Invalid calendar date' };
    }
    const age = ageFromBirthDate(dateObj);
    if (age < PROFILE_LIMITS.age.min || age > PROFILE_LIMITS.age.max) {
      return {
        isValid: false,
        date: null,
        error: `Age must be between ${PROFILE_LIMITS.age.min} and ${PROFILE_LIMITS.age.max} (currently ${age})`,
      };
    }
    return { isValid: true, date: dateObj, error: undefined };
  }, [birthDateText]);

  const heightValidation = useMemo(() => {
    if (!heightText.trim()) return { isValid: false, val: null, error: undefined };
    const num = parseFloat(heightText.trim());
    if (
      isNaN(num) ||
      num < PROFILE_LIMITS.heightCm.min ||
      num > PROFILE_LIMITS.heightCm.max
    ) {
      return {
        isValid: false,
        val: null,
        error: `Height must be between ${PROFILE_LIMITS.heightCm.min} and ${PROFILE_LIMITS.heightCm.max} cm`,
      };
    }
    return { isValid: true, val: num, error: undefined };
  }, [heightText]);

  const weightValidation = useMemo(() => {
    if (!weightText.trim()) return { isValid: false, val: null, error: undefined };
    const num = parseFloat(weightText.trim());
    if (
      isNaN(num) ||
      num < PROFILE_LIMITS.weightKg.min ||
      num > PROFILE_LIMITS.weightKg.max
    ) {
      return {
        isValid: false,
        val: null,
        error: `Weight must be between ${PROFILE_LIMITS.weightKg.min} and ${PROFILE_LIMITS.weightKg.max} kg`,
      };
    }
    return { isValid: true, val: num, error: undefined };
  }, [weightText]);

  const bodyFatValidation = useMemo(() => {
    if (!bodyFatText.trim()) return { isValid: true, val: null, error: undefined };
    const num = parseFloat(bodyFatText.trim());
    if (
      isNaN(num) ||
      num < PROFILE_LIMITS.bodyFatPercent.min ||
      num > PROFILE_LIMITS.bodyFatPercent.max
    ) {
      return {
        isValid: false,
        val: null,
        error: `Body fat % must be between ${PROFILE_LIMITS.bodyFatPercent.min} and ${PROFILE_LIMITS.bodyFatPercent.max}`,
      };
    }
    return { isValid: true, val: num, error: undefined };
  }, [bodyFatText]);

  const overrideValidation = useMemo(() => {
    if (!overrideText.trim()) return { isValid: true, val: null, error: undefined };
    const num = parseFloat(overrideText.trim());
    if (isNaN(num) || num <= 0) {
      return {
        isValid: false,
        val: null,
        error: 'Maintenance override must be > 0 kcal',
      };
    }
    return { isValid: true, val: Math.round(num), error: undefined };
  }, [overrideText]);

  const isFormValid =
    birthDateValidation.isValid &&
    heightValidation.isValid &&
    weightValidation.isValid &&
    bodyFatValidation.isValid &&
    overrideValidation.isValid;

  // Live maintenance calculation
  const liveMaintenance = useMemo(() => {
    if (!birthDateValidation.date || !heightValidation.val || !weightValidation.val) {
      return null;
    }
    const draft: Partial<UserProfile> = {
      sex,
      birthDate: birthDateValidation.date,
      heightCm: heightValidation.val,
      weightKg: weightValidation.val,
      activityLevel,
      goal,
      bodyFatPercent: bodyFatValidation.val ?? undefined,
      maintenanceOverride: overrideValidation.val ?? undefined,
    };
    return computeMaintenanceCalories(draft);
  }, [
    sex,
    birthDateValidation.date,
    heightValidation.val,
    weightValidation.val,
    activityLevel,
    goal,
    bodyFatValidation.val,
    overrideValidation.val,
  ]);

  const liveReadoutText = useMemo(() => {
    if (!liveMaintenance) return null;
    if (liveMaintenance.isOverride) {
      return `Maintenance override: ${formatCalories(liveMaintenance.kcal)} kcal (manual override)`;
    }

    const formulaName =
      liveMaintenance.formula === 'katch_mcardle' ? 'Katch-McArdle' : 'Mifflin-St Jeor';
    const activityName =
      activityLevel === 'very_active'
        ? 'Very Active'
        : activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1);

    return `BMR ${formatCalories(liveMaintenance.bmr)} kcal (${formulaName}) × ${liveMaintenance.multiplier} ${activityName} = ${formatCalories(liveMaintenance.kcal)} kcal maintenance`;
  }, [liveMaintenance, activityLevel]);

  const handleSave = async () => {
    if (!isFormValid || !birthDateValidation.date || !heightValidation.val || !weightValidation.val) {
      return;
    }
    setIsSaving(true);
    try {
      await useProfileStore.getState().saveProfile({
        sex,
        birthDate: birthDateValidation.date,
        heightCm: heightValidation.val,
        weightKg: weightValidation.val,
        activityLevel,
        goal,
        bodyFatPercent: bodyFatValidation.val ?? undefined,
        maintenanceOverride: overrideValidation.val ?? undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      title="Nutrition Profile"
      scrollable
      footer={
        <View style={styles.footerContainer}>
          <Button
            title="Save Profile"
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
            isLoading={isSaving}
          />
          <Button title="Cancel" variant="outline" onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      }
    >
      <View style={styles.section}>
        <Text style={styles.label}>Biological Sex</Text>
        <SegmentedControl options={SEX_OPTIONS} value={sex} onChange={setSex} />
      </View>

      <Input
        label="Birth Date"
        placeholder="YYYY-MM-DD"
        value={birthDateText}
        onChangeText={setBirthDateText}
        error={birthDateValidation.error}
      />

      <Input
        label="Height (cm)"
        placeholder="e.g. 175"
        keyboardType="numeric"
        value={heightText}
        onChangeText={setHeightText}
        error={heightValidation.error}
      />

      <Input
        label="Weight (kg)"
        placeholder="e.g. 70"
        keyboardType="numeric"
        value={weightText}
        onChangeText={setWeightText}
        error={weightValidation.error}
      />

      <View style={styles.section}>
        <Text style={styles.label}>Activity Level</Text>
        <View style={styles.optionsList}>
          {ACTIVITY_ITEMS.map((level) => {
            const rawLabel = ACTIVITY_LABELS[level];
            const [title, desc] = rawLabel.split(' - ');
            const isSelected = activityLevel === level;
            return (
              <ModalOption
                key={level}
                label={title}
                subtitle={`${desc} (${ACTIVITY_MULTIPLIERS[level]}×)`}
                onPress={() => setActivityLevel(level)}
                highlighted={isSelected}
                trailing={
                  isSelected ? <Text style={styles.checkMark}>✓</Text> : null
                }
              />
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nutrition Goal</Text>
        <SegmentedControl options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
      </View>

      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? '▼ Hide Advanced Options' : '▶ Show Advanced Options (Body Fat %, Override)'}
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedSection}>
          <Input
            label="Body Fat % (enables Katch-McArdle)"
            placeholder="e.g. 15 (range 3–60)"
            keyboardType="numeric"
            value={bodyFatText}
            onChangeText={setBodyFatText}
            error={bodyFatValidation.error}
          />

          <Input
            label="Maintenance Override (kcal)"
            placeholder="e.g. 2500 (wins over formula)"
            keyboardType="numeric"
            value={overrideText}
            onChangeText={setOverrideText}
            error={overrideValidation.error}
          />
        </View>
      )}

      {/* Live Readout */}
      <View style={styles.readoutCard}>
        <Text style={styles.readoutTitle}>Calculated Maintenance</Text>
        {liveReadoutText ? (
          <Text style={styles.readoutText}>{liveReadoutText}</Text>
        ) : (
          <Text style={styles.readoutMuted}>
            Fill in required fields (birth date, height, weight) to see your live maintenance calculation.
          </Text>
        )}
      </View>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.xs,
  },
  optionsList: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
  },
  checkMark: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  advancedToggle: {
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  advancedToggleText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  advancedSection: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  readoutCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  readoutTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: theme.typography.weights.semibold,
    marginBottom: 4,
  },
  readoutText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    lineHeight: 20,
  },
  readoutMuted: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontStyle: 'italic',
  },
  footerContainer: {
    marginTop: theme.spacing.sm,
  },
});
