import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { AuthFormProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function AuthForm({ mode, tabs, showCountryPicker, termsText, showTrustBadges }: AuthFormProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {tabs && tabs.length > 1 ? (
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Text key={tab} style={[styles.tab, { color: theme.foreground, borderColor: theme.border }]}>
              {tab.toUpperCase()}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.fieldRow}>
        {showCountryPicker ? (
          <View style={[styles.countryPicker, { borderColor: theme.border }]}>
            <Text style={{ color: theme.foreground }}>+63</Text>
          </View>
        ) : null}
        <TextInput
          editable={false}
          placeholder={mode === 'signup' ? 'Mobile number' : 'Mobile number or email'}
          placeholderTextColor={theme.muted}
          style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
        />
      </View>
      <Pressable style={[styles.submit, { backgroundColor: theme.primary }]}>
        <Text style={[styles.submitLabel, { color: theme.background }]}>
          {mode === 'signup' ? 'Create account' : 'Continue'}
        </Text>
      </Pressable>
      {showTrustBadges ? (
        <Text style={[styles.trust, { color: theme.muted }]}>🔒 Secure · Verified partner network</Text>
      ) : null}
      {termsText ? <Text style={[styles.terms, { color: theme.muted }]}>{termsText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tab: { fontSize: 12, fontWeight: '700', borderBottomWidth: 2, paddingBottom: 4 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  countryPicker: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center' },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13 },
  submit: { marginTop: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  submitLabel: { fontSize: 14, fontWeight: '700' },
  trust: { fontSize: 11, textAlign: 'center', marginTop: 10 },
  terms: { fontSize: 10, textAlign: 'center', marginTop: 6 },
});
