import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchAssignmentAlert, dispatchOfferAlert } from './dispatch-events';

test('dispatchOfferAlert formats pickup offers', () => {
  const alert = dispatchOfferAlert(
    { pickupAddress: { label: 'Home', city: 'Makati' } },
    'pickup',
  );
  assert.equal(alert.title, 'New pickup offer');
  assert.match(alert.body, /Home · Makati/);
});

test('dispatchAssignmentAlert uses payload title and body', () => {
  const alert = dispatchAssignmentAlert({
    title: 'New delivery assignment',
    body: 'Shop → customer',
  });
  assert.equal(alert.title, 'New delivery assignment');
  assert.equal(alert.body, 'Shop → customer');
});
