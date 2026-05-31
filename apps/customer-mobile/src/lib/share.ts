import { Linking, Share } from 'react-native';
import {
  buildSocialShareUrl,
  formatShareText,
  type SharePayload,
  type SocialPlatform,
} from '@lunara/utils';

export async function shareNative(payload: SharePayload): Promise<boolean> {
  const result = await Share.share(
    {
      title: payload.title,
      message: formatShareText(payload),
      url: payload.url,
    },
    { dialogTitle: payload.title, subject: payload.title },
  );
  return result.action === Share.sharedAction;
}

export async function openSocialShare(platform: SocialPlatform, payload: SharePayload) {
  const url = buildSocialShareUrl(platform, payload);
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    await shareNative(payload);
    return;
  }
  await Linking.openURL(url);
}
