import { RefreshControl, StyleSheet } from 'react-native';
import { useState } from 'react';
import { BannerStrip } from '../../src/components/banner-strip';
import { DataLoadState } from '../../src/components/data-load-state';
import { DealsCarousel } from '../../src/components/deals-carousel';
import { HomeActiveOrders } from '../../src/components/home-active-orders';
import { HomeQuickActions } from '../../src/components/home-quick-actions';
import { HomeRecommendedServices } from '../../src/components/home-recommended-services';
import { HomeReferralPromo } from '../../src/components/home-referral-promo';
import { HomeWelcomeBanner } from '../../src/components/home-welcome-banner';
import { Screen } from '../../src/components/ui/screen';
import { useHomeDashboard } from '../../src/hooks/use-home-dashboard';
import { spacing, colors } from '../../src/theme';

export default function HomeScreen() {
  const { user, profile, activeOrders, loading, error, refresh } = useHomeDashboard();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen
      inTab
      scroll
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <HomeWelcomeBanner profile={profile} user={user} />
      <DataLoadState loading={false} error={error} onRetry={refresh} />
      <HomeActiveOrders orders={activeOrders} loading={loading} />
      <HomeQuickActions firstActiveOrderId={activeOrders[0]?._id} />
      <DealsCarousel />
      <BannerStrip />
      <HomeRecommendedServices />
      <HomeReferralPromo />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
});
