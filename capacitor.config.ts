import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.airdropclone.app',
  appName: 'AirDrop Clone',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // When running locally on a device for development, you can point this to your dev server IP
    // url: 'http://192.168.1.X:3000',
    cleartext: true
  }
};

export default config;
