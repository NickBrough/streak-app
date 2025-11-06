import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Screen from "@/components/ui/Screen";
import LeaderboardRow, {
  LeaderboardEntry,
} from "@/components/social/LeaderboardRow";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toLocalDayUtcKey } from "@/lib/date";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SocialScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"reps" | "days">("reps");
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [supportsFollows, setSupportsFollows] = useState<boolean>(true);
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Detect follows support (table may not exist yet)
        if (user) {
          try {
            await supabase
              .from("follows")
              .select("followee_id", { count: "exact", head: true })
              .eq("follower_id", user.id)
              .limit(1);
            if (mounted) setSupportsFollows(true);
          } catch {
            if (mounted) setSupportsFollows(false);
          }
        }

        const last7: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          last7.push(toLocalDayUtcKey(d));
        }

        const { data, error: err } = await supabase
          .from("daily_totals")
          .select("user_id,date,totals,met_goal,streak")
          .in("date", last7);
        if (err) throw err;

        const byUser = new Map<string, LeaderboardEntry>();
        for (const row of data ?? []) {
          const uid = row.user_id as string;
          const date = row.date as string;
          const totals = (row.totals as any) ?? {};
          const push = Number(totals.pushup ?? 0) || 0;
          const squat = Number(totals.squat ?? 0) || 0;
          const reps = push + squat;
          const prev = byUser.get(uid) ?? {
            userId: uid,
            handle: "",
            avatarUrl: null,
            weeklyReps: 0,
            daysMet: 0,
            streak: 0,
            lastActive: undefined,
          };
          prev.weeklyReps += reps;
          if (row.met_goal) prev.daysMet += 1;
          if (!prev.lastActive || date > prev.lastActive) {
            prev.lastActive = date;
            prev.streak = Number(row.streak ?? prev.streak) || prev.streak;
          }
          byUser.set(uid, prev);
        }

        // Ensure current user is visible even with no activity
        if (user && !byUser.has(user.id)) {
          byUser.set(user.id, {
            userId: user.id,
            handle: "",
            avatarUrl: null,
            weeklyReps: 0,
            daysMet: 0,
            streak: 0,
          });
        }

        let list = Array.from(byUser.values());
        // Apply friends scope if requested and supported
        if (user && scope === "friends" && supportsFollows) {
          try {
            const { data: fl } = await supabase
              .from("follows")
              .select("followee_id")
              .eq("follower_id", user.id);
            const allowed = new Set<string>([
              user.id,
              ...((fl ?? []).map(
                (f: any) => f.followee_id as string
              ) as string[]),
            ]);
            list = list.filter((e) => allowed.has(e.userId));
          } catch {
            // if query fails, fall back to global
          }
        }
        // Fetch profiles for user metadata
        if (list.length > 0) {
          const ids = list.map((e) => e.userId);
          const { data: profs } = await supabase
            .from("profiles")
            .select("id,handle,avatar_url")
            .in("id", ids);
          const byId = new Map<
            string,
            { handle?: string; avatar_url?: string }
          >();
          for (const p of profs ?? []) byId.set(p.id as string, p as any);
          list = list.map((e) => {
            const p = byId.get(e.userId);
            const handle =
              (p?.handle as string) ||
              (e.userId === user?.id ? user?.email ?? "" : "");
            return {
              ...e,
              handle,
              avatarUrl: (p?.avatar_url as string | undefined) ?? null,
            } as LeaderboardEntry;
          });
        }
        list.sort((a, b) => {
          const mA = mode === "reps" ? a.weeklyReps : a.daysMet;
          const mB = mode === "reps" ? b.weeklyReps : b.daysMet;
          const primary = mB - mA;
          if (primary !== 0) return primary;
          const secondary =
            b.weeklyReps - a.weeklyReps || b.daysMet - a.daysMet;
          if (secondary !== 0) return secondary;
          const streakDiff = (b.streak ?? 0) - (a.streak ?? 0);
          if (streakDiff !== 0) return streakDiff;
          return (b.lastActive ?? "") < (a.lastActive ?? "") ? -1 : 1;
        });
        if (mounted) setEntries(list);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load leaderboard");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, scope, mode]);

  return (
    <Screen scroll contentStyle={styles.container}>
      <Text style={styles.heading}>Leaderboard</Text>
      <View style={styles.segment}>
        <SegmentButton
          label="Reps"
          active={mode === "reps"}
          onPress={() => setMode("reps")}
        />
        <SegmentButton
          label="Days Met"
          active={mode === "days"}
          onPress={() => setMode("days")}
        />
      </View>

      <View style={[styles.segment, { marginTop: 4 }]}>
        <SegmentButton
          label="Global"
          active={scope === "global"}
          onPress={() => setScope("global")}
        />
        <SegmentButton
          label={supportsFollows ? "Friends" : "Friends (soon)"}
          active={scope === "friends"}
          onPress={() => supportsFollows && setScope("friends")}
        />
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.userId}
        contentContainerStyle={{ gap: 10, paddingBottom: 120 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelected(item)}
          >
            <LeaderboardRow
              rank={index + 1}
              entry={item}
              metricValue={mode === "reps" ? item.weeklyReps : item.daysMet}
              metricLabel={mode === "reps" ? "reps" : "days"}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 40 }}>
              <ActivityIndicator color="#20e5e5" />
            </View>
          ) : error ? (
            <Text style={styles.empty}>{error}</Text>
          ) : (
            <Text style={styles.empty}>No entries yet. Get moving! 💪</Text>
          )
        }
      />

      {selected && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setSelected(null)}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(24, (insets?.bottom ?? 0) + 72) },
            ]}
          >
            <Text style={styles.sheetTitle}>@{selected.handle}</Text>
            <Text style={styles.sheetSub}>Streak {selected.streak}</Text>
            <View style={{ height: 8 }} />
            <View style={styles.sheetRow}>
              <Text style={styles.sheetMetric}>{selected.weeklyReps}</Text>
              <Text style={styles.sheetMetricLabel}>reps (7d)</Text>
            </View>
            <View style={{ height: 6 }} />
            <View style={styles.sheetRow}>
              <Text style={styles.sheetMetric}>{selected.daysMet}/7</Text>
              <Text style={styles.sheetMetricLabel}>days met</Text>
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  heading: {
    color: "#e6f0f2",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 16 },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: "#0f1720" },
  segmentText: { color: "#94a3b8", fontWeight: "600" },
  segmentTextActive: { color: "#e6f0f2" },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0b0f14",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetTitle: { color: "#e6f0f2", fontSize: 18, fontWeight: "800" },
  sheetSub: { color: "#94a3b8", marginTop: 4 },
  sheetRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  sheetMetric: { color: "#20e5e5", fontWeight: "900", fontSize: 22 },
  sheetMetricLabel: { color: "#94a3b8" },
});
