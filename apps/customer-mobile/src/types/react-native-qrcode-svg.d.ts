// react-native-qrcode-svg is hoisted to the monorepo root, where it resolves against a
// newer @types/react than this app's own (pinned to 18.2.79 for the Expo SDK51 downgrade).
// That cross-package generic-arity mismatch makes the package's own PureComponent-based
// declaration fail JSX element checks here, even though it works fine at runtime.
declare module 'react-native-qrcode-svg' {
  import type { ComponentType } from 'react';
  import type { ImageSourcePropType } from 'react-native';
  import type { SvgProps } from 'react-native-svg';

  export interface QRCodeProps {
    value?: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logoSVG?: ComponentType<SvgProps> | string;
    logo?: ImageSourcePropType | string;
    logoSize?: number;
    logoBackgroundColor?: string;
    logoColor?: string;
    logoMargin?: number;
    logoBorderRadius?: number;
    quietZone?: number;
    enableLinearGradient?: boolean;
    gradientDirection?: string[];
    linearGradient?: string[];
    getRef?: (c: unknown) => void;
    ecl?: 'L' | 'M' | 'Q' | 'H';
    onError?: (error: unknown) => void;
    testID?: string;
  }

  const QRCode: ComponentType<QRCodeProps>;
  export default QRCode;
}
