import { View, Text } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import type { OperatingHours } from '@lunara/types';
import type { BranchHoliday } from '@lunara/utils';
import { Button } from '../ui/button';
import { PickupSchedulePicker } from '../pickup-schedule-picker';
import { ScheduleSupportPrompt } from '../schedule-support-prompt';
import type { BookingFormState } from '../../lib/booking-flow';
import { StepHeading, styles, type AddressOption } from './shared';

interface ScheduleStepProps {
  form: BookingFormState;
  setForm: Dispatch<SetStateAction<BookingFormState>>;
  availabilityError: string;
  areaLabel: string;
  operatingHours: OperatingHours | null;
  holidays: BranchHoliday[];
  serverNow: string | undefined;
  showScheduleSupport: boolean;
  selectedAddress: AddressOption | undefined;
  onRetryAvailability: () => void;
}

/** Step "schedule" of the booking flow — pickup time selection. Extracted verbatim from
 * `app/book.tsx`; the availability fetch itself stays in the orchestrator. */
export function ScheduleStep({
  form,
  setForm,
  availabilityError,
  areaLabel,
  operatingHours,
  holidays,
  serverNow,
  showScheduleSupport,
  selectedAddress,
  onRetryAvailability,
}: ScheduleStepProps) {
  return (
    <View>
      <StepHeading step="schedule" title="Pickup time" />
      {availabilityError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.error}>{availabilityError}</Text>
          {form.addressId ? (
            <Button label="Try again" variant="secondary" onPress={onRetryAvailability} style={styles.retryBtn} />
          ) : null}
        </View>
      ) : null}
      {areaLabel ? <Text style={styles.sub}>Serving: {areaLabel}</Text> : null}
      {!operatingHours && !availabilityError ? (
        <Text style={styles.sub}>No pickup schedule available for this address.</Text>
      ) : null}
      {operatingHours ? (
        <PickupSchedulePicker
          operatingHours={operatingHours}
          holidays={holidays}
          serverNow={serverNow}
          selectedStartAt={form.scheduledPickupAt}
          onSelectStartAt={(startAt) => setForm((f) => ({ ...f, scheduledPickupAt: startAt }))}
        />
      ) : null}
      {showScheduleSupport ? (
        <ScheduleSupportPrompt
          address={selectedAddress}
          reason={availabilityError || 'No pickup schedule is available for this address yet.'}
        />
      ) : null}
    </View>
  );
}
