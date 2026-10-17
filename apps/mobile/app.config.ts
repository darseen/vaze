import type { ExpoConfig } from "expo/config";
import pkg from "./package.json" with { type: "json" };

export default {
  name: "Vaze",
  slug: "vaze",
  owner: "darseen",
  version: pkg.version,
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "vaze",
  userInterfaceStyle: "automatic",
  backgroundColor: "#0c0c0c",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "dev.darseen.vaze",
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      NSLocalNetworkUsageDescription:
        "Vaze connects to servers on your local network.",
    },
  },
  android: {
    package: "dev.darseen.vaze",
    adaptiveIcon: {
      backgroundColor: "#0c0c0c",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    permissions: ["android.permission.MODIFY_AUDIO_SETTINGS"],
    // added by libraries; no overlays, biometrics or broad storage are used
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "expo-image",
    "expo-sharing",
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true,
          useDayNightTheme: true,
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 120,
        backgroundColor: "#ffffff",
        dark: {
          image: "./assets/splash-icon.png",
          backgroundColor: "#0c0c0c",
        },
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Vaze uploads the photos and videos you pick to your server.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-font",
      {
        fonts: [
          "./node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf",
          "./node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf",
          "./node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf",
          "./node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf",
        ],
      },
    ],
    "expo-video",
    [
      "expo-audio",
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      },
    ],
  ],
  extra: {
    router: {},
    eas: {
      projectId: "4b42f6a5-fe25-479d-bafa-a51a7fbd7e59",
    },
  },
  experiments: {
    typedRoutes: true,
  },
} satisfies ExpoConfig;
