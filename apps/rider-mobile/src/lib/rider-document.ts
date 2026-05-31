import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { RiderDocumentType } from './rider-types';

export interface CapturedDocument {
  localUri: string;
  formData: FormData;
}

export async function captureRiderDocument(
  type: RiderDocumentType,
  source: 'camera' | 'library',
): Promise<CapturedDocument | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to upload verification documents.');
      return null;
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos access needed', 'Allow photo library access to upload verification documents.');
      return null;
    }
  }

  const pickerOptions =
    source === 'camera'
      ? ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
        })
      : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
        });

  const result = await pickerOptions;
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const formData = new FormData();
  formData.append('document', {
    uri: asset.uri,
    name: asset.fileName ?? `${type}-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  return { localUri: asset.uri, formData };
}

export function documentStatusLabel(status?: string): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'pending':
      return 'Pending review';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Not uploaded';
  }
}
