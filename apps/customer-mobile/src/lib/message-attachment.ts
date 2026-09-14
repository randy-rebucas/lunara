import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { resizeForUpload } from './image-resize';

export interface PickedMessageImage {
  uri: string;
  formData: FormData;
}

/** Picks an image to attach to a chat message — no forced 1:1 crop (unlike an avatar photo),
 * since a message photo isn't a profile picture. Mirrors rider-mobile's pickMessageImage. */
export async function pickMessageImage(source: 'camera' | 'library'): Promise<PickedMessageImage | null> {
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

  const formData = new FormData();
  formData.append('file', {
    uri: uploadUri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);

  return { uri: uploadUri, formData };
}
