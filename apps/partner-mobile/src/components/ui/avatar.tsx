import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';

interface AvatarProps {
  name: string;
  size?: number;
  bg?: string;
  fg?: string;
}

const PALETTE: { bg: string; fg: string }[] = [
  { bg: '#FEE2E2', fg: '#B91C1C' },
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FEF3C7', fg: '#92400E' },
];

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({ name, size = 40, bg, fg }: AvatarProps) {
  const initials = initialsOf(name) || '?';
  const colorsForName = paletteFor(name || '?');
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: bg ?? colorsForName.bg,
        },
      ]}
    >
      <Text style={[styles.text, { color: fg ?? colorsForName.fg, fontSize: size * 0.4 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700', color: colors.primaryDark },
});
