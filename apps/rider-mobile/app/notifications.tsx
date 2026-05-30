import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lunara/config';
import { riderFetch } from '../src/api';

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
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.read && styles.unread]}>
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
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications yet — assignments appear here</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  unread: { borderColor: theme.colors.primary, backgroundColor: '#eef2ff' },
  title: { fontWeight: '700', fontSize: 15 },
  body: { marginTop: 6, color: '#64748b', lineHeight: 20 },
  date: { marginTop: 8, fontSize: 11, color: '#94a3b8' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});
