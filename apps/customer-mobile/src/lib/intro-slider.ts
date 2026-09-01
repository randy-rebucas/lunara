import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lunara_intro_seen';

/** Fails open (treated as seen) so a storage error never traps the user behind the slider. */
export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // best-effort — a failed write just means the intro may show again next launch
  }
}
