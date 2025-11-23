import React, { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as Sentry from "sentry-expo";

// Initialize Sentry
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableInExpoDevelopment: false,
  debug: false,
  environment: __DEV__ ? "development" : "production",
});

export default function RootLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/sign-in");
    }
  }, [user, loading]);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        const u = new URL(url);
        const host = u.host || u.pathname.replace(/^\//, "");
        if (host === "add-friend") {
          const inviter = u.searchParams.get("inviter") ?? "";
          const handle = u.searchParams.get("handle") ?? "";
          const qs = new URLSearchParams();
          if (inviter) qs.set("inviter", inviter);
          if (handle) qs.set("handle", handle);
          qs.set("addfriend", "1");
          router.push(`/ (tabs)/social?${qs.toString()}`.replace(" ", ""));
        }
      } catch (error) {
        // ignore invalid URLs
        Sentry.captureException(error);
      }
    };
    
    // Safely initialize Linking
    try {
      if (Linking && typeof Linking.getInitialURL === "function") {
        Linking.getInitialURL()
          .then(handleUrl)
          .catch((error) => {
            // Ignore linking errors on app startup
            console.warn("Failed to get initial URL:", error);
            Sentry.captureException(error);
          });
      }
      
      if (Linking && typeof Linking.addEventListener === "function") {
        const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
        return () => {
          try {
            // @ts-expect-error type compat between SDKs
            sub?.remove?.();
          } catch (error) {
            // Ignore errors when removing listener
            Sentry.captureException(error);
          }
        };
      }
    } catch (error) {
      console.warn("Linking module not available:", error);
      Sentry.captureException(error);
    }
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
