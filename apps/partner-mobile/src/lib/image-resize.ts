import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Resizes and recompresses a captured/picked photo before upload so its size doesn't depend on
 * guessing a server-side multer limit against whatever resolution the device's camera produces
 * (a 12MP+ phone camera at quality 0.85 with no resize can easily exceed 8MB). */
export async function resizeForUpload(uri: string, maxDimension = 1600): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const rendered = await context.resize({ width: maxDimension }).renderAsync();
  const result = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  // On iOS, saveAsync() can return a bare filesystem path with no `file://` scheme; RN's fetch
  // fails to attach that to FormData and throws synchronously, surfacing as "cannot reach API"
  // even though the host is reachable.
  return result.uri.startsWith('file://') ? result.uri : `file://${result.uri}`;
}
