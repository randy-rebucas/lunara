import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRiderWalletBalances } from './rider-ops.js';

test('computeRiderWalletBalances with no holds or pending withdrawals', () => {
  const result = computeRiderWalletBalances(500, 0, 0);
  assert.equal(result.currentBalance, 500);
  assert.equal(result.pendingEarnings, 0);
  assert.equal(result.withdrawableBalance, 500);
});

test('computeRiderWalletBalances subtracts admin hold and pending withdrawals', () => {
  const result = computeRiderWalletBalances(1000, 150, 200);
  assert.equal(result.currentBalance, 1000);
  assert.equal(result.pendingEarnings, 150);
  assert.equal(result.withdrawableBalance, 650);
});

test('withdrawable balance never goes below zero', () => {
  const result = computeRiderWalletBalances(100, 80, 50);
  assert.equal(result.withdrawableBalance, 0);
});
