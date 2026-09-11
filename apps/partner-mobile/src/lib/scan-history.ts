import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ScanHistoryEntry {
  code: string;
  scannedAt: string;
  found: boolean;
  customerName?: string;
  orderShortCode?: string;
}

const STORAGE_KEY = 'partner.scanHistory.v1';
const MAX_ENTRIES = 20;

export async function loadScanHistory(): Promise<ScanHistoryEntry[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

export async function recordScan(entry: ScanHistoryEntry): Promise<ScanHistoryEntry[]> {
  const existing = await loadScanHistory();
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
