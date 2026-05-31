import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import type { Deal } from '@lunara/types';
import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildDealSharePayload, formatCurrency } from '@lunara/utils';
import { useAuthStore } from '../store/auth';
import { shareNative } from '../lib/share';
import { colors, radius, shadow, spacing, typography } from '../theme';

const CARD_GAP = spacing.md;
const DEAL_ACCENTS = [colors.primary, colors.secondary, colors.accent] as const;

function formatDealDiscount(deal: Pick<Deal, 'discountType' | 'discountValue'>): string {
  if (deal.discountType === 'percent') return `${deal.discountValue}% off`;
  return `${formatCurrency(deal.discountValue)} off`;
}

function formatDealMinimum(deal: Pick<Deal, 'minOrderAmount'>): string | null {
  if (deal.minOrderAmount <= 0) return null;
  return `Min. order ${formatCurrency(deal.minOrderAmount)}`;
}

interface DealsCarouselProps {
  onDealPress?: (deal: Deal) => void;
}

export function DealsCarousel({ onDealPress }: DealsCarouselProps) {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<Deal>>(null);

  const cardWidth = screenWidth - spacing.xl * 2;
  const snapInterval = cardWidth + CARD_GAP;

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async () => {
    setError('');
    try {
      const items = await apiFetch<Deal[]>('/deals');
      setDeals(items);
      setActiveIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load deals');
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
    setActiveIndex(Math.max(0, Math.min(index, deals.length - 1)));
  }

  function handleDealPress(deal: Deal) {
    if (onDealPress) {
      onDealPress(deal);
      return;
    }
    router.push('/book');
  }

  function handleShareDeal(deal: Deal) {
    const payload = buildDealSharePayload(deal, getShareWebsiteUrl(), appConfig.name);
    void shareNative(payload);
  }

  const renderItem: ListRenderItem<Deal> = ({ item, index }) => {
    const accent = DEAL_ACCENTS[index % DEAL_ACCENTS.length];
    const minimum = formatDealMinimum(item);

    return (
      <Pressable
        onPress={() => handleDealPress(item)}
        style={({ pressed }) => [
          styles.card,
          shadow.elevated,
          { width: cardWidth, backgroundColor: accent },
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.badge}>
            <Ionicons name="pricetag" size={14} color={accent} />
            <Text style={[styles.badgeText, { color: accent }]}>Deal</Text>
          </View>
          <View style={styles.cardTopActions}>
            <Pressable
              style={styles.shareBtn}
              onPress={() => handleShareDeal(item)}
              hitSlop={8}
              accessibilityLabel="Share deal"
            >
              <Ionicons name="share-social-outline" size={18} color={colors.onPrimary} />
            </Pressable>
            <Text style={styles.discount}>{formatDealDiscount(item)}</Text>
          </View>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

        <View style={styles.cardFooter}>
          <View style={styles.codeChip}>
            <Text style={styles.codeLabel}>Code</Text>
            <Text style={styles.code}>{item.code}</Text>
          </View>
          {minimum ? <Text style={styles.minimum}>{minimum}</Text> : null}
        </View>

        <View style={styles.ctaRow}>
          <Text style={styles.cta}>Book now</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deals for you</Text>
        <View style={[styles.loadingBox, { width: cardWidth }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deals for you</Text>
        <Pressable style={[styles.errorBox, { width: cardWidth }]} onPress={load}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  if (deals.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Deals for you</Text>
        <Text style={styles.sectionHint}>Swipe for more</Text>
      </View>

      <FlatList
        ref={listRef}
        data={deals}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        horizontal
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
      />

      {deals.length > 1 ? (
        <View style={styles.dots}>
          {deals.map((deal, index) => (
            <View
              key={deal._id}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.subheading, fontSize: 17 },
  sectionHint: { ...typography.caption },
  listContent: {
    paddingRight: spacing.xl,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginRight: CARD_GAP,
    minHeight: 168,
  },
  cardPressed: { opacity: 0.92 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  discount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.88)',
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 'auto',
    marginBottom: spacing.md,
  },
  codeChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  code: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: 1,
  },
  minimum: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cta: { fontSize: 13, fontWeight: '600', color: colors.onPrimary },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    marginTop: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },
  loadingBox: {
    height: 168,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  errorText: { ...typography.bodySm, color: colors.destructive },
  retryText: { ...typography.caption, marginTop: spacing.xs, color: colors.primary },
});
