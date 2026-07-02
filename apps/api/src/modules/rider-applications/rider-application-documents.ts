export const RIDER_APPLICATION_DOCUMENT_TYPES = [
  'governmentId',
  'driversLicense',
  'orReceipt',
  'crCertificate',
  'nbiPoliceClearance',
  'brgyClearance',
  'selfiePhoto',
  'vehiclePhoto',
] as const;

export type RiderApplicationDocumentType = (typeof RIDER_APPLICATION_DOCUMENT_TYPES)[number];

export const RIDER_APPLICATION_DOCUMENT_LABELS: Record<RiderApplicationDocumentType, string> = {
  governmentId: 'Government-issued ID',
  driversLicense: "Driver's License",
  orReceipt: 'OR (Official Receipt)',
  crCertificate: 'CR (Certificate of Registration)',
  nbiPoliceClearance: 'NBI/Police Clearance',
  brgyClearance: 'Barangay Clearance',
  selfiePhoto: 'Selfie Photo',
  vehiclePhoto: 'Vehicle Photo',
};

export function isValidRiderApplicationDocumentType(
  value: string,
): value is RiderApplicationDocumentType {
  return (RIDER_APPLICATION_DOCUMENT_TYPES as readonly string[]).includes(value);
}
