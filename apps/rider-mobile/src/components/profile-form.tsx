import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Labeled field ─────────────────────────────────────────────────────────────

export function Field({
  label,
  required,
  icon,
  locked,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: IoniconName;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <View style={fieldStyles.labelRow}>
        {icon ? <Ionicons name={icon} size={13} color={colors.mutedForeground} /> : null}
        <Text style={fieldStyles.label}>
          {label}
          {required ? <Text style={fieldStyles.required}> *</Text> : null}
        </Text>
        {locked ? (
          <Ionicons name="lock-closed-outline" size={12} color={colors.mutedForeground} />
        ) : null}
      </View>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.label,
    flex: 1,
  },
  required: { color: colors.destructive },
});

// ── Section ───────────────────────────────────────────────────────────────────

export function Section({
  icon,
  title,
  children,
}: {
  icon: IoniconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.wrap}>
      <View style={sectionStyles.header}>
        <View style={sectionStyles.iconWrap}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
});

// ── Error banner ──────────────────────────────────────────────────────────────

export function FormErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={errorStyles.banner}>
      <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
      <Text style={errorStyles.text}>{message}</Text>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.destructive,
    lineHeight: 18,
  },
});

// ── Save button ───────────────────────────────────────────────────────────────

export function SaveButton({ saving, onPress }: { saving: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        saveStyles.btn,
        saving && saveStyles.btnDisabled,
        pressed && !saving && saveStyles.btnPressed,
      ]}
      onPress={onPress}
      disabled={saving}
      accessibilityRole="button"
    >
      <Text style={saveStyles.text}>{saving ? 'Saving…' : 'Save changes'}</Text>
      {!saving ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
    </Pressable>
  );
}

const saveStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    ...shadow.elevated,
  },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export const profileFormStyles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameField: { flex: 1 },
});
