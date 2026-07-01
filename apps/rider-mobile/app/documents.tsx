import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRiderOperations } from '../src/context/rider-operations';
import { Screen } from '../src/components/ui/screen';
import { DataLoadState } from '../src/components/data-load-state';
import { AuthenticatedImage } from '../src/components/authenticated-image';
import { riderFetch } from '../src/api';
import {
  RIDER_DOCUMENT_LABELS,
  RIDER_DOCUMENT_TYPES,
  type RiderDocumentType,
  type RiderKycDocument,
  type RiderMe,
} from '../src/lib/rider-types';
import { captureRiderDocument } from '../src/lib/rider-document';
import { useAuthStore } from '../src/store/auth';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const DOC_ICONS: Record<RiderDocumentType, IoniconName> = {
  drivers_license: 'card-outline',
  or_cr: 'document-text-outline',
  nbi_clearance: 'shield-checkmark-outline',
  selfie: 'camera-outline',
};

type DocStatus = 'approved' | 'pending' | 'rejected' | 'missing';

function resolveStatus(status?: string): DocStatus {
  if (status === 'approved') return 'approved';
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'missing';
}

const STATUS_CONFIG: Record<
  DocStatus,
  { label: string; pillBg: string; pillText: string; iconBg: string; iconColor: string }
> = {
  approved: {
    label: 'Approved',
    pillBg: colors.accentLight,
    pillText: colors.accentDark,
    iconBg: colors.accentLight,
    iconColor: colors.accentDark,
  },
  pending: {
    label: 'Pending review',
    pillBg: colors.warningBg,
    pillText: colors.warning,
    iconBg: colors.warningBg,
    iconColor: colors.warning,
  },
  rejected: {
    label: 'Rejected',
    pillBg: '#FEF2F2',
    pillText: colors.destructive,
    iconBg: '#FEF2F2',
    iconColor: colors.destructive,
  },
  missing: {
    label: 'Not uploaded',
    pillBg: colors.surfaceMuted,
    pillText: colors.mutedForeground,
    iconBg: colors.surfaceMuted,
    iconColor: colors.mutedForeground,
  },
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ approved, total }: { approved: number; total: number }) {
  const pct = total > 0 ? (approved / total) * 100 : 0;
  const allDone = approved === total;
  return (
    <View style={progressStyles.wrap}>
      <View style={progressStyles.top}>
        <Text style={progressStyles.label}>Verification progress</Text>
        <Text style={[progressStyles.count, allDone && progressStyles.countDone]}>
          {approved} / {total} approved
        </Text>
      </View>
      <View style={progressStyles.track}>
        <View
          style={[
            progressStyles.fill,
            { width: `${pct}%` as `${number}%` },
            allDone && progressStyles.fillDone,
          ]}
        />
      </View>
      {allDone ? (
        <View style={progressStyles.completePill}>
          <Ionicons name="checkmark-circle" size={14} color={colors.accentDark} />
          <Text style={progressStyles.completeText}>All documents verified — you can go online</Text>
        </View>
      ) : (
        <Text style={progressStyles.hint}>
          All 4 documents must be approved before you can start a shift.
        </Text>
      )}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: { ...typography.label },
  count: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  countDone: { color: colors.accentDark },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  fillDone: { backgroundColor: colors.accent },
  completePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  completeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentDark,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});

// ── Document card ─────────────────────────────────────────────────────────────

interface DocCardProps {
  type: RiderDocumentType;
  doc?: RiderKycDocument;
  uploading: boolean;
  onUpload: () => void;
}

function DocCard({ type, doc, uploading, onUpload }: DocCardProps) {
  const status = resolveStatus(doc?.status);
  const cfg = STATUS_CONFIG[status];
  const icon = DOC_ICONS[type];
  const label = RIDER_DOCUMENT_LABELS[type];

  return (
    <View style={cardStyles.card}>
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={[cardStyles.iconWrap, { backgroundColor: cfg.iconBg }]}>
          <Ionicons name={icon} size={20} color={cfg.iconColor} />
        </View>
        <View style={cardStyles.headerText}>
          <Text style={cardStyles.title}>{label}</Text>
          <View style={[cardStyles.statusPill, { backgroundColor: cfg.pillBg }]}>
            <Text style={[cardStyles.statusText, { color: cfg.pillText }]}>{cfg.label}</Text>
          </View>
        </View>
      </View>

      {/* Preview */}
      {doc?.fileUrl ? (
        <AuthenticatedImage
          path={doc.fileUrl}
          style={cardStyles.preview}
          accessibilityLabel={label}
        />
      ) : (
        <View style={cardStyles.placeholder}>
          <Ionicons name="image-outline" size={32} color={colors.mutedForeground} />
          <Text style={cardStyles.placeholderText}>No document uploaded yet</Text>
        </View>
      )}

      {/* Rejection reason */}
      {status === 'rejected' && doc?.rejectionReason ? (
        <View style={cardStyles.rejectionBanner}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
          <Text style={cardStyles.rejectionText}>{doc.rejectionReason}</Text>
        </View>
      ) : null}

      {/* Upload button */}
      <Pressable
        style={({ pressed }) => [
          cardStyles.uploadBtn,
          status === 'approved' && cardStyles.uploadBtnApproved,
          uploading && cardStyles.uploadBtnDisabled,
          pressed && !uploading && cardStyles.uploadBtnPressed,
        ]}
        onPress={onUpload}
        disabled={uploading}
        accessibilityRole="button"
      >
        <Ionicons
          name={uploading ? 'hourglass-outline' : doc?.fileUrl ? 'refresh-outline' : 'cloud-upload-outline'}
          size={16}
          color={status === 'approved' ? colors.accentDark : colors.primary}
        />
        <Text
          style={[
            cardStyles.uploadBtnText,
            status === 'approved' && cardStyles.uploadBtnTextApproved,
          ]}
        >
          {uploading ? 'Uploading…' : doc?.fileUrl ? 'Replace document' : 'Upload document'}
        </Text>
      </Pressable>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: spacing.xs },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  placeholder: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...typography.bodySm,
    color: colors.mutedForeground,
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    color: colors.destructive,
    fontWeight: '500',
    lineHeight: 18,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  uploadBtnApproved: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  uploadBtnDisabled: { opacity: 0.55 },
  uploadBtnPressed: { opacity: 0.8 },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  uploadBtnTextApproved: { color: colors.accentDark },
});

// ── Documents screen ──────────────────────────────────────────────────────────

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
      { text: 'Take photo', onPress: () => void uploadDocument(type, 'camera') },
      { text: 'Choose from library', onPress: () => void uploadDocument(type, 'library') },
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
      <Screen inStack scroll={false}>
        <DataLoadState loading error="" loadingMessage="Loading documents…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen
      inStack
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ProgressBar approved={approvedCount} total={RIDER_DOCUMENT_TYPES.length} />

      {RIDER_DOCUMENT_TYPES.map((type) => (
        <DocCard
          key={type}
          type={type}
          doc={documentsByType.get(type)}
          uploading={uploadingType === type}
          onUpload={() => pickUploadSource(type)}
        />
      ))}
    </Screen>
  );
}
