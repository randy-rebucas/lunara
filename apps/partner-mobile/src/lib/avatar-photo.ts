import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface PickedAvatar {
  localUri: string;
  formData: FormData;
}

export async function pickAvatarPhoto(source: 'camera' | 'library'): Promise<PickedAvatar | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', 'Allow photo access to set your profile picture.');
    return null;
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const formData = new FormData();
  formData.append('avatar', {
    uri: asset.uri,
    name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  return { localUri: asset.uri, formData };
}
