import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { compareVersions } from '@lunara/utils';
import { getApiV1BaseUrl } from '../api-config';

interface AppVersionGateState {
  checking: boolean;
  updateRequired: boolean;
  storeUrl: string;
}

interface AppVersionResponse {
  minVersion: string;
  latestVersion: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
}

export function useAppVersionGate(): AppVersionGateState {
  const [state, setState] = useState<AppVersionGateState>({
    checking: true,
    updateRequired: false,
    storeUrl: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const installedVersion = Application.nativeApplicationVersion;
        if (!installedVersion) {
          if (!cancelled) setState({ checking: false, updateRequired: false, storeUrl: '' });
          return;
        }

        const res = await fetch(`${getApiV1BaseUrl()}/app-version?app=customer`);
        const body = await res.json();
        if (!res.ok || !body.success) {
          if (!cancelled) setState({ checking: false, updateRequired: false, storeUrl: '' });
          return;
        }

        const data = body.data as AppVersionResponse;
        const storeUrl = Platform.OS === 'ios' ? data.iosStoreUrl : data.androidStoreUrl;
        const updateRequired =
          !!data.minVersion &&
          compareVersions(installedVersion, data.minVersion) < 0 &&
          !!storeUrl;

        if (!cancelled) setState({ checking: false, updateRequired, storeUrl: storeUrl || '' });
      } catch {
        // Fail open — never block the app because the version check itself was unreachable.
        if (!cancelled) setState({ checking: false, updateRequired: false, storeUrl: '' });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
