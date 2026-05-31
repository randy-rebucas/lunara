import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDocumentGaps,
  getProfileGaps,
  getVerificationStatus,
  isRiderCompliant,
  RIDER_DOCUMENT_TYPES,
} from './rider-compliance';

const completeRider = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  homeAddress: {
    line1: '123 Ayala Avenue',
    city: 'Makati',
    province: 'Metro Manila',
    postalCode: '1226',
  },
  vehicleType: 'motorcycle',
  plateNumber: 'ABC1234',
  orCrNumber: 'ORCR-001',
  documents: RIDER_DOCUMENT_TYPES.map((type) => ({
    type,
    fileUrl: `/api/v1/uploads/rider-documents/${type}.jpg`,
    status: 'approved' as const,
  })),
};

test('detects missing profile fields', () => {
  const gaps = getProfileGaps(
    {
      firstName: '',
      lastName: 'Dela Cruz',
      homeAddress: { line1: '123 Main' },
      vehicleType: 'motorcycle',
      plateNumber: 'ABC1234',
      orCrNumber: 'ORCR-001',
    },
    { phone: '+639171234567' },
  );

  assert.ok(gaps.includes('First name'));
  assert.ok(gaps.includes('Home address city'));
});

test('detects missing and pending documents', () => {
  const gaps = getDocumentGaps([
    {
      type: 'drivers_license',
      fileUrl: '/file.jpg',
      status: 'pending',
    },
  ]);

  assert.equal(
    gaps.some((g) => g.includes('pending review')),
    true,
  );
  assert.equal(
    gaps.some((g) => g.includes('not uploaded')),
    true,
  );
});

test('returns verified when profile and documents are complete', () => {
  const result = isRiderCompliant(completeRider, { phone: '+639172222222' });
  assert.equal(result.isCompliant, true);
  assert.equal(result.verificationStatus, 'verified');
  assert.equal(result.profileGaps.length, 0);
  assert.equal(result.documentGaps.length, 0);
});

test('returns pending_review when documents are uploaded but not approved', () => {
  const rider = {
    ...completeRider,
    documents: completeRider.documents.map((doc, index) =>
      index === 0 ? { ...doc, status: 'pending' as const } : doc,
    ),
  };

  const status = getVerificationStatus([], rider.documents);
  assert.equal(status, 'pending_review');
  assert.equal(isRiderCompliant(rider, { phone: '+639172222222' }).isCompliant, false);
});

test('blocks compliance when a document is rejected', () => {
  const rider = {
    ...completeRider,
    documents: completeRider.documents.map((doc, index) =>
      index === 0 ? { ...doc, status: 'rejected' as const } : doc,
    ),
  };

  const result = isRiderCompliant(rider, { phone: '+639172222222' });
  assert.equal(result.isCompliant, false);
  assert.equal(
    result.documentGaps.some((gap) => gap.includes('rejected')),
    true,
  );
});
