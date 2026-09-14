import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ChatMessage, MessageAttachment, RiderConversation } from '@lunara/types';
import { riderMessagingFetch, riderMessagingUpload } from '../src/api';
import { getApiOrigin } from '../src/api-config';
import { Screen } from '../src/components/ui/screen';
import { useRiderMessagingSocket } from '../src/hooks/use-rider-messaging-socket';
import { pickMessageImage } from '../src/lib/message-attachment';
import type { UploadFile } from '../src/lib/offline/types';
import { useAuthStore } from '../src/store/auth';
import { colors, radius, spacing, typography } from '../src/theme';

// LocalStorageService.uploadBuffer already returns a full absolute URL for message attachments
// (they're served publicly under /uploads/public, no auth header needed) — resolving a relative
// path here only matters for defensiveness against a future/legacy relative value.
function resolveMediaUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${getApiOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  const url = resolveMediaUrl(attachment.url);
  if (attachment.mimeType.startsWith('image/')) {
    return (
      <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="imagebutton">
        <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="button"
      style={styles.fileChip}
    >
      <Ionicons name="document-text-outline" size={16} color={colors.primary} />
      <Text style={styles.fileChipText} numberOfLines={1}>
        {attachment.filename}
      </Text>
    </Pressable>
  );
}

function MessageBubble({ msg, myId }: { msg: ChatMessage; myId: string }) {
  const isOwn = msg.senderId === myId;
  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn ? <Text style={styles.senderName}>{msg.senderName}</Text> : null}
        {msg.content ? <Text style={styles.bubbleText}>{msg.content}</Text> : null}
        {msg.attachments.map((a) => (
          <View key={a.url} style={styles.attachmentWrap}>
            <AttachmentView attachment={a} />
          </View>
        ))}
        <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>{formatTime(msg.createdAt)}</Text>
      </View>
    </View>
  );
}

type Channel = 'employer' | 'admin';

const CHANNEL_BASE: Record<Channel, string> = {
  employer: '/riders/employer-messages',
  admin: '/riders/messages',
};

export default function MessagesScreen() {
  const myId = useAuthStore((s) => s.user?.id ?? '');
  const [channel, setChannel] = useState<Channel>('employer');
  const [employerAvailable, setEmployerAvailable] = useState<boolean | null>(null);
  const [conversation, setConversation] = useState<RiderConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const [pendingPreviewUri, setPendingPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const base = CHANNEL_BASE[channel];

  const loadMessages = useCallback(async (convId: string, channelBase: string) => {
    const res = await riderMessagingFetch<{ items: ChatMessage[] }>(`${channelBase}/${convId}/messages`);
    setMessages(res.items);
    await riderMessagingFetch(`${channelBase}/${convId}/read`, { method: 'PATCH' }).catch(() => {});
  }, []);

  // Probe the employer channel once on mount — riders without a connected partner get a 404 and
  // fall back to admin-only (no employer tab shown at all), per product decision.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await riderMessagingFetch<RiderConversation>('/riders/employer-messages');
        if (!cancelled) setEmployerAvailable(true);
      } catch {
        if (!cancelled) {
          setEmployerAvailable(false);
          setChannel('admin');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAll = useCallback(async () => {
    if (employerAvailable === null && channel === 'employer') return;
    setLoading(true);
    setError('');
    setConversation(null);
    setMessages([]);
    try {
      const convo = await riderMessagingFetch<RiderConversation>(base);
      setConversation(convo);
      await loadMessages(convo._id, base);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [loadMessages, base, channel, employerAvailable]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const scrollToEnd = useCallback((animated: boolean) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);

  const messagesLen = messages.length;
  useEffect(() => {
    scrollToEnd(messagesLen > 1);
  }, [messagesLen, scrollToEnd]);

  useRiderMessagingSocket({
    conversationId: conversation?._id ?? null,
    onNewMessage: (msg) => {
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      if (conversation) {
        void riderMessagingFetch(`${base}/${conversation._id}/read`, { method: 'PATCH' }).catch(() => {});
      }
    },
  });

  function removePending() {
    setPendingAttachment(null);
    setPendingPreviewUri(null);
  }

  async function attachFrom(source: 'camera' | 'library') {
    const picked = await pickMessageImage(source);
    if (!picked || !conversation) return;
    setPendingPreviewUri(picked.uri);
    setUploading(true);
    try {
      const att = await uploadAttachment(conversation._id, picked);
      setPendingAttachment(att);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
      setPendingPreviewUri(null);
    } finally {
      setUploading(false);
    }
  }

  async function uploadAttachment(conversationId: string, file: UploadFile): Promise<MessageAttachment> {
    return riderMessagingUpload<MessageAttachment>(`${base}/${conversationId}/upload`, file);
  }

  function handleAttachPress() {
    if (uploading || !conversation) return;
    Alert.alert('Attach photo', undefined, [
      { text: 'Take photo', onPress: () => void attachFrom('camera') },
      { text: 'Choose from library', onPress: () => void attachFrom('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSend() {
    if (!conversation) return;
    const trimmed = content.trim();
    if (!trimmed && !pendingAttachment) return;
    setSending(true);
    try {
      const msg = await riderMessagingFetch<ChatMessage>(`${base}/${conversation._id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          attachments: pendingAttachment ? [pendingAttachment] : [],
        }),
      });
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      setContent('');
      removePending();
    } catch (e) {
      Alert.alert('Failed to send', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  const canSend = useMemo(
    () => !sending && !uploading && !!conversation && (content.trim().length > 0 || !!pendingAttachment),
    [sending, uploading, conversation, content, pendingAttachment],
  );

  return (
    <Screen inStack padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>
          {channel === 'employer' ? 'Direct channel with your employer' : 'Direct support channel with Lunara'}
        </Text>
        {employerAvailable ? (
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setChannel('employer')}
              style={[styles.tab, channel === 'employer' && styles.tabActive]}
            >
              <Text style={[styles.tabText, channel === 'employer' && styles.tabTextActive]}>My Employer</Text>
            </Pressable>
            <Pressable
              onPress={() => setChannel('admin')}
              style={[styles.tab, channel === 'admin' && styles.tabActive]}
            >
              <Text style={[styles.tabText, channel === 'admin' && styles.tabTextActive]}>Lunara Support</Text>
            </Pressable>
          </View>
        ) : null}
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
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={listRef}
            style={styles.flex}
            data={messages}
            keyExtractor={(m) => m._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <MessageBubble msg={item} myId={myId} />}
            onContentSizeChange={() => scrollToEnd(false)}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No messages yet. Send the first one below.</Text>
              </View>
            }
          />

          <View style={styles.composeBar}>
            {pendingPreviewUri ? (
              <View style={styles.previewRow}>
                <Image source={{ uri: pendingPreviewUri }} style={styles.previewImage} />
                {uploading ? <ActivityIndicator size="small" color={colors.primary} style={styles.previewSpinner} /> : null}
                <Pressable onPress={removePending} style={styles.previewRemove} accessibilityLabel="Remove attachment">
                  <Ionicons name="close" size={14} color={colors.foreground} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.composeRow}>
              <Pressable
                onPress={handleAttachPress}
                disabled={uploading || !conversation}
                style={[styles.attachButton, (uploading || !conversation) && styles.disabled]}
                accessibilityLabel="Attach photo"
              >
                <Ionicons name="attach" size={20} color={colors.primary} />
              </Pressable>

              <TextInput
                style={styles.input}
                placeholder="Type a message…"
                placeholderTextColor={colors.mutedForeground}
                value={content}
                onChangeText={setContent}
                editable={!!conversation && !sending}
                multiline
              />

              <Pressable
                onPress={() => void handleSend()}
                disabled={!canSend}
                style={[styles.sendButton, !canSend && styles.disabled]}
                accessibilityLabel="Send message"
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="send" size={16} color={colors.onPrimary} />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.heading, fontSize: 22 },
  subtitle: { ...typography.caption, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.caption, color: colors.mutedForeground },
  tabTextActive: { color: colors.onPrimary },
  errorText: { ...typography.bodySm, color: colors.destructive, textAlign: 'center', paddingHorizontal: spacing.xl },
  emptyText: { ...typography.bodySm, color: colors.mutedForeground, textAlign: 'center' },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: spacing.sm },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleOwn: { backgroundColor: colors.primaryLight, borderBottomRightRadius: radius.sm },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  senderName: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  bubbleText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: colors.mutedForeground, marginTop: spacing.xs },
  bubbleTimeOwn: { textAlign: 'right' },
  attachmentWrap: { marginTop: spacing.xs },
  attachmentImage: { width: 180, height: 140, borderRadius: radius.md },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: 220,
  },
  fileChipText: { fontSize: 12, color: colors.primary, flexShrink: 1 },
  composeBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  previewImage: { width: 48, height: 48, borderRadius: radius.md },
  previewSpinner: { marginLeft: -36 },
  previewRemove: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.foreground,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
