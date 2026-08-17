import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// On native, Stripe Checkout has to open outside the app's own webview, but
// a plain `Linking.openURL` hands the user off to the system browser with no
// way back — after paying, Stripe redirects to `successUrl`, which is just a
// dead page unless the app itself has a URL to catch. `openAuthSessionAsync`
// opens an in-app browser sheet instead and auto-closes it (returning here)
// the moment Stripe navigates to `getCheckoutRedirectUrl()`, the same way
// this pattern is normally used for OAuth login callbacks.
export function getCheckoutRedirectUrl(): string | undefined {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.href : undefined;
  }
  return Linking.createURL('checkout-complete');
}

export async function openCheckoutUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.location.href = url;
    return;
  }
  await WebBrowser.openAuthSessionAsync(url, Linking.createURL('checkout-complete'));
}
