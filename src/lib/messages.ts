import { supabase } from "@/integrations/supabase/client";

export interface RequestMessage {
  id: string;
  request_id: string;
  pilot_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface UnreadThread {
  request_id: string;
  pilot_id: string;
  unread: number;
  last_message_at: string;
}

export async function listThreadMessages(requestId: string, pilotId: string) {
  const { data, error } = await supabase
    .from("request_messages")
    .select("*")
    .eq("request_id", requestId)
    .eq("pilot_id", pilotId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as RequestMessage[];
}

export async function sendThreadMessage(
  requestId: string,
  pilotId: string,
  senderId: string,
  body: string,
) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("request_messages")
    .insert({
      request_id: requestId,
      pilot_id: pilotId,
      sender_id: senderId,
      body: trimmed,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as RequestMessage | null;
}

export async function markThreadRead(
  userId: string,
  requestId: string,
  pilotId: string,
) {
  const { error } = await supabase
    .from("request_message_reads")
    .upsert(
      {
        user_id: userId,
        request_id: requestId,
        pilot_id: pilotId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,request_id,pilot_id" },
    );
  if (error) throw error;
}

export async function getUnreadThreads(userId: string): Promise<UnreadThread[]> {
  const { data, error } = await supabase.rpc("unread_thread_counts", { _user_id: userId });
  if (error) throw error;
  return (data ?? []) as UnreadThread[];
}

export function subscribeToThread(
  requestId: string,
  pilotId: string,
  onInsert: (m: RequestMessage) => void,
) {
  const channel = supabase
    .channel(`thread:${requestId}:${pilotId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "request_messages",
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => {
        const m = payload.new as RequestMessage;
        if (m.pilot_id === pilotId) onInsert(m);
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}