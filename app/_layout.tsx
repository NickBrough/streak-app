import React, { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import {
  logMessage,
  logError,
  setNavigationContext,
  setSentryUser,
} from "@/lib/sentry";

const sentryDsn =
  (Constants.expoConfig?.extra as any)?.sentry?.dsn ||
  process.env.SENTRY_DSN ||
  "";

if (sentryDsn) {
  try {
    Sentry.init({
      dsn: sentryDsn,
      debug: __DEV__,
      tracesSampleRate: 0,
    });
    logMessage("Sentry initialized on app startup", {
      platform: Constants.platform,
    });
  } catch (error) {
    // Guard against Sentry init crashes
    console.warn("Failed to initialize Sentry:", error);
  }
}

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    logMessage("RootLayout mounted", {
      hasUser: Boolean(user),
      loading,
    });
  }, []);

  useEffect(() => {
    try {
      if (!loading && !user) {
        logMessage("Navigating to sign-in from RootLayout", {
          reason: "no_user_on_startup",
        });
        router.replace("/(auth)/sign-in");
      }
    } catch (error) {
      logError(error, { phase: "initial_navigation" });
    }
  }, [user, loading]);

  useEffect(() => {
    // Keep Sentry user and route context in sync with auth and navigation state
    if (user) {
      setSentryUser({
        id: user.id,
        email: user.email,
      });
    } else {
      setSentryUser(null);
    }

    setNavigationContext(segments);
  }, [user, segments]);

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

          logMessage("Handling add-friend deep link", {
            inviter,
            handle,
          });

          router.push(`/ (tabs)/social?${qs.toString()}`.replace(" ", ""));
        }
      } catch (error) {
        logError(error, { phase: "handle_initial_url" });
      }
    };
    
    // Safely initialize Linking
    try {
      if (Linking && typeof Linking.getInitialURL === "function") {
        Linking.getInitialURL()
          .then((url) => {
            if (url) {
              logMessage("Received initial URL on startup", { url });
            }
            handleUrl(url);
          })
          .catch((error) => {
            // Ignore linking errors on app startup but report to Sentry
            console.warn("Failed to get initial URL:", error);
            logError(error, { phase: "get_initial_url" });
          });
      }

      if (Linking && typeof Linking.addEventListener === "function") {
        const sub = Linking.addEventListener("url", (e) => {
          if (e.url) {
            logMessage("Received URL from Linking event", { url: e.url });
          }
          handleUrl(e.url);
        });
        return () => {
          try {
            // @ts-expect-error type compat between SDKs
            sub?.remove?.();
          } catch (error) {
            // Ignore errors when removing listener
            logError(error, { phase: "remove_linking_listener" });
          }
        };
      }
    } catch (error) {
      console.warn("Linking module not available:", error);
      logError(error, { phase: "linking_setup" });
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Sentry.ErrorBoundary
        onError={(error) => {
          logError(error, { phase: "root_error_boundary" });
        }}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </Sentry.ErrorBoundary>
    </SafeAreaProvider>
  );
}
