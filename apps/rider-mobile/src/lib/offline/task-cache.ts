import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'lunara_rider_task_cache:';

export async function saveTaskCache<T>(orderId: string, task: T): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${orderId}`, JSON.stringify(task));
}

export async function loadTaskCache<T>(orderId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${orderId}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function removeTaskCache(orderId: string): Promise<void> {
  await AsyncStorage.removeItem(`${PREFIX}${orderId}`);
}
