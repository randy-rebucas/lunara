import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { FaqProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

function FaqRow({ question, answer, borderColor, foreground, muted }: {
  question: string;
  answer: string;
  borderColor: string;
  foreground: string;
  muted: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable style={[styles.row, { borderColor }]} onPress={() => setOpen((o) => !o)}>
      <Text style={[styles.question, { color: foreground }]}>{question}</Text>
      {open ? <Text style={[styles.answer, { color: muted }]}>{answer}</Text> : null}
    </Pressable>
  );
}

export function Faq({ title, items }: FaqProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {items.map((item) => (
        <FaqRow
          key={item.id}
          question={item.question}
          answer={item.answer}
          borderColor={theme.border}
          foreground={theme.foreground}
          muted={theme.muted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  question: { fontSize: 14, fontWeight: '500' },
  answer: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
