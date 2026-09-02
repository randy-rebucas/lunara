import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { FormCardProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function FormCard({ title, description, fields, submitLabel }: FormCardProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {description ? <Text style={[styles.description, { color: theme.muted }]}>{description}</Text> : null}
      {fields.map((field) => (
        <View key={field.id} style={styles.field}>
          <Text style={[styles.fieldLabel, { color: theme.foreground }]}>
            {field.label}
            {field.required ? ' *' : ''}
          </Text>
          {field.type === 'toggle' ? (
            <View style={[styles.toggle, { borderColor: theme.border }]} />
          ) : (
            <TextInput
              editable={false}
              placeholder={field.placeholder}
              placeholderTextColor={theme.muted}
              style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
              multiline={field.type === 'textarea'}
            />
          )}
        </View>
      ))}
      <Pressable style={[styles.submit, { backgroundColor: theme.primary }]}>
        <Text style={[styles.submitLabel, { color: theme.background }]}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  description: { fontSize: 13, marginTop: 2, marginBottom: 8 },
  field: { marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  toggle: { width: 40, height: 22, borderRadius: 11, borderWidth: 1 },
  submit: { marginTop: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  submitLabel: { fontSize: 14, fontWeight: '700' },
});
