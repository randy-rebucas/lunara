import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export async function pickRiderAvatar(): Promise<FormData | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photos access needed', 'Allow photo library access to choose a profile picture.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const formData = new FormData();
  formData.append('avatar', {
    uri: asset.uri,
    name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  return formData;
}
