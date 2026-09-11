import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { resizeForUpload } from './image-resize';
import type { UploadFile } from './offline/types';

export type AvatarSource = 'camera' | 'library';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
  allowsEditing: true,
  aspect: [1, 1],
};

async function pickFrom(source: AvatarSource): Promise<ImagePicker.ImagePickerResult | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to take a profile picture.');
      return null;
    }
    return ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photos access needed', 'Allow photo library access to choose a profile picture.');
    return null;
  }
  return ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
}

export async function pickRiderAvatar(source: AvatarSource): Promise<UploadFile | null> {
  const result = await pickFrom(source);
  if (!result || result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const uploadUri = await resizeForUpload(asset.uri);

  return {
    uri: uploadUri,
    name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
    type: 'image/jpeg',
    fieldName: 'avatar',
  };
}
