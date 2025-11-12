import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Share,
} from "react-native";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Profile = { id: string; handle: string; avatar_url?: string | null };
type FriendRequest = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
};

export default function AddFriendsSheet({
  visible,
  onClose,
  prefillUserId,
  prefillHandle,
}: {
  visible: boolean;
  onClose: () => void;
  prefillUserId?: string;
  prefillHandle?: string;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<"search" | "invites">("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Profile[]>([]);
  const currentUserId = user?.id ?? null;
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const outgoingByAddressee = useMemo(() => {
    const map = new Map<string, FriendRequest>();
    outgoing.forEach((r) => map.set(r.addressee_id, r));
    return map;
  }, [outgoing]);
  const incomingByRequester = useMemo(() => {
    const map = new Map<string, FriendRequest>();
    incoming.forEach((r) => map.set(r.requester_id, r));
    return map;
  }, [incoming]);

  useEffect(() => {
    if (!visible || !user) return;
    (async () => {
      setLoadingInvites(true);
      try {
        const { data: frs } = await supabase
          .from("friendships")
          .select("user_id1,user_id2")
          .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);
        const set = new Set<string>();
        (frs ?? []).forEach((r: any) => {
          const fid = r.user_id1 === user.id ? r.user_id2 : r.user_id1;
          set.add(fid as string);
        });
        setFriendIds(set);
        const { data: reqs } = await supabase
          .from("friend_requests")
          .select("id,requester_id,addressee_id,status")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
          .eq("status", "pending");
        const inc: FriendRequest[] = [];
        const out: FriendRequest[] = [];
        (reqs ?? []).forEach((r: any) => {
          if (r.addressee_id === user.id) inc.push(r as FriendRequest);
          else out.push(r as FriendRequest);
        });
        setIncoming(inc);
        setOutgoing(out);
      } finally {
        setLoadingInvites(false);
      }
    })();
  }, [visible, user]);

  useEffect(() => {
    if (!visible || !user) return;
    const initial = prefillHandle || "";
    if (initial) setQuery(initial);
  }, [visible, user, prefillHandle]);

  const runSearch = async (text: string) => {
    if (!user) return;
    setSearching(true);
    try {
      const q = text.trim().replace(/^@+/, "");
      const { data } = await supabase
        .from("profiles")
        .select("id,handle,avatar_url")
        .ilike("handle", `%${q}%`)
        .limit(20);
      console.log(data);
      setResults((data as any) ?? []);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const h = setTimeout(() => {
      if (query.trim().length > 0) runSearch(query.trim());
      else setResults([]);
    }, 250);
    return () => clearTimeout(h);
  }, [query]);

  if (!visible) return null;

  const shareInvite = async () => {
    if (!user) return;
    const handle = prefillHandle || query || "";
    const url = `streak://add-friend?inviter=${encodeURIComponent(
      user.id
    )}&handle=${encodeURIComponent(handle)}`;
    await Share.share({ url, message: url });
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(24, (insets?.bottom ?? 0) + 72) },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Add friends</Text>
          <Button title="Invite" variant="outline" onPress={shareInvite} />
        </View>
        <View style={styles.tabs}>
          <TabButton
            label="Search"
            active={tab === "search"}
            onPress={() => setTab("search")}
          />
          <TabButton
            label="Invites"
            active={tab === "invites"}
            onPress={() => setTab("invites")}
          />
        </View>

        {tab === "search" ? (
          <View>
            <Input
              placeholder="Search handle…"
              value={query}
              onChangeText={setQuery}
            />
            <View style={{ height: 12 }} />
            {searching ? (
              <ActivityIndicator color="#20e5e5" />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(p) => p.id}
                contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
                renderItem={({ item }) => (
                  <UserRow
                    profile={item}
                    currentUserId={currentUserId ?? ""}
                    isFriend={friendIds.has(item.id)}
                    incoming={incomingByRequester.get(item.id)}
                    outgoing={outgoingByAddressee.get(item.id)}
                    onAccept={async (reqId) => {
                      if (!currentUserId) return;
                      const { data, error } = await supabase
                        .from("friend_requests")
                        .update({ status: "accepted" })
                        .eq("id", reqId)
                        .eq("addressee_id", currentUserId)
                        .eq("status", "pending")
                        .select("id,status")
                        .single();
                      if (error) {
                        console.warn("Accept request failed", error);
                        return;
                      }
                      if (data?.status !== "accepted") {
                        console.warn("Accept request did not update row");
                        return;
                      }
                      setIncoming((prev) => prev.filter((r) => r.id !== reqId));
                      setFriendIds((set) => new Set(set).add(item.id));
                    }}
                    onDecline={async (reqId) => {
                      await supabase
                        .from("friend_requests")
                        .update({ status: "declined" })
                        .eq("id", reqId);
                      setIncoming((prev) => prev.filter((r) => r.id !== reqId));
                    }}
                    onCancel={async (reqId) => {
                      await supabase
                        .from("friend_requests")
                        .update({ status: "cancelled" })
                        .eq("id", reqId);
                      setOutgoing((prev) => prev.filter((r) => r.id !== reqId));
                    }}
                    onAdd={async () => {
                      if (!currentUserId) return;
                      const { data, error } = await supabase
                        .from("friend_requests")
                        .insert({
                          requester_id: currentUserId,
                          addressee_id: item.id,
                        })
                        .select("id")
                        .single();
                      if (!error && data?.id) {
                        setOutgoing((prev) => [
                          ...prev,
                          {
                            id: data.id as string,
                            requester_id: currentUserId,
                            addressee_id: item.id,
                            status: "pending",
                          },
                        ]);
                      }
                    }}
                  />
                )}
                ListEmptyComponent={
                  query.trim().length === 0 ? (
                    <Text style={styles.empty}>Type a handle to search</Text>
                  ) : (
                    <Text style={styles.empty}>No users found</Text>
                  )
                }
              />
            )}
          </View>
        ) : (
          <View>
            {loadingInvites ? (
              <ActivityIndicator color="#20e5e5" />
            ) : (
              <FlatList
                data={incoming}
                keyExtractor={(r) => r.id}
                contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
                renderItem={({ item }) => (
                  <InviteRow
                    request={item}
                    onAccept={async () => {
                      if (!currentUserId) return;
                      const { data, error } = await supabase
                        .from("friend_requests")
                        .update({ status: "accepted" })
                        .eq("id", item.id)
                        .eq("addressee_id", currentUserId)
                        .eq("status", "pending")
                        .select("id,status,requester_id,addressee_id")
                        .single();
                      if (error) {
                        console.warn("Accept invite failed", error);
                        return;
                      }
                      if (data?.status !== "accepted") {
                        console.warn("Accept invite did not update row");
                        return;
                      }
                      setIncoming((prev) =>
                        prev.filter((r) => r.id !== item.id)
                      );
                      if (currentUserId) {
                        const other =
                          item.requester_id === currentUserId
                            ? item.addressee_id
                            : item.requester_id;
                        setFriendIds((set) => new Set(set).add(other));
                      }
                    }}
                    onDecline={async () => {
                      await supabase
                        .from("friend_requests")
                        .update({ status: "declined" })
                        .eq("id", item.id);
                      setIncoming((prev) =>
                        prev.filter((r) => r.id !== item.id)
                      );
                    }}
                  />
                )}
                ListEmptyComponent={
                  <Text style={styles.empty}>No incoming invites</Text>
                }
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function TabButton({
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
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function UserRow({
  profile,
  currentUserId,
  isFriend,
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onCancel,
  onAdd,
}: {
  profile: Profile;
  currentUserId: string;
  isFriend: boolean;
  incoming?: FriendRequest;
  outgoing?: FriendRequest;
  onAccept: (requestId: string) => Promise<void>;
  onDecline: (requestId: string) => Promise<void>;
  onCancel: (requestId: string) => Promise<void>;
  onAdd: () => Promise<void>;
}) {
  const isSelf = profile.id === currentUserId;
  return (
    <View style={styles.row}>
      <Avatar
        uri={profile.avatar_url ?? undefined}
        name={profile.handle}
        size={36}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.handle}>@{profile.handle || "user"}</Text>
      </View>
      {isSelf ? (
        <Text style={styles.badgeMuted}>You</Text>
      ) : isFriend ? (
        <Text style={styles.badge}>Friends</Text>
      ) : incoming ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Accept" onPress={() => onAccept(incoming.id)} />
          <Button
            title="Decline"
            variant="outline"
            onPress={() => onDecline(incoming.id)}
          />
        </View>
      ) : outgoing ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Text style={styles.badgeMuted}>Requested</Text>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => onCancel(outgoing.id)}
          />
        </View>
      ) : (
        <Button title="Add" onPress={onAdd} />
      )}
    </View>
  );
}

function InviteRow({
  request,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    const otherId = request.requester_id;
    supabase
      .from("profiles")
      .select("id,handle,avatar_url")
      .eq("id", otherId)
      .maybeSingle()
      .then(({ data }) => setProfile((data as any) ?? null));
  }, [request.requester_id]);
  return (
    <View style={styles.row}>
      <Avatar
        uri={profile?.avatar_url ?? undefined}
        name={profile?.handle ?? ""}
        size={36}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.handle}>@{profile?.handle ?? "user"}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Accept" onPress={onAccept} />
        <Button title="Decline" variant="outline" onPress={onDecline} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
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
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { color: "#e6f0f2", fontSize: 18, fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: "#0f1720" },
  tabText: { color: "#94a3b8", fontWeight: "600" },
  tabTextActive: { color: "#e6f0f2" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1720",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  handle: { color: "#e6f0f2", fontWeight: "700" },
  badge: { color: "#20e5e5", fontWeight: "800" },
  badgeMuted: { color: "#94a3b8", fontWeight: "600" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 8 },
});
