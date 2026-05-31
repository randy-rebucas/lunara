import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maskAccountNumber, maskPayoutDetails } from './mask-pii';

describe('mask-pii', () => {
  it('masks account numbers keeping last four digits', () => {
    assert.equal(maskAccountNumber('09171234567'), '•••••••4567');
    assert.equal(maskAccountNumber('1234'), '1234');
  });

  it('masks payout detail strings', () => {
    assert.match(maskPayoutDetails({ gcashNumber: '09171234567' }), /^GCash •+/);
    assert.match(
      maskPayoutDetails({
        bankName: 'BPI',
        bankAccountName: 'Juan',
        bankAccountNumber: '1234567890',
      }),
      /BPI · Juan · •+7890$/,
    );
  });
});
