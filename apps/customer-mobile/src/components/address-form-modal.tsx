import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { KeyboardSafeScrollView } from './ui/keyboard-safe-scroll-view';
import { AddressType } from '@lunara/types';
import { ADDRESS_TYPE_OPTIONS, defaultLabelForAddressType } from '@lunara/utils';
import type { AddressFormValues, CustomerAddress } from '../lib/profile-types';
import { emptyAddressForm } from '../lib/profile-types';
import { reverseGeocodeAddress } from '../lib/reverse-geocode';
import { colors, radius, spacing, typography } from '../theme';

function selectAddressType(form: AddressFormValues, addressType: AddressType): AddressFormValues {
  const suggested = defaultLabelForAddressType(addressType);
  const labelStillDefault = ADDRESS_TYPE_OPTIONS.some((o) => o.label === form.label);
  return {
    ...form,
    addressType,
    label: labelStillDefault ? suggested : form.label,
  };
}

interface AddressFormModalProps {
  visible: boolean;
  editing?: CustomerAddress | null;
  hasAddresses: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: AddressFormValues) => Promise<void>;
}

export function AddressFormModal({
  visible,
  editing,
  hasAddresses,
  saving,
  onClose,
  onSave,
}: AddressFormModalProps) {
  const [form, setForm] = useState<AddressFormValues>(emptyAddressForm());
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (editing) {
      setForm({
        label: editing.label,
        addressType: (editing.addressType as AddressType) ?? AddressType.HOME,
        line1: editing.line1,
        line2: editing.line2 ?? '',
        city: editing.city,
        province: editing.province,
        postalCode: editing.postalCode,
        latitude: editing.latitude,
        longitude: editing.longitude,
        isDefault: editing.isDefault,
      });
    } else {
      setForm({ ...emptyAddressForm(), isDefault: !hasAddresses });
    }
  }, [visible, editing, hasAddresses]);

  async function useCurrentLocation() {
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location access needed',
          'Allow location access so Lunara can pin your pickup address accurately.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = position.coords;

      let geocoded: Awaited<ReturnType<typeof reverseGeocodeAddress>> = null;
      try {
        geocoded = await reverseGeocodeAddress(latitude, longitude);
      } catch {
        /* coords still useful without address text */
      }

      setForm((f) => ({
        ...f,
        latitude,
        longitude,
        ...(geocoded
          ? {
              line1: geocoded.line1 || f.line1,
              line2: geocoded.line2 || f.line2,
              city: geocoded.city || f.city,
              province: geocoded.province || f.province,
              postalCode: geocoded.postalCode || f.postalCode,
            }
          : {}),
      }));

      if (!geocoded) {
        setError('Location pinned. Review or complete the address fields below.');
      }
    } catch {
      setError('Could not get your location. Try again or enter the address manually.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    setError('');
    if (!form.label.trim() || !form.line1.trim() || !form.city.trim() || !form.province.trim() || !form.postalCode.trim()) {
      setError('Fill in label, street, city, province, and postal code.');
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      setError('Pin your location so riders can navigate. Tap "Use current location".');
      return;
    }
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save address');
    }
  }

  const hasCoords = form.latitude != null && form.longitude != null;
  const insets = useSafeAreaInsets();
  const modalKeyboardOffset = Platform.OS === 'ios' ? insets.top + 56 : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={modalKeyboardOffset}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? 'Edit address' : 'Add address'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          <KeyboardSafeScrollView
            avoiding={false}
            contentContainerStyle={styles.form}
          >
          <Text style={styles.lead}>
            Pin your location so riders can navigate. We save GPS coordinates with your address.
          </Text>

          <Button
            label={locating ? 'Getting location & address…' : 'Use current location'}
            variant="secondary"
            onPress={useCurrentLocation}
            disabled={locating || saving}
            style={styles.locationBtn}
          />
          {hasCoords ? (
            <View style={styles.coordsChip}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={styles.coordsText}>
                {form.latitude!.toFixed(5)}, {form.longitude!.toFixed(5)}
              </Text>
            </View>
          ) : (
            <Text style={styles.coordsHint}>
              GPS pin required — tap above to fill your address from location
            </Text>
          )}

          <Text style={styles.fieldGroupLabel}>Address type</Text>
          <View style={styles.typeRow}>
            {ADDRESS_TYPE_OPTIONS.map((option) => {
              const selected = form.addressType === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.typeChip, selected && styles.typeChipActive]}
                  onPress={() => setForm((f) => selectAddressType(f, option.value))}
                >
                  <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            style={styles.field}
            placeholder="Label (e.g. Home, Office)"
            value={form.label}
            onChangeText={(label) => setForm((f) => ({ ...f, label }))}
          />
          <Input
            style={styles.field}
            placeholder="Street address"
            value={form.line1}
            onChangeText={(line1) => setForm((f) => ({ ...f, line1 }))}
          />
          <Input
            style={styles.field}
            placeholder="Unit / building (optional)"
            value={form.line2}
            onChangeText={(line2) => setForm((f) => ({ ...f, line2 }))}
          />
          <Input
            style={styles.field}
            placeholder="City"
            value={form.city}
            onChangeText={(city) => setForm((f) => ({ ...f, city }))}
          />
          <Input
            style={styles.field}
            placeholder="Province"
            value={form.province}
            onChangeText={(province) => setForm((f) => ({ ...f, province }))}
          />
          <Input
            style={styles.field}
            placeholder="Postal code"
            value={form.postalCode}
            onChangeText={(postalCode) => setForm((f) => ({ ...f, postalCode }))}
            keyboardType="number-pad"
          />

          <View style={styles.defaultRow}>
            <View style={styles.defaultCopy}>
              <Text style={styles.defaultLabel}>Default address</Text>
              <Text style={styles.defaultHint}>Used first when booking laundry</Text>
            </View>
            <Switch
              value={form.isDefault}
              onValueChange={(isDefault) => setForm((f) => ({ ...f, isDefault }))}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={form.isDefault ? colors.primary : colors.surface}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={saving ? 'Saving…' : editing ? 'Save changes' : 'Add address'}
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          />
          </KeyboardSafeScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { ...typography.heading, fontSize: 18 },
  form: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  lead: { ...typography.bodySm, marginBottom: spacing.lg },
  locationBtn: { width: '100%', marginBottom: spacing.sm },
  coordsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  coordsText: { fontSize: 12, fontWeight: '600', color: colors.primaryDark },
  coordsHint: { ...typography.caption, marginBottom: spacing.lg },
  fieldGroupLabel: { ...typography.label, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeChipText: { fontSize: 13, fontWeight: '500', color: colors.muted },
  typeChipTextActive: { color: colors.primary, fontWeight: '600' },
  field: { marginBottom: spacing.md },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  defaultCopy: { flex: 1, marginRight: spacing.md },
  defaultLabel: { fontSize: 15, fontWeight: '600', color: colors.foreground },
  defaultHint: { ...typography.caption, marginTop: spacing.xs },
  error: { color: colors.destructive, marginBottom: spacing.md, fontSize: 14 },
  saveBtn: { width: '100%' },
});
