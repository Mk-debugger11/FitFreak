import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { theme } from '../../theme';

/** Canonical camera position and orbit target for resetting the 3D viewer. */
export interface OrbitCameraPose {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/**
 * Resets an OrbitControls instance to a canonical camera pose without leaving
 * behind damped rotation, pan, or dolly inertia.
 *
 * Temporarily disables `enableDamping` around `setScale(1)` and `reset()` so
 * `OrbitControls.reset()`'s internal `update()` clears `sphericalDelta` and
 * `panOffset` instead of carrying swipe inertia past the reset.
 */
export function resetOrbitCamera(
  controls: OrbitControlsImpl | null,
  pose: OrbitCameraPose,
): boolean {
  if (!controls) {
    return false;
  }

  const wasDamping = controls.enableDamping;
  try {
    controls.enableDamping = false;
    controls.target0?.set(pose.target[0], pose.target[1], pose.target[2]);
    controls.position0?.set(pose.position[0], pose.position[1], pose.position[2]);
    controls.zoom0 = 1;
    controls.setScale?.(1);
    controls.reset();
  } finally {
    controls.enableDamping = wasDamping;
  }

  return true;
}

/** Props for {@link ViewerResetButton}. */
export interface ViewerResetButtonProps {
  onReset: () => void;
  disabled?: boolean;
}

/** Floating pill control that resets the 3D body model camera to its default pose. */
export const ViewerResetButton: React.FC<ViewerResetButtonProps> = ({
  onReset,
  disabled = false,
}) => (
  <TouchableOpacity
    style={[styles.button, disabled ? styles.buttonDisabled : null]}
    onPress={onReset}
    disabled={disabled}
    activeOpacity={0.8}
    hitSlop={8}
    testID="reset-view-button"
    accessibilityRole="button"
    accessibilityLabel="Reset 3D model position"
    accessibilityState={{ disabled }}
  >
    <RotateCcw size={15} color={theme.colors.text} />
    <Text style={styles.label}>Reset</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
});
