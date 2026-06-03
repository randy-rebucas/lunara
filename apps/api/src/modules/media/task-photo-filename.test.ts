import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskPhotoFilename } from './task-photo-filename';

test('parseTaskPhotoFilename extracts uploader and order ids', () => {
  const uploaderId = '507f1f77bcf86cd799439011';
  const orderId = '507f191e810c19729de860ea';
  const parsed = parseTaskPhotoFilename(`${uploaderId}-${orderId}-1710000000000.jpg`);
  assert.equal(parsed?.uploaderId, uploaderId);
  assert.equal(parsed?.orderId, orderId);
});

test('parseTaskPhotoFilename rejects non-standard names', () => {
  assert.equal(parseTaskPhotoFilename('seed-doc.jpg'), null);
});
