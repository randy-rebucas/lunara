import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRiderOperations } from '../../src/context/rider-operations';
import { Input } from '../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { Screen } from '../../src/components/ui/screen';
import { DataLoadState } from '../../src/components/data-load-state';
import { riderFetch } from '../../src/api';
import { VEHICLE_TYPES, type RiderMe, type VehicleType } from '../../src/lib/rider-types';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ── Labeled field ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  icon,
  locked,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: IoniconName;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <View style={fieldStyles.labelRow}>
        {icon ? <Ionicons name={icon} size={13} color={colors.mutedForeground} /> : null}
        <Text style={fieldStyles.label}>
          {label}
          {required ? <Text style={fieldStyles.required}> *</Text> : null}
        </Text>
        {locked ? (
          <Ionicons name="lock-closed-outline" size={12} color={colors.mutedForeground} />
        ) : null}
      </View>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.label,
    flex: 1,
  },
  required: { color: colors.destructive },
});

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: IoniconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.wrap}>
      <View style={sectionStyles.header}>
        <View style={sectionStyles.iconWrap}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
});

// ── Vehicle chip ──────────────────────────────────────────────────────────────

const VEHICLE_ICONS: Record<string, IoniconName> = {
  motorcycle: 'flash-outline',
  bicycle: 'bicycle',
  car: 'car-outline',
  van: 'bus-outline',
};

function VehicleChip({
  type,
  active,
  onPress,
}: {
  type: string;
  active: boolean;
  onPress: () => void;
}) {
  const icon = VEHICLE_ICONS[type] ?? 'car-outline';
  return (
    <Pressable
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
    >
      <Ionicons name={icon} size={16} color={active ? colors.primary : colors.mutedForeground} />
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'capitalize',
  },
  textActive: { color: colors.primary },
});

// ── Edit profile screen ───────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const router = useRouter();
  const { refresh } = useRiderOperations();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [orCrNumber, setOrCrNumber] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await riderFetch<RiderMe>('/riders/me');
      setFirstName(data.firstName ?? data.user?.firstName ?? '');
      setLastName(data.lastName ?? data.user?.lastName ?? '');
      setEmail(data.user?.email ?? '');
      setPhone(data.user?.phone ?? '');
      setLine1(data.homeAddress?.line1 ?? '');
      setLine2(data.homeAddress?.line2 ?? '');
      setCity(data.homeAddress?.city ?? '');
      setProvince(data.homeAddress?.province ?? '');
      setPostalCode(data.homeAddress?.postalCode ?? '');
      setVehicleType((data.vehicleType as VehicleType) ?? 'motorcycle');
      setPlateNumber(data.plateNumber ?? '');
      setOrCrNumber(data.orCrNumber ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!phone.trim()) {
      setError('Mobile number is required.');
      return;
    }
    setSaving(true);
    try {
      await riderFetch('/riders/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          homeAddress: {
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            province: province.trim(),
            postalCode: postalCode.trim(),
          },
          vehicleType,
          plateNumber: plateNumber.trim(),
          orCrNumber: orCrNumber.trim(),
        }),
      });
      refresh();
      Alert.alert('Profile saved', 'Your rider profile has been updated.');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading error="" loadingMessage="Loading profile…" />
      </Screen>
    );
  }

  if (error && !firstName) {
    return (
      <Screen inStack scroll={false}>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen inStack scroll={false}>
      <KeyboardSafeScrollView contentContainerStyle={styles.content}>

        {/* ── Rider information ── */}
        <Section icon="person-outline" title="Rider Information">
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Field label="FIRST NAME" required>
                <Input
                  placeholder="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  textContentType="givenName"
                />
              </Field>
            </View>
            <View style={styles.nameField}>
              <Field label="LAST NAME" required>
                <Input
                  placeholder="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  textContentType="familyName"
                />
              </Field>
            </View>
          </View>
          <Field label="EMAIL ADDRESS" locked>
            <Input
              placeholder="Email"
              value={email}
              editable={false}
              style={styles.readOnly}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </Field>
          <Field label="MOBILE NUMBER" required>
            <Input
              placeholder="+639..."
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
            />
          </Field>
        </Section>

        {/* ── Home address ── */}
        <Section icon="location-outline" title="Home Address">
          <Field label="ADDRESS LINE 1">
            <Input
              placeholder="House no., street name"
              value={line1}
              onChangeText={setLine1}
              autoCapitalize="words"
              textContentType="streetAddressLine1"
            />
          </Field>
          <Field label="ADDRESS LINE 2">
            <Input
              placeholder="Barangay, subdivision (optional)"
              value={line2}
              onChangeText={setLine2}
              autoCapitalize="words"
              textContentType="streetAddressLine2"
            />
          </Field>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Field label="CITY">
                <Input
                  placeholder="City"
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                  textContentType="addressCity"
                />
              </Field>
            </View>
            <View style={styles.nameField}>
              <Field label="PROVINCE">
                <Input
                  placeholder="Province"
                  value={province}
                  onChangeText={setProvince}
                  autoCapitalize="words"
                  textContentType="addressState"
                />
              </Field>
            </View>
          </View>
          <Field label="POSTAL CODE">
            <Input
              placeholder="0000"
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="number-pad"
              textContentType="postalCode"
            />
          </Field>
        </Section>

        {/* ── Vehicle information ── */}
        <Section icon="car-outline" title="Vehicle Information">
          <Field label="VEHICLE TYPE">
            <View style={styles.vehicleRow}>
              {VEHICLE_TYPES.map((type) => (
                <VehicleChip
                  key={type}
                  type={type}
                  active={vehicleType === type}
                  onPress={() => setVehicleType(type)}
                />
              ))}
            </View>
          </Field>
          <Field label="PLATE NUMBER">
            <Input
              placeholder="ABC 1234"
              value={plateNumber}
              onChangeText={setPlateNumber}
              autoCapitalize="characters"
            />
          </Field>
          <Field label="OR/CR NUMBER">
            <Input
              placeholder="OR/CR number"
              value={orCrNumber}
              onChangeText={setOrCrNumber}
              autoCapitalize="characters"
            />
          </Field>
        </Section>

        {/* ── Error ── */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Save ── */}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            saving && styles.saveBtnDisabled,
            pressed && !saving && styles.saveBtnPressed,
          ]}
          onPress={saveProfile}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save profile'}</Text>
          {!saving ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
        </Pressable>

      </KeyboardSafeScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxxl + spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameField: { flex: 1 },
  readOnly: {
    opacity: 0.55,
    backgroundColor: colors.surfaceMuted,
  },
  vehicleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.destructive,
    lineHeight: 18,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    ...shadow.elevated,
  },
  saveBtnDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  saveBtnPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
