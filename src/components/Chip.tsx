import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '../theme';

interface ChipProps {
  label: string;
  /** `option` chips are selectable (e.g. the equipment picker). */
  variant?: 'default' | 'option';
  selected?: boolean;
  onPress?: () => void;
  /** Shows a remove button when provided. */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'default',
  selected = false,
  onPress,
  onRemove,
  style,
}) => {
  const content = (
    <>
      <Text
        style={[
          variant === 'option' ? styles.optionText : styles.text,
          selected && styles.selectedText,
        ]}
      >
        {label}
      </Text>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove}>
          <X size={14} color={theme.colors.text} style={styles.removeIcon} />
        </TouchableOpacity>
      ) : null}
    </>
  );

  const containerStyle = [styles.chip, selected && styles.selectedChip, style];

  if (!onPress) {
    return <View style={containerStyle}>{content}</View>;
  }

  return (
    <TouchableOpacity style={containerStyle} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 32,
  },
  selectedChip: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  text: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
  },
  optionText: {
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  selectedText: {
    color: theme.colors.background,
  },
  removeIcon: {
    marginLeft: 6,
  },
});
