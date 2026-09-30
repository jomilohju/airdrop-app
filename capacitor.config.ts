import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.airdropclone.app',
  appName: 'AirDrop Clone',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
