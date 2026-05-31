import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRiderOperations } from '../src/context/rider-operations';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { DataLoadState } from '../src/components/data-load-state';
import { resolveAuthenticatedMediaSource } from '../src/lib/media-url';
import { riderFetch } from '../src/api';
import {
  RIDER_DOCUMENT_LABELS,
  RIDER_DOCUMENT_TYPES,
  type RiderDocumentType,
  type RiderKycDocument,
  type RiderMe,
} from '../src/lib/rider-types';
import { captureRiderDocument, documentStatusLabel } from '../src/lib/rider-document';
import { useAuthStore } from '../src/store/auth';
import { colors, radius, spacing, typography } from '../src/theme';

function statusColor(status?: string) {
  switch (status) {
    case 'approved':
      return colors.accent;
    case 'pending':
      return colors.warning;
    case 'rejected':
      return colors.destructive;
    default:
      return colors.mutedForeground;
  }
}

export default function DocumentsScreen() {
  const apiUpload = useAuthStore((s) => s.apiUpload);
  const { refresh } = useRiderOperations();
  const [me, setMe] = useState<RiderMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [uploadingType, setUploadingType] = useState<RiderDocumentType | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await riderFetch<RiderMe>('/riders/me');
      setMe(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  function pickUploadSource(type: RiderDocumentType) {
    Alert.alert(RIDER_DOCUMENT_LABELS[type], 'Choose how to add this document', [
      {
        text: 'Take photo',
        onPress: () => void uploadDocument(type, 'camera'),
      },
      {
        text: 'Choose from library',
        onPress: () => void uploadDocument(type, 'library'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function uploadDocument(type: RiderDocumentType, source: 'camera' | 'library') {
    const captured = await captureRiderDocument(type, source);
    if (!captured) return;

    setUploadingType(type);
    try {
      const updated = await apiUpload<RiderMe>(`/riders/me/documents/${type}`, captured.formData);
      setMe(updated);
      refresh();
      Alert.alert('Uploaded', 'Your document was submitted for review.');
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload document');
    } finally {
      setUploadingType(null);
    }
  }

  const documentsByType = new Map<RiderDocumentType, RiderKycDocument>(
    (me?.documents ?? []).map((d) => [d.type, d]),
  );
  const approvedCount = me?.compliance?.approvedDocumentCount ?? 0;

  if (loading) {
    return (
      <Screen scroll={false}>
        <DataLoadState loading error="" loadingMessage="Loading documents…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll={false}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.subtitle}>
        Upload all required documents. An admin must approve each one before you can go online.
      </Text>
      <Text style={styles.progress}>
        {approvedCount} of {RIDER_DOCUMENT_TYPES.length} approved
      </Text>

      {RIDER_DOCUMENT_TYPES.map((type) => {
        const doc = documentsByType.get(type);
        const imageSource = doc?.fileUrl ? resolveAuthenticatedMediaSource(doc.fileUrl) : undefined;
        const uploading = uploadingType === type;

        return (
          <Card key={type} style={styles.docCard}>
            <View style={styles.docHeader}>
              <Text style={styles.docTitle}>{RIDER_DOCUMENT_LABELS[type]}</Text>
              <Text style={[styles.docStatus, { color: statusColor(doc?.status) }]}>
                {documentStatusLabel(doc?.status)}
              </Text>
            </View>

            {imageSource ? (
              <Image source={imageSource} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewPlaceholderText}>No upload yet</Text>
              </View>
            )}

            {doc?.status === 'rejected' && doc.rejectionReason ? (
              <Text style={styles.rejection}>Reason: {doc.rejectionReason}</Text>
            ) : null}

            <Pressable
              style={styles.uploadBtn}
              onPress={() => pickUploadSource(type)}
              disabled={uploading}
            >
              <Text style={styles.uploadBtnText}>
                {uploading
                  ? 'Uploading…'
                  : doc?.fileUrl
                    ? 'Replace document'
                    : 'Upload document'}
              </Text>
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...typography.bodySm, marginBottom: spacing.sm },
  progress: { ...typography.label, marginBottom: spacing.lg },
  docCard: { marginBottom: spacing.md, gap: spacing.sm },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  docTitle: { ...typography.subheading, fontSize: 16, flex: 1 },
  docStatus: { ...typography.bodySm, fontWeight: '700' },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  previewPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholderText: { ...typography.bodySm },
  rejection: { ...typography.bodySm, color: colors.destructive },
  uploadBtn: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  uploadBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
