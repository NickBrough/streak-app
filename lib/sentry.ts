import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const sentryDsn =
  (Constants.expoConfig?.extra as any)?.sentry?.dsn ||
  process.env.SENTRY_DSN ||
  "";

export const isSentryEnabled = Boolean(sentryDsn);

export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!isSentryEnabled) return;

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value as any);
      });
    }
    Sentry.captureException(error);
  });
}

export function logMessage(
  message: string,
  context?: Record<string, unknown>
): void {
  if (!isSentryEnabled) return;

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value as any);
      });
    }
    Sentry.captureMessage(message);
  });
}

export function setSentryUser(user: {
  id: string;
  email?: string | null;
  [key: string]: any;
} | null): void {
  if (!isSentryEnabled) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
      ...user,
    });
  } else {
    Sentry.setUser(null);
  }
}

export function setNavigationContext(segments: readonly string[]): void {
  if (!isSentryEnabled) return;

  Sentry.setContext("navigation", {
    segments,
    path: segments.join("/"),
  });
}


