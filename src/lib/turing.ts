import { supabase } from "@/integrations/supabase/client";

export type TestStatus = "registration" | "running" | "ended";
export type Participant = { id: string; name: string; grp: "A" | "B" | null; pair_id: string | null };
export type TuringTest = { id: string; status: TestStatus; created_at: string; participants: Participant[] };
export type GuestState = { status: TestStatus; name?: string; kind?: "bot" | "peer" | null; messages?: { id: string; mine: boolean; content: string }[] };

export const validTestId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const validGuestName = (name: string) => name.trim().length >= 1 && name.trim().length <= 80;
export const testLink = (id: string) => `${window.location.origin}/turing/${id}`;

export async function adminAction(action: "list" | "create" | "start" | "stop", testId?: string) {
  const { data, error } = await supabase.rpc("turing_admin", { p_action: action, p_test: testId });
  if (error) throw new Error(error.message);
  return data as unknown as { created_id: string | null; tests: TuringTest[] };
}

export async function guestAction(action: "info" | "register" | "state" | "send", testId: string, token?: string, name?: string, content?: string) {
  const { data, error } = await supabase.rpc("turing_guest", { p_action: action, p_test: testId, p_token: token, p_name: name, p_content: content });
  if (error) throw new Error(error.message);
  return data as unknown as GuestState;
}