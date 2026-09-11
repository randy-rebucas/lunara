import type { RiderDocument } from './schemas/rider.schema';

export const RIDER_DOCUMENT_TYPES = [
  'drivers_license',
  'or_cr',
  'nbi_clearance',
  'selfie',
] as const;

export type RiderDocumentType = (typeof RIDER_DOCUMENT_TYPES)[number];

export const RIDER_DOCUMENT_LABELS: Record<RiderDocumentType, string> = {
  drivers_license: "Driver's License",
  or_cr: 'OR/CR',
  nbi_clearance: 'NBI Clearance',
  selfie: 'Selfie Verification',
};

export type RiderDocumentStatus = 'pending' | 'approved' | 'rejected';

export interface RiderDocumentRecord {
  type: RiderDocumentType;
  fileUrl?: string;
  status?: RiderDocumentStatus;
  uploadedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface RiderComplianceUser {
  phone?: string;
}

export interface RiderComplianceResult {
  isCompliant: boolean;
  profileGaps: string[];
  documentGaps: string[];
  approvedDocumentCount: number;
  verificationStatus: 'incomplete' | 'pending_review' | 'verified';
}

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

export function getProfileGaps(
  rider: Pick<
    RiderDocument,
    'firstName' | 'lastName' | 'homeAddress' | 'vehicleType' | 'plateNumber' | 'orCrNumber'
  >,
  user?: RiderComplianceUser | null,
): string[] {
  const gaps: string[] = [];
  if (!hasText(rider.firstName)) gaps.push('First name');
  if (!hasText(rider.lastName)) gaps.push('Last name');
  if (!hasText(user?.phone)) gaps.push('Mobile number');
  if (!hasText(rider.homeAddress?.line1)) gaps.push('Home address line 1');
  if (!hasText(rider.homeAddress?.city)) gaps.push('Home address city');
  if (!hasText(rider.homeAddress?.province)) gaps.push('Home address province');
  if (!hasText(rider.homeAddress?.postalCode)) gaps.push('Home address postal code');
  if (!hasText(rider.vehicleType)) gaps.push('Vehicle type');
  if (!hasText(rider.plateNumber)) gaps.push('Plate number');
  if (!hasText(rider.orCrNumber)) gaps.push('OR/CR number');
  return gaps;
}

export function getDocumentGaps(
  documents: RiderDocumentRecord[] | undefined,
): string[] {
  const gaps: string[] = [];
  const byType = new Map((documents ?? []).map((d) => [d.type, d]));

  for (const type of RIDER_DOCUMENT_TYPES) {
    const doc = byType.get(type);
    const label = RIDER_DOCUMENT_LABELS[type];
    if (!doc?.fileUrl) {
      gaps.push(`${label} (not uploaded)`);
      continue;
    }
    if (doc.status === 'pending') {
      gaps.push(`${label} (pending review)`);
    } else if (doc.status === 'rejected') {
      gaps.push(`${label} (rejected)`);
    } else if (doc.status !== 'approved') {
      gaps.push(`${label} (not approved)`);
    }
  }

  return gaps;
}

export function getVerificationStatus(
  profileGaps: string[],
  documents: RiderDocumentRecord[] | undefined,
): 'incomplete' | 'pending_review' | 'verified' {
  if (profileGaps.length > 0) return 'incomplete';

  const byType = new Map((documents ?? []).map((d) => [d.type, d]));
  const allUploaded = RIDER_DOCUMENT_TYPES.every((type) => hasText(byType.get(type)?.fileUrl));
  if (!allUploaded) return 'incomplete';

  const allApproved = RIDER_DOCUMENT_TYPES.every(
    (type) => byType.get(type)?.status === 'approved',
  );
  if (allApproved) return 'verified';

  const anyPending = RIDER_DOCUMENT_TYPES.some(
    (type) => byType.get(type)?.status === 'pending',
  );
  if (anyPending) return 'pending_review';

  return 'incomplete';
}

export function getApprovedDocumentCount(documents: RiderDocumentRecord[] | undefined): number {
  const byType = new Map((documents ?? []).map((d) => [d.type, d]));
  return RIDER_DOCUMENT_TYPES.filter((type) => byType.get(type)?.status === 'approved').length;
}

export function isRiderCompliant(
  rider: Pick<
    RiderDocument,
    | 'firstName'
    | 'lastName'
    | 'homeAddress'
    | 'vehicleType'
    | 'plateNumber'
    | 'orCrNumber'
    | 'documents'
  >,
  user?: RiderComplianceUser | null,
): RiderComplianceResult {
  const profileGaps = getProfileGaps(rider, user);
  const documentGaps = getDocumentGaps(rider.documents);
  const approvedDocumentCount = getApprovedDocumentCount(rider.documents);
  const verificationStatus = getVerificationStatus(profileGaps, rider.documents);

  return {
    // Document approval no longer gates `isCompliant`/going online — riders are verified in
    // person when they apply to a partner shop, not via in-app self-upload. `documentGaps` is
    // still computed and returned for the partner/admin document-review dashboards, which remain
    // a separate, partner-driven flow (see uploadDocumentForPartner/reviewDocument).
    isCompliant: profileGaps.length === 0,
    profileGaps,
    documentGaps,
    approvedDocumentCount,
    verificationStatus,
  };
}

export function isValidRiderDocumentType(type: string): type is RiderDocumentType {
  return (RIDER_DOCUMENT_TYPES as readonly string[]).includes(type);
}

/**
 * A suspended/terminated partner-owned rider must not be able to receive or claim task offers —
 * mirrors `RiderAssignmentService.assertRiderEligibleForAssignment`'s eligibility rule (platform
 * riders with no partnerId, or a partnerId'd rider whose employmentStatus is 'active' or unset,
 * are eligible). That check only guards the admin/dispatch-driven assign paths; this shared helper
 * lets the rider's own self-service paths (go online, accept an open pickup offer, receive offer
 * push notifications) enforce the identical rule so a suspension can't be bypassed by going through
 * the open-offer flow instead of a direct assignment.
 */
export function isRiderEligibleForWork(
  rider: Pick<RiderDocument, 'partnerId' | 'employmentStatus'>,
): boolean {
  return !rider.partnerId || !rider.employmentStatus || rider.employmentStatus === 'active';
}

export function serializeRiderDocuments(
  documents: RiderDocumentRecord[] | undefined,
): RiderDocumentRecord[] {
  const byType = new Map((documents ?? []).map((d) => [d.type, d]));
  return RIDER_DOCUMENT_TYPES.map((type) => {
    const doc = byType.get(type);
    return {
      type,
      fileUrl: doc?.fileUrl,
      status: doc?.status,
      uploadedAt: doc?.uploadedAt,
      reviewedAt: doc?.reviewedAt,
      // reviewedBy (the admin user id who reviewed the doc) is intentionally omitted here —
      // it's internal admin data the rider app never renders and has no reason to see.
      rejectionReason: doc?.rejectionReason,
    };
  });
}
