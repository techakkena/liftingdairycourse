import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'liftingdairycourse',
  webDir: 'dist',
  server: {
    url: 'https://liftingdairycourse-one.vercel.app',
    cleartext: false
  }
};

export default config;
