import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOOKING_STEPS,
  initialBookingForm,
  nextStep,
  prevStep,
  stepIndex,
  type BookingStep,
} from './booking-flow';

describe('booking-flow', () => {
  it('stepIndex finds known steps', () => {
    assert.equal(stepIndex('service'), 0);
    assert.equal(stepIndex('confirm'), BOOKING_STEPS.length - 1);
    assert.equal(stepIndex('done' as BookingStep), -1);
  });

  it('nextStep and prevStep walk the wizard', () => {
    assert.equal(nextStep('service'), 'address');
    assert.equal(nextStep('confirm'), null);
    assert.equal(prevStep('service'), null);
    assert.equal(prevStep('address'), 'service');
  });

  it('initialBookingForm has sane defaults', () => {
    assert.equal(initialBookingForm.bookingType, null);
    assert.equal(initialBookingForm.bagSizeId, '');
    assert.deepEqual(initialBookingForm.addonIds, []);
  });
});
