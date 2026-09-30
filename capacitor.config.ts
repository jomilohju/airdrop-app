import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.droptop.app',
  appName: 'DropTop',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
