import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { resizeForUpload } from './image-resize';
import type { UploadFile } from './offline/types';

/** Picks an image to attach to a chat message — no forced 1:1 crop (unlike an avatar photo),
 * since a message photo isn't a profile picture. Mirrors partner-mobile's pickMessageImage. */
export async function pickMessageImage(source: 'camera' | 'library'): Promise<UploadFile | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', 'Allow photo access to attach an image.');
    return null;
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const uploadUri = await resizeForUpload(asset.uri);

  return {
    uri: uploadUri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    type: 'image/jpeg',
    fieldName: 'file',
  };
}
