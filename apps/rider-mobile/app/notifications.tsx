import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { riderFetch } from '../src/api';
import { spacing, typography } from '../src/theme';

interface RiderNotification {
  _id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<RiderNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await riderFetch<RiderNotification[]>('/riders/notifications');
    setItems(data);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen inStack>
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Card primary={!item.read} style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleString('en-PH', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications yet — assignments appear here</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm + 2 },
  title: { ...typography.subheading, fontSize: 15 },
  body: { marginTop: spacing.xs + 2, ...typography.bodySm, lineHeight: 20 },
  date: { marginTop: spacing.sm, ...typography.caption },
  empty: { ...typography.caption, textAlign: 'center', marginTop: spacing.xxxl },
  list: { flex: 1 },
});
