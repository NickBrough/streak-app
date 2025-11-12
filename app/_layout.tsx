import React, { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";

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
      } catch {
        // ignore invalid URLs
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => {
      // @ts-expect-error type compat between SDKs
      sub?.remove?.();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
