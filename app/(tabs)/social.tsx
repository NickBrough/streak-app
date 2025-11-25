import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Screen from "@/components/ui/Screen";
import LeaderboardRow, {
  LeaderboardEntry,
} from "@/components/social/LeaderboardRow";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { logError, logMessage } from "@/lib/sentry";
import { toLocalDayUtcKey } from "@/lib/date";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddFriendsSheet from "@/components/social/AddFriendsSheet";
import { useLocalSearchParams } from "expo-router";
import { Plus, Calendar, Trophy } from "lucide-react-native";

export default function SocialScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"reps" | "days">("reps");
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [supportsFollows, setSupportsFollows] = useState<boolean>(true);
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const params = useLocalSearchParams<{
    addfriend?: string;
    inviter?: string;
    handle?: string;
  }>();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Detect friends support (table may not exist yet)
        if (user) {
          try {
            await supabase
              .from("friendships")
              .select("user_id1", { count: "exact", head: true })
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

        // Always build a weekly snapshot to drive candidate user set
        const { data: weekRows, error: weekErr } = await supabase
          .from("daily_totals")
          .select("user_id,date,totals,met_goal,streak")
          .in("date", last7);
        if (weekErr) throw weekErr;

        const byUser = new Map<string, LeaderboardEntry>();
        for (const row of weekRows ?? []) {
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
        let candidateIds = new Set<string>(list.map((e) => e.userId));
        // Apply friends scope if requested and supported
        if (user && scope === "friends" && supportsFollows) {
          try {
            const { data: fr } = await supabase
              .from("friendships")
              .select("user_id1,user_id2")
              .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);
            const friendIds = new Set<string>(
              (fr ?? []).map((r: any) =>
                r.user_id1 === user.id
                  ? (r.user_id2 as string)
                  : (r.user_id1 as string)
              )
            );
            // Ensure friends appear even with no recent activity
            for (const fid of Array.from(friendIds)) {
              if (!byUser.has(fid)) {
                byUser.set(fid, {
                  userId: fid,
                  handle: "",
                  avatarUrl: null,
                  weeklyReps: 0,
                  daysMet: 0,
                  streak: 0,
                });
              }
              candidateIds.add(fid);
            }
            list = Array.from(byUser.values());
            const allowed = new Set<string>([
              user.id,
              ...Array.from(friendIds),
            ]);
            list = list.filter((e) => allowed.has(e.userId));
          } catch (error) {
            logError(error, {
              screen: "social",
              phase: "load_friends_scope",
            });
            // if query fails, fall back to global
          }
        }

        // If viewing all-time, aggregate over all historical rows for candidate users
        if (period === "all" && candidateIds.size > 0) {
          const ids = Array.from(candidateIds);
          const { data: allRows, error: allErr } = await supabase
            .from("daily_totals")
            .select("user_id,date,totals,met_goal,streak")
            .in("user_id", ids);
          if (allErr) {
            throw allErr;
          }
          const agg = new Map<string, LeaderboardEntry>();
          for (const row of allRows ?? []) {
            const uid = row.user_id as string;
            const date = row.date as string;
            const totals = (row.totals as any) ?? {};
            const push = Number(totals.pushup ?? 0) || 0;
            const squat = Number(totals.squat ?? 0) || 0;
            const reps = push + squat;
            const prev = agg.get(uid) ?? {
              userId: uid,
              handle: "",
              avatarUrl: null,
              weeklyReps: 0,
              daysMet: 0,
              streak: 0,
              lastActive: undefined,
            };
            prev.weeklyReps += reps; // reuse weeklyReps field to mean total reps in all-time mode
            if (row.met_goal) prev.daysMet += 1;
            if (!prev.lastActive || date > prev.lastActive) {
              prev.lastActive = date;
              prev.streak = Math.max(
                prev.streak ?? 0,
                Number(row.streak ?? 0) || 0
              );
            }
            agg.set(uid, prev);
          }
          list = Array.from(agg.values());
        }

        // Fetch profiles for user metadata
        if (list.length > 0) {
          const ids = list.map((e) => e.userId);
          const { data: profs, error: profErr } = await supabase
            .from("profiles")
            .select("id,handle,avatar_url")
            .in("id", ids);
          if (profErr) {
            throw profErr;
          }
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

        logMessage("Social leaderboard loaded", {
          screen: "social",
          entries: list.length,
          mode,
          period,
          scope,
        });
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load leaderboard");
        logError(e, {
          screen: "social",
          phase: "load_leaderboard",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, scope, mode, period, showAddFriends]);

  useEffect(() => {
    if (params?.addfriend || params?.inviter || params?.handle) {
      setShowAddFriends(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.addfriend, params?.inviter, params?.handle]);

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Leaderboard</Text>
        <TouchableOpacity
          onPress={() => setShowAddFriends(true)}
          style={styles.iconBtn}
          accessibilityLabel="Add friends"
        >
          <Plus color="#e6f0f2" size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
          style={styles.filterScroll}
        >
          <View style={[styles.segmentCompact, { marginRight: 8 }]}>
            <CompactButton
              label="Reps"
              icon={
                <Trophy
                  color={mode === "reps" ? "#20e5e5" : "#94a3b8"}
                  size={14}
                />
              }
              active={mode === "reps"}
              onPress={() => setMode("reps")}
            />
            <CompactButton
              label="Days"
              icon={null}
              active={mode === "days"}
              onPress={() => setMode("days")}
            />
          </View>
          <View style={[styles.segmentCompact, { marginRight: 8 }]}>
            <CompactButton
              label="Weekly"
              icon={
                <Calendar
                  color={period === "week" ? "#20e5e5" : "#94a3b8"}
                  size={14}
                />
              }
              active={period === "week"}
              onPress={() => setPeriod("week")}
            />
            <CompactButton
              label="All Time"
              icon={null}
              active={period === "all"}
              onPress={() => setPeriod("all")}
            />
          </View>
          <View
            style={[styles.segmentCompact, { marginRight: 8, flexShrink: 0 }]}
          >
            <CompactButton
              label={supportsFollows ? "Friends" : "Soon"}
              icon={null}
              active={scope === "friends"}
              onPress={() => supportsFollows && setScope("friends")}
            />
            <CompactButton
              label="Global"
              icon={null}
              active={scope === "global"}
              onPress={() => setScope("global")}
            />
          </View>
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
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
      {showAddFriends && (
        <AddFriendsSheet
          visible={showAddFriends}
          onClose={() => setShowAddFriends(false)}
          prefillUserId={
            typeof params?.inviter === "string" ? params.inviter : undefined
          }
          prefillHandle={
            typeof params?.handle === "string" ? params.handle : undefined
          }
        />
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

function CompactButton({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: React.ReactNode | null;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.compactBtn, active && styles.compactBtnActive]}
    >
      {icon}
      <Text style={[styles.compactText, active && styles.compactTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heading: {
    color: "#e6f0f2",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 16 },
  filterRow: {
    height: 34,
    marginBottom: 8,
  },
  filterScrollContent: {
    alignItems: "center",
    paddingVertical: 0,
  },
  filterScroll: {
    flexGrow: 0,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentCompact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 2,
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
  compactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 8,
  },
  compactBtnActive: { backgroundColor: "#0f1720" },
  compactText: { color: "#94a3b8", fontWeight: "600", fontSize: 12 },
  compactTextActive: { color: "#e6f0f2" },
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
