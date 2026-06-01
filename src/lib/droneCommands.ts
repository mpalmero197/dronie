import { supabase } from "@/integrations/supabase/client";
import type { DroneCommandName } from "./fleet-types";

export async function sendDroneCommand(
  droneId: string,
  command: DroneCommandName,
  params: Record<string, unknown> = {},
) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sign in required to issue commands.");
  const { data, error } = await supabase
    .from("drone_commands")
    .insert({ drone_id: droneId, issued_by: uid, command, params })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelDroneCommand(commandId: string) {
  const { error } = await supabase
    .from("drone_commands")
    .update({ status: "cancelled" })
    .eq("id", commandId)
    .eq("status", "queued");
  if (error) throw error;
}