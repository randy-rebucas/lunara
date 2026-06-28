// Shim so expo/AppEntry.js (the monorepo fallback entry) gets a valid default export.
// expo/AppEntry does: import App from '../../App'; registerRootComponent(App)
// metro.config.js resolveRequest redirects '../../App' here instead.
export { App as default } from 'expo-router/build/qualified-entry';
