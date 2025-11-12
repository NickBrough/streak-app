import { supabase } from "@/lib/supabase";

export async function listFriendships(userId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id1,user_id2")
    .or(`user_id1.eq.${userId},user_id2.eq.${userId}`);
  if (error) throw error;
  return (data ?? []).map((r: any) =>
    r.user_id1 === userId ? (r.user_id2 as string) : (r.user_id1 as string)
  ) as string[];
}

export async function listFriendRequests(userId: string) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id,requester_id,addressee_id,status,created_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function sendFriendRequest(addresseeId: string, requesterId: string) {
  const { data, error } = await supabase
    .from("friend_requests")
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id as string;
}

export async function respondToRequest(requestId: string, status: "accepted" | "declined") {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);
  if (error) throw error;
}


