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
import { buildDealSharePayload, formatCurrency, formatDealExpiry, formatDealMinimum } from '@lunara/utils';
import { useAuthStore } from '../store/auth';
import { shareNative } from '../lib/share';
import { colors, radius, shadow, spacing, typography } from '../theme';

const CARD_GAP = spacing.md;
const DEAL_ACCENTS = [colors.primary, colors.secondary, colors.accent] as const;

function formatDealDiscount(deal: Pick<Deal, 'discountType' | 'discountValue'>): string {
  if (deal.discountType === 'percent') return `${deal.discountValue}% off`;
  return `${formatCurrency(deal.discountValue)} off`;
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
    router.push({ pathname: '/book', params: { code: deal.code } });
  }

  function handleShareDeal(deal: Deal) {
    const payload = buildDealSharePayload(deal, getShareWebsiteUrl(), appConfig.name);
    void shareNative(payload);
  }

  const renderItem: ListRenderItem<Deal> = ({ item, index }) => {
    const accent = DEAL_ACCENTS[index % DEAL_ACCENTS.length];
    const minimum = formatDealMinimum(item);
    const expiry = formatDealExpiry(item.expiresAt ?? item.endsAt);

    return (
      <Pressable
        onPress={() => handleDealPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${formatDealDiscount(item)}. Code ${item.code}`}
        style={({ pressed }) => [
          styles.card,
          shadow.elevated,
          { width: cardWidth, backgroundColor: accent },
          pressed && styles.cardPressed,
        ]}
      >
        <Ionicons name="sparkles" size={18} color="rgba(255,255,255,0.55)" style={styles.sparkle} />

        <View style={styles.cardTopActions}>
          <Pressable
            style={styles.shareBtn}
            onPress={() => handleShareDeal(item)}
            hitSlop={8}
            accessibilityLabel="Share deal"
          >
            <Ionicons name="share-social-outline" size={16} color={colors.onPrimary} />
          </Pressable>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTextCol}>
            <View style={styles.badge}>
              <Ionicons
                name={item.isPersonal ? 'gift' : 'flame'}
                size={13}
                color={accent}
              />
              <Text style={[styles.badgeText, { color: accent }]}>
                {item.isPersonal ? 'JUST FOR YOU' : 'HOT DEAL'}
              </Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description || formatDealDiscount(item)}
            </Text>

            <View style={styles.codeChip}>
              <Text style={styles.codeLabel}>CODE</Text>
              <Text style={styles.code}>{item.code}</Text>
              <Ionicons name="copy-outline" size={14} color="rgba(255,255,255,0.85)" />
            </View>

            <View style={styles.ctaRow}>
              <Text style={[styles.cta, { color: accent }]}>Book now</Text>
              <Ionicons name="arrow-forward" size={15} color={accent} />
            </View>
          </View>

          <View style={styles.tagCol}>
            <View style={styles.tag}>
              <Text style={[styles.tagValue, { color: accent }]}>{formatDealDiscount(item).split(' ')[0]}</Text>
              <Text style={[styles.tagUnit, { color: accent }]}>OFF</Text>
            </View>
            {minimum ? <Text style={styles.minimum}>{minimum}</Text> : null}
            {expiry ? <Text style={styles.expiry}>{expiry}</Text> : null}
          </View>
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
    minHeight: 188,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.92 },
  sparkle: { position: 'absolute', top: spacing.lg, right: spacing.xl + 64 },
  cardTopActions: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flexDirection: 'row', flex: 1 },
  cardTextCol: { flex: 1, paddingRight: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.onPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.88)',
    marginBottom: spacing.md,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    marginBottom: spacing.md,
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
  tagCol: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    transform: [{ rotate: '6deg' }],
  },
  tagValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  tagUnit: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: -2 },
  minimum: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
    textAlign: 'right',
  },
  expiry: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
    textAlign: 'right',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    marginTop: 'auto',
  },
  cta: { fontSize: 13, fontWeight: '700', color: colors.foreground },
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
