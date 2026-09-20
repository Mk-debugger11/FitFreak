import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';

interface ModalSheetProps {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  /** Rendered below the body, outside the scroll area (usually buttons). */
  footer?: React.ReactNode;
  /** Caps the body height and makes it scrollable — for long option lists. */
  scrollable?: boolean;
}

/** The centred dialog shared by every modal in the app. */
export const ModalSheet: React.FC<ModalSheetProps> = ({
  visible,
  title,
  children,
  footer,
  scrollable = false,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {scrollable ? (
          <ScrollView style={styles.scrollBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          children
        )}
        {footer}
      </View>
    </View>
  </Modal>
);

interface ModalOptionProps {
  label: string;
  onPress: () => void;
  /** Shown on the right of the row, e.g. an equipment type. */
  trailing?: React.ReactNode;
  /** Draws the label in the accent colour (selected, or a call to action). */
  highlighted?: boolean;
}

/** A single tappable row inside a `ModalSheet`. */
export const ModalOption: React.FC<ModalOptionProps> = ({
  label,
  onPress,
  trailing,
  highlighted = false,
}) => (
  <TouchableOpacity style={styles.option} onPress={onPress}>
    <View style={styles.optionRow}>
      <Text style={[styles.optionText, highlighted && styles.optionTextHighlighted]}>{label}</Text>
      {trailing}
    </View>
  </TouchableOpacity>
);

/** Placeholder text for a modal with nothing to list. */
export const ModalEmptyText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.emptyText}>{children}</Text>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  content: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.md,
  },
  scrollBody: {
    maxHeight: 300,
  },
  option: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  optionText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
  },
  optionTextHighlighted: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
    paddingVertical: theme.spacing.md,
    textAlign: 'center',
  },
});
