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

          // Partner build: keep the existing "nearest branch headlines, others behind a
          // picker sheet" layout, still gated on withinRadius/capacity.
          if (getPartnerId()) {
            return shopOptions.map((shop) => {
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
              const disabled =
                !shop.withinRadius || !shop.withinMaxDeliveryRadius || !shop.capacityAvailable;
              return (
                <Pressable
                  key={shop.branchId}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.shopCard,
                    selected && styles.shopCardSelected,
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

                  {!shop.capacityAvailable ? (
                    <View style={styles.warnPill}>
                      <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                      <Text style={styles.warnPillText}>Currently at capacity</Text>
                    </View>
                  ) : null}
                  {!shop.withinRadius || !shop.withinMaxDeliveryRadius ? (
                    <View style={styles.warnPill}>
                      <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                      <Text style={styles.warnPillText}>Outside delivery range</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            });
          }

          // Default (non-partner) build: every branch of every partner is its own row,
          // nearest-first. Distance no longer blocks selection — a far branch is just
          // visually de-emphasized (blur) while in-range branches are highlighted, so
          // customers can still deliberately pick a farther shop if they want to.
          // Capacity is a hard constraint (the shop truly can't take the order), so it
          // still disables the row.
          const allBranches = shopOptions.flatMap((shop) => shop.branches).sort((a, b) => a.distanceKm - b.distanceKm);

          return allBranches.map((branch) => {
            const selected = !form.autoDispatch && form.branchId === branch.branchId;
            const startingPriceLabel = startingPriceLabelFor(branch, flatBagFrom);
            const schedule = getTodayScheduleSummary(branch.operatingHours, branch.holidays);
            // Beyond the platform's hard delivery ceiling, checkout always rejects the
            // order — that must block selection outright, not just look dimmer, or the
            // customer walks through the whole flow only to hit a wall at quote time.
            const disabled = !branch.capacityAvailable || !branch.withinMaxDeliveryRadius;
            const far = !branch.withinRadius && branch.withinMaxDeliveryRadius;
            return (
              <Pressable
                key={branch.branchId}
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
                  setForm((f) => ({ ...f, branchId: branch.branchId, autoDispatch: false }));
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
              >
                <View style={styles.shopHeaderRow}>
                  <View style={styles.shopTitleGroup}>
                    {branch.logoUrl ? (
                      <Image source={{ uri: resolveMediaUrl(branch.logoUrl) }} style={styles.shopLogo} />
                    ) : (
                      <View style={styles.shopLogoFallback}>
                        <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.shopTitleTextGroup}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {branch.name}
                      </Text>
                      <View style={styles.shopMetaRow}>
                        <Ionicons name="location-outline" size={12} color={colors.muted} />
                        <Text style={styles.shopMetaText}>
                          {branch.city} · {branch.distanceLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.shopActionsGroup}>
                    <Pressable
                      onPress={() => toggleFavoriteBranch(branch.branchId)}
                      hitSlop={8}
                      style={styles.shopFavBtn}
                      accessibilityRole="button"
                      accessibilityLabel={
                        favoriteBranchIds.has(branch.branchId)
                          ? `Remove ${branch.name} from favorites`
                          : `Add ${branch.name} to favorites`
                      }
                    >
                      <Ionicons
                        name={favoriteBranchIds.has(branch.branchId) ? 'heart' : 'heart-outline'}
                        size={16}
                        color={favoriteBranchIds.has(branch.branchId) ? colors.destructive : colors.mutedForeground}
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

                {!branch.capacityAvailable ? (
                  <View style={styles.warnPill}>
                    <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                    <Text style={styles.warnPillText}>Currently at capacity</Text>
                  </View>
                ) : null}
                {!branch.withinMaxDeliveryRadius ? (
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
