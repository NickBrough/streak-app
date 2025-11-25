import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Screen from "@/components/ui/Screen";
import ProfileAvatarPicker from "@/components/profile/ProfileAvatarPicker";
import { logError, logMessage } from "@/lib/sentry";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [handle, setHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pushupGoal, setPushupGoal] = useState("20");
  const [squatGoal, setSquatGoal] = useState("30");
  const [pushupEnabled, setPushupEnabled] = useState(true);
  const [squatEnabled, setSquatEnabled] = useState(true);
  const [reminders, setReminders] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("handle,avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          logError(profileError, {
            screen: "settings",
            phase: "load_profile",
          });
        }

        if (profile?.handle) setHandle(profile.handle);
        setAvatarUrl((profile as any)?.avatar_url ?? null);

        const { data: ex, error: exError } = await supabase
          .from("exercises")
          .select("exercise_id,daily_goal,enabled")
          .eq("user_id", user.id);

        if (exError) {
          logError(exError, {
            screen: "settings",
            phase: "load_exercises",
          });
        }

        ex?.forEach((e: any) => {
          if (e.exercise_id === "pushup") {
            setPushupGoal(String(e.daily_goal ?? 20));
            if (typeof e.enabled === "boolean") setPushupEnabled(e.enabled);
          }
          if (e.exercise_id === "squat") {
            setSquatGoal(String(e.daily_goal ?? 30));
            if (typeof e.enabled === "boolean") setSquatEnabled(e.enabled);
          }
        });
      } catch (error) {
        logError(error, { screen: "settings", phase: "load_settings" });
      }
    })();
  }, [user]);

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 20 }}>
      <Text style={styles.heading}>Settings</Text>

      <Text style={styles.section}>Profile</Text>
      {user ? (
        <ProfileAvatarPicker
          userId={user.id}
          currentUrl={avatarUrl}
          onChanged={setAvatarUrl}
        />
      ) : null}
      <Input placeholder="Handle" value={handle} onChangeText={setHandle} />

      <View style={{ height: 16 }} />
      <Text style={styles.section}>Exercises</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Push-Ups</Text>
        <Switch value={pushupEnabled} onValueChange={setPushupEnabled} />
      </View>
      <Input
        placeholder="Push-Ups goal"
        keyboardType="number-pad"
        value={pushupGoal}
        onChangeText={setPushupGoal}
      />
      <View style={{ height: 12 }} />
      <View style={styles.row}>
        <Text style={styles.label}>Squats</Text>
        <Switch value={squatEnabled} onValueChange={setSquatEnabled} />
      </View>
      <Input
        placeholder="Squats goal"
        keyboardType="number-pad"
        value={squatGoal}
        onChangeText={setSquatGoal}
      />

      <View style={{ height: 16 }} />
      <Text style={styles.section}>Reminders</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Daily notification</Text>
        <Switch value={reminders} onValueChange={setReminders} />
      </View>

      <View style={{ height: 20 }} />
      <Button
        title={saving ? "Saving…" : "Save"}
        onPress={async () => {
          if (!user) return;
          setSaving(true);
          try {
            const { error: profileError } = await supabase
              .from("profiles")
              .upsert({ id: user.id, handle })
              .select()
              .single();

            if (profileError) {
              logError(profileError, {
                screen: "settings",
                phase: "save_profile",
              });
            }

            const { error: exercisesError } = await supabase
              .from("exercises")
              .upsert(
                [
                  {
                    user_id: user.id,
                    exercise_id: "pushup",
                    daily_goal: Number(pushupGoal) || 0,
                    enabled: pushupEnabled,
                  },
                  {
                    user_id: user.id,
                    exercise_id: "squat",
                    daily_goal: Number(squatGoal) || 0,
                    enabled: squatEnabled,
                  },
                ],
                { onConflict: "user_id,exercise_id" }
              )
              .select();

            if (exercisesError) {
              logError(exercisesError, {
                screen: "settings",
                phase: "save_exercises",
              });
            } else {
              logMessage("Settings saved", {
                screen: "settings",
                pushupGoal,
                squatGoal,
                pushupEnabled,
                squatEnabled,
              });
            }
          } finally {
            setSaving(false);
          }
        }}
      />

      <View style={{ height: 12 }} />
      <Button title="Sign Out" variant="outline" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: "#e6f0f2",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
  },
  section: { color: "#94a3b8", fontSize: 14, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { color: "#e6f0f2" },
});
