/** Every OAuth client id whose ID tokens we accept for Google sign-in: the web client (used by
 *  customer-web and as the Expo "webClientId" audience) plus the native iOS/Android clients used
 *  by customer-mobile's standalone builds. Native client env vars are optional until those OAuth
 *  clients are registered — Google sign-in on mobile in Expo Go/dev builds routes through the web
 *  client id anyway. */
export function getGoogleOAuthAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((id): id is string => !!id?.trim());
}
