import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { logMessage, logError } from "@/lib/sentry";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logMessage("Auth bootstrap start");

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        logMessage("Auth bootstrap resolved", {
          hasSession: Boolean(session),
          hasUser: Boolean(session?.user),
        });
      })
      .catch((error) => {
        setLoading(false);
        logError(error, { phase: "auth_bootstrap_getSession" });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      logMessage("Auth state change", {
        event,
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
      });
    });

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        logError(error, { phase: "auth_subscription_unsubscribe" });
      }
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "streak://auth/callback",
      },
    });
    return { error, user: data.user };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error, session: data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signUp, signIn, signOut };
}
