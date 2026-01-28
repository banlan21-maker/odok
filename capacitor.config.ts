/// <reference types="@capacitor-firebase/authentication" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.banlan21.odok',
  appName: 'odok',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      providers: ['google.com']
    }
  }
};

export default config;
