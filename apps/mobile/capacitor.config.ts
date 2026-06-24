import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Sail native wrapper. `appId` is the real Android
 * package id (com.hereliesaz.sail); the web build in apps/web/dist is bundled
 * into the native app by `cap sync`. Build the web app with VITE_API_URL set to
 * the deployed API before syncing (localhost won't resolve on-device).
 */
const config: CapacitorConfig = {
  appId: "com.hereliesaz.sail",
  appName: "Sail",
  webDir: "../web/dist",
};

export default config;
