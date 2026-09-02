import { ScrollView, Text, RefreshControl, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppConfig } from '../../src/config/config-context';
import { useTheme } from '../../src/theme/theme-provider';
import { useAppConfigStore } from '../../src/store/app-config-store';
import { BlockList } from '../../src/blocks/block-list';

const PARTNER_SLUG = process.env.EXPO_PUBLIC_PARTNER_SLUG?.trim() || 'lunara-demo';

export default function Screen() {
  const { screenKey } = useLocalSearchParams<{ screenKey: string }>();
  const config = useAppConfig();
  const theme = useTheme();
  const { status, load } = useAppConfigStore();
  const screen = config?.screens.find((s) => s.key === screenKey);

  if (!screen) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.foreground }}>Screen not found: {screenKey}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={status === 'loading'}
            onRefresh={() => load(PARTNER_SLUG)}
            tintColor={theme.primary}
          />
        }
      >
        {screen.blocks.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>Nothing here yet.</Text>
        ) : (
          <BlockList blocks={screen.blocks} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 14 },
});
