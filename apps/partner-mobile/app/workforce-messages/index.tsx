import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EmployerWorkforceConversation } from '@lunara/types';
import { Screen } from '../../src/components/ui/screen';
import { partnerFetch } from '../../src/api';
import { colors, radius, spacing, typography } from '../../src/theme';

function formatTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationRow({ convo }: { convo: EmployerWorkforceConversation }) {
  const name = convo.recipient.name || (convo.recipient.role === 'rider' ? 'Rider' : 'Staff member');
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/workforce-messages/${convo._id}` as any)}
    >
      <View style={[styles.iconWrap, { backgroundColor: convo.recipient.role === 'rider' ? colors.primaryLight : colors.surfaceMuted }]}>
        <Ionicons
          name={convo.recipient.role === 'rider' ? 'bicycle-outline' : 'person-outline'}
          size={18}
          color={colors.primary}
        />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle}>{name}</Text>
          <Text style={styles.roleBadge}>{convo.recipient.role === 'rider' ? 'Rider' : 'Staff'}</Text>
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {convo.lastMessage?.content || 'No messages yet'}
        </Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowTime}>{formatTime(convo.updatedAt)}</Text>
        {convo.unreadCount > 0 ? (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{convo.unreadCount}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function WorkforceMessagesScreen() {
  const [conversations, setConversations] = useState<EmployerWorkforceConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await partnerFetch<EmployerWorkforceConversation[]>('/partner/workforce-messages');
      setConversations(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen inStack padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Team &amp; rider messages</Text>
        <Text style={styles.subtitle}>Direct threads with your staff and riders</Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <ConversationRow convo={item} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No conversations yet.</Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.heading, fontSize: 20 },
  subtitle: { ...typography.caption, marginTop: 2 },
  errorText: { ...typography.bodySm, color: colors.destructive, textAlign: 'center', paddingHorizontal: spacing.xl },
  emptyText: { ...typography.bodySm, color: colors.mutedForeground, textAlign: 'center' },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  roleBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.mutedForeground,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  rowPreview: { ...typography.caption, marginTop: 2 },
  rowMeta: { alignItems: 'flex-end', gap: spacing.xs },
  rowTime: { fontSize: 11, color: colors.mutedForeground },
  unreadDot: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: { fontSize: 10, fontWeight: '700', color: colors.onPrimary },
});
