import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface CapturedPhoto {
  localUri: string;
  formData: FormData;
}

export async function captureTaskPhoto(): Promise<CapturedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Camera access needed',
      'Allow camera access to capture proof-of-pickup and proof-of-delivery photos.',
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const localUri = asset.uri;
  const formData = new FormData();
  formData.append('photo', {
    uri: localUri,
    name: asset.fileName ?? `task-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  return { localUri, formData };
}
