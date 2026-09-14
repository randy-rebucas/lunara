import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@lunara/types';
import { decideGoogleLogin } from './google-login.logic';

const VALID_PAYLOAD = {
  sub: 'google-sub-1',
  email: 'customer@example.com',
  email_verified: true,
  given_name: 'Ada',
  family_name: 'Lovelace',
};

test('decideGoogleLogin proceeds for a brand-new sign-up with a verified email', () => {
  const decision = decideGoogleLogin(VALID_PAYLOAD, undefined);
  assert.deepEqual(decision, { outcome: 'proceed' });
});

test('decideGoogleLogin proceeds when the matched account is an active customer', () => {
  const decision = decideGoogleLogin(VALID_PAYLOAD, { role: UserRole.CUSTOMER, isActive: true });
  assert.deepEqual(decision, { outcome: 'proceed' });
});

test('decideGoogleLogin rejects when Google did not verify the email', () => {
  const decision = decideGoogleLogin({ ...VALID_PAYLOAD, email_verified: false }, undefined);
  assert.deepEqual(decision, { outcome: 'unverified-email' });
});

test('decideGoogleLogin rejects a missing sub or email as an invalid payload', () => {
  assert.deepEqual(decideGoogleLogin({ ...VALID_PAYLOAD, sub: undefined }, undefined), {
    outcome: 'invalid-payload',
  });
  assert.deepEqual(decideGoogleLogin({ ...VALID_PAYLOAD, email: undefined }, undefined), {
    outcome: 'invalid-payload',
  });
  assert.deepEqual(decideGoogleLogin(undefined, undefined), { outcome: 'invalid-payload' });
});

test('decideGoogleLogin refuses a non-customer account (partner/staff/rider/admin) — Google sign-in is customer-only', () => {
  for (const role of [UserRole.PARTNER, UserRole.STAFF, UserRole.RIDER, UserRole.ADMIN]) {
    const decision = decideGoogleLogin(VALID_PAYLOAD, { role, isActive: true });
    assert.deepEqual(decision, { outcome: 'non-customer-account' }, `role=${role}`);
  }
});

test('decideGoogleLogin refuses a deactivated customer account', () => {
  const decision = decideGoogleLogin(VALID_PAYLOAD, { role: UserRole.CUSTOMER, isActive: false });
  assert.deepEqual(decision, { outcome: 'deactivated-account' });
});
