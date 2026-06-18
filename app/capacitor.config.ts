import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solidstateimage.app',
  appName: 'SolidStateImage',
  webDir: 'dist',
  android: {
    // The Mac mini backend is plain HTTP over Tailscale (100.x.y.z), so the
    // WebView must be allowed to make cleartext requests to it.
    allowMixedContent: true,
  },
  server: {
    // Serve the app over http://localhost so requests to the plain-HTTP
    // Mac mini backend are same-scheme — no mixed-content blocking of images.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
