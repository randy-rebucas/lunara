/** Task photo files are stored as `{uploaderId}-{orderId}-{timestamp}.ext`. */
export function parseTaskPhotoFilename(filename: string): {
  uploaderId: string;
  orderId: string;
} | null {
  const match = /^([a-f0-9]{24})-([a-f0-9]{24})-/i.exec(filename);
  if (!match) return null;
  return { uploaderId: match[1], orderId: match[2] };
}
