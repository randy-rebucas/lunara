export const PARTNER_APPLICATION_DOCUMENT_TYPES = [
  'businessPermit',
  'dtiSecRegistration',
  'birCertificate',
  'ownerValidId',
  'shopPhoto',
] as const;

export type PartnerApplicationDocumentType = (typeof PARTNER_APPLICATION_DOCUMENT_TYPES)[number];

export const PARTNER_APPLICATION_DOCUMENT_LABELS: Record<PartnerApplicationDocumentType, string> = {
  businessPermit: "Mayor's / Business Permit",
  dtiSecRegistration: 'DTI or SEC Registration',
  birCertificate: 'BIR Certificate of Registration (COR)',
  ownerValidId: 'Owner Valid ID',
  shopPhoto: 'Shop Photo',
};

export function isValidPartnerApplicationDocumentType(
  value: string,
): value is PartnerApplicationDocumentType {
  return (PARTNER_APPLICATION_DOCUMENT_TYPES as readonly string[]).includes(value);
}
