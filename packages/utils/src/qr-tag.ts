export const TAG_QR_VERSION = 'v1';
export const TAG_QR_PREFIX = 'lunaratag';

export interface TagQrPayload {
  version: string;
  tagCode: string;
}

export function normalizeTagCode(code: string): string {
  return code.trim().toUpperCase();
}

export function buildTagQrPayload(tagCode: string): string {
  return [TAG_QR_PREFIX, TAG_QR_VERSION, normalizeTagCode(tagCode)].join('|');
}

export function parseTagQrPayload(raw: string): TagQrPayload | null {
  const trimmed = raw.trim();
  const parts = trimmed.split('|');
  if (parts.length !== 3) return null;
  if (parts[0] !== TAG_QR_PREFIX) return null;
  if (parts[1] !== TAG_QR_VERSION) return null;

  const tagCode = parts[2]?.trim();
  if (!tagCode) return null;

  return {
    version: parts[1],
    tagCode: normalizeTagCode(tagCode),
  };
}

export function resolveTagCode(scannedValue: string): string {
  const parsed = parseTagQrPayload(scannedValue);
  if (parsed) return parsed.tagCode;
  return normalizeTagCode(scannedValue);
}
