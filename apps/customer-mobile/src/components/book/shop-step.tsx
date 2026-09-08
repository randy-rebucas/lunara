import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import { getTodayScheduleSummary } from '@lunara/utils';
import { resolveMediaUrl } from '../../lib/media-url';
import { brandName, colors } from '../../theme';
import { getPartnerId } from '../../store/auth';
import type { BookingFormState } from '../../lib/booking-flow';
import {
  StepHeading,
  startingPriceLabelFor,
  styles,
  type BookingConfig,
  type ShopBranchVariant,
  type ShopOption,
} from './shared';

interface ShopStepProps {
  form: BookingFormState;
  setForm: Dispatch<SetStateAction<BookingFormState>>;
  config: BookingConfig | null;
  shopOptions: ShopOption[];
  shopsLoading: boolean;
  reorderNotice: string;
  setReorderNotice: Dispatch<SetStateAction<string>>;
  favoriteBranchIds: Set<string>;
  toggleFavoriteBranch: (branchId: string) => void;
  setBranchSheetShopId: Dispatch<SetStateAction<string | null>>;
}

/** Step "shop" of the booking flow — laundry shop/branch selection, including the partner-build
 * vs. default-build layouts and the auto-dispatch option. Extracted verbatim from `app/book.tsx`;
 * all business logic (favorites API calls, form validation) stays in the orchestrator. */
export function ShopStep({
  form,
  setForm,
  config,
  shopOptions,
  shopsLoading,
  reorderNotice,
  setReorderNotice,
  favoriteBranchIds,
  toggleFavoriteBranch,
  setBranchSheetShopId,
}: ShopStepProps) {
  return (
    <View>
      <StepHeading step="shop" title="Choose a laundry shop" />
      {reorderNotice ? <Text style={styles.optionGpsMissing}>{reorderNotice}</Text> : null}
      {!shopsLoading && shopOptions.length > 0 && !getPartnerId() ? (
        <Pressable
          style={({ pressed }) => [
            styles.shopCard,
            styles.autoDispatchCard,
            form.autoDispatch && styles.shopCardSelected,
            pressed && styles.shopCardPressed,
          ]}
          onPress={() => {
            setReorderNotice('');
            setForm((f) => ({ ...f, autoDispatch: true, branchId: '' }));
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: form.autoDispatch }}
        >
          <View style={styles.shopHeaderRow}>
            <View style={styles.shopTitleGroup}>
              <View style={styles.autoDispatchIcon}>
                <Ionicons name="flash" size={18} color={colors.primary} />
              </View>
              <View style={styles.shopTitleTextGroup}>
                <Text style={styles.shopName}>Let {brandName} pick for you</Text>
                <Text style={styles.shopMetaText}>
                  Best available shop nearby — handy when your usual spot is full.
                </Text>
              </View>
            </View>
            {form.autoDispatch ? (
              <View style={styles.shopCheckBadge}>
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
              </View>
            ) : null}
          </View>
        </Pressable>
      ) : null}
      {shopsLoading ? (
        <Text style={styles.sub}>Finding nearby shops…</Text>
      ) : shopOptions.length === 0 ? (
        <Text style={styles.sub}>No partner shops are available near this address yet.</Text>
      ) : (
        (() => {
          const flatBagFrom = config?.bagSizes?.length
            ? Math.min(...config.bagSizes.map((b) => b.price))
            : undefined;
          const isPartnerBuild = !!getPartnerId();

          // Every build groups shops by partner — one card per partner, its nearest branch
          // headlining and any others behind a picker sheet — matching customer-web's layout.
          // Sorted nearest-first so the closest partner always leads.
          const sortedShops = [...shopOptions].sort((a, b) => a.distanceKm - b.distanceKm);

          return sortedShops.map((shop) => {
            const selected =
              !form.autoDispatch &&
              (form.branchId === shop.branchId ||
                shop.branches.some((b) => b.branchId === form.branchId));
            const startingPriceLabel = startingPriceLabelFor(shop, flatBagFrom);
            const hasMultipleBranches = shop.branches.length > 1;
            // Once the customer has picked a specific branch from the sheet, the card
            // should reflect that branch (name/city/hours), not always the nearest one.
            const activeBranch: ShopOption | ShopBranchVariant =
              selected && form.branchId !== shop.branchId
                ? (shop.branches.find((b) => b.branchId === form.branchId) ?? shop)
                : shop;
            const schedule = getTodayScheduleSummary(activeBranch.operatingHours, activeBranch.holidays);
            // Partner builds hard-block out-of-radius shops. The default build only hard-blocks
            // the platform's delivery ceiling — an out-of-radius-but-in-ceiling shop is just
            // de-emphasized (blur) so customers can still deliberately pick a farther shop.
            const disabled = isPartnerBuild
              ? !activeBranch.withinRadius || !activeBranch.withinMaxDeliveryRadius || !activeBranch.capacityAvailable
              : !activeBranch.capacityAvailable || !activeBranch.withinMaxDeliveryRadius;
            const far =
              !isPartnerBuild && !activeBranch.withinRadius && activeBranch.withinMaxDeliveryRadius;
            return (
                <Pressable
                  key={shop.branchId}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.shopCard,
                    selected && styles.shopCardSelected,
                    far && styles.shopCardFar,
                    disabled && styles.shopCardDisabled,
                    pressed && !disabled && styles.shopCardPressed,
                  ]}
                  onPress={() => {
                    setReorderNotice('');
                    if (hasMultipleBranches) {
                      setBranchSheetShopId(shop.branchId);
                      return;
                    }
                    setForm((f) => ({ ...f, branchId: shop.branchId, autoDispatch: false }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                >
                  <View style={styles.shopHeaderRow}>
                    <View style={styles.shopTitleGroup}>
                      {shop.logoUrl ? (
                        <Image source={{ uri: resolveMediaUrl(shop.logoUrl) }} style={styles.shopLogo} />
                      ) : (
                        <View style={styles.shopLogoFallback}>
                          <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                        </View>
                      )}
                      <View style={styles.shopTitleTextGroup}>
                        <Text style={styles.shopName} numberOfLines={1}>
                          {activeBranch.name}
                        </Text>
                        <View style={styles.shopMetaRow}>
                          <Ionicons name="location-outline" size={12} color={colors.muted} />
                          <Text style={styles.shopMetaText}>
                            {activeBranch.city} · {activeBranch.distanceLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.shopActionsGroup}>
                      <Pressable
                        onPress={() => toggleFavoriteBranch(shop.branchId)}
                        hitSlop={8}
                        style={styles.shopFavBtn}
                        accessibilityRole="button"
                        accessibilityLabel={
                          favoriteBranchIds.has(shop.branchId)
                            ? `Remove ${shop.name} from favorites`
                            : `Add ${shop.name} to favorites`
                        }
                      >
                        <Ionicons
                          name={favoriteBranchIds.has(shop.branchId) ? 'heart' : 'heart-outline'}
                          size={16}
                          color={favoriteBranchIds.has(shop.branchId) ? colors.destructive : colors.mutedForeground}
                        />
                      </Pressable>
                      {selected ? (
                        <View style={styles.shopCheckBadge}>
                          <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.shopStatusRow}>
                    <View
                      style={[styles.statusPill, schedule.isOpenNow ? styles.statusPillOpen : styles.statusPillClosed]}
                    >
                      <View
                        style={[styles.statusDot, schedule.isOpenNow ? styles.statusDotOpen : styles.statusDotClosed]}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          schedule.isOpenNow ? styles.statusPillTextOpen : styles.statusPillTextClosed,
                        ]}
                      >
                        {schedule.label}
                      </Text>
                    </View>
                    {startingPriceLabel ? <Text style={styles.shopPriceTag}>{startingPriceLabel}</Text> : null}
                  </View>

                  {hasMultipleBranches ? (
                    <View style={styles.branchChip}>
                      <Ionicons name="git-branch-outline" size={13} color={colors.primary} />
                      <Text style={styles.branchChipText}>
                        {selected
                          ? `${shop.branches.length} branches near you — tap to change`
                          : `${shop.branches.length} branches near you — tap to choose`}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                    </View>
                  ) : null}

                  {!activeBranch.capacityAvailable ? (
                    <View style={styles.warnPill}>
                      <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                      <Text style={styles.warnPillText}>Currently at capacity</Text>
                    </View>
                  ) : null}
                  {!activeBranch.withinMaxDeliveryRadius ? (
                    <View style={styles.warnPill}>
                      <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                      <Text style={styles.warnPillText}>Outside delivery range</Text>
                    </View>
                  ) : far ? (
                    <View style={styles.warnPill}>
                      <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                      <Text style={styles.warnPillText}>Farther than usual — may need extra approval</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            });
        })()
      )}
    </View>
  );
}
